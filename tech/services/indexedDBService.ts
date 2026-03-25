/**
 * IndexedDB Storage Service
 * Replaces localStorage for better storage capacity (GB instead of 5-10MB)
 * 
 * Storage hierarchy:
 * - IndexedDB "motext-storage" database
 *   - "projects" object store: Project metadata
 *   - "files" object store: File contents (keyed by projectId + path)
 *   - "settings" object store: User preferences
 */

const DB_NAME = 'motext-storage';
const DB_VERSION = 1;

// Store names
const STORES = {
    PROJECTS: 'projects',
    FILES: 'files',
    SETTINGS: 'settings',
    STATE: 'state',
} as const;

let dbInstance: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
    if (dbInstance) {
        return Promise.resolve(dbInstance);
    }

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[IndexedDB] Failed to open database:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            dbInstance = request.result;
            console.log('[IndexedDB] Database opened successfully');
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            console.log('[IndexedDB] Upgrading database schema...');

            // Projects store - stores project metadata
            if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
                const projectStore = db.createObjectStore(STORES.PROJECTS, { keyPath: 'id' });
                projectStore.createIndex('name', 'name', { unique: false });
            }

            // Files store - stores file contents with composite key
            if (!db.objectStoreNames.contains(STORES.FILES)) {
                const fileStore = db.createObjectStore(STORES.FILES, { keyPath: 'id' });
                fileStore.createIndex('projectId', 'projectId', { unique: false });
                fileStore.createIndex('path', 'name', { unique: false });
            }

            // Settings store - user preferences
            if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
                db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
            }

            // State store - for app state (replaces localStorage APP_STORAGE_KEY)
            if (!db.objectStoreNames.contains(STORES.STATE)) {
                db.createObjectStore(STORES.STATE, { keyPath: 'key' });
            }
        };
    });
}

/**
 * Generic transaction helper (currently unused)
 */
// @ts-ignore: Unused function kept for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function withTransaction<T>(
    storeNames: string | string[],
    mode: IDBTransactionMode,
    callback: (transaction: IDBTransaction) => Promise<T>
): Promise<T> {
    const db = await openDatabase();
    const transaction = db.transaction(storeNames, mode);
    return callback(transaction);
}

/**
 * Save the entire app state (replaces localStorage.setItem)
 */
export async function saveState(key: string, state: unknown): Promise<void> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.STATE, 'readwrite');
        const store = transaction.objectStore(STORES.STATE);

        const request = store.put({ key, value: state, updatedAt: Date.now() });

        request.onsuccess = () => {
            console.log(`[IndexedDB] State saved: ${key}`);
            resolve();
        };

        request.onerror = () => {
            console.error('[IndexedDB] Failed to save state:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Load the entire app state (replaces localStorage.getItem)
 */
export async function loadState<T>(key: string): Promise<T | null> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.STATE, 'readonly');
        const store = transaction.objectStore(STORES.STATE);

        const request = store.get(key);

        request.onsuccess = () => {
            if (request.result) {
                console.log(`[IndexedDB] State loaded: ${key}`);
                resolve(request.result.value as T);
            } else {
                resolve(null);
            }
        };

        request.onerror = () => {
            console.error('[IndexedDB] Failed to load state:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Delete a state entry (replaces localStorage.removeItem)
 */
export async function deleteState(key: string): Promise<void> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.STATE, 'readwrite');
        const store = transaction.objectStore(STORES.STATE);

        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Save a single file to IndexedDB
 */
export async function saveFile(file: {
    id: number;
    projectId: number;
    name: string;
    content: string;
    language: string;
    isBinary?: boolean;
    mimeType?: string;
    createdAt: number;
    modifiedAt: number;
}): Promise<void> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.FILES, 'readwrite');
        const store = transaction.objectStore(STORES.FILES);

        const request = store.put(file);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Load all files for a project
 */
export async function loadProjectFiles(projectId: number): Promise<unknown[]> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.FILES, 'readonly');
        const store = transaction.objectStore(STORES.FILES);
        const index = store.index('projectId');

        const request = index.getAll(projectId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Delete all files for a project
 */
export async function deleteProjectFiles(projectId: number): Promise<void> {
    const db = await openDatabase();
    const files = await loadProjectFiles(projectId);

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.FILES, 'readwrite');
        const store = transaction.objectStore(STORES.FILES);

        let deleteCount = 0;
        const totalFiles = files.length;

        if (totalFiles === 0) {
            resolve();
            return;
        }

        files.forEach((file: any) => {
            const request = store.delete(file.id);
            request.onsuccess = () => {
                deleteCount++;
                if (deleteCount === totalFiles) {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
    });
}

/**
 * Get storage usage estimate
 */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
    if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        return {
            usage: estimate.usage || 0,
            quota: estimate.quota || 0,
        };
    }
    return { usage: 0, quota: 0 };
}

/**
 * Request persistent storage (prevents browser from clearing data)
 */
export async function requestPersistentStorage(): Promise<boolean> {
    if (navigator.storage && navigator.storage.persist) {
        return navigator.storage.persist();
    }
    return false;
}

/**
 * Clear all data (for debugging/reset)
 */
export async function clearAllData(): Promise<void> {
    const db = await openDatabase();

    const storeNames = [STORES.PROJECTS, STORES.FILES, STORES.SETTINGS, STORES.STATE];

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeNames, 'readwrite');

        storeNames.forEach(storeName => {
            transaction.objectStore(storeName).clear();
        });

        transaction.oncomplete = () => {
            console.log('[IndexedDB] All data cleared');
            resolve();
        };

        transaction.onerror = () => reject(transaction.error);
    });
}

// Export store names for direct access if needed
export { STORES, openDatabase };
