import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock IndexedDB for testing
const mockIDBRequest = (result: any, error: any = null) => ({
    result,
    error,
    onsuccess: null as any,
    onerror: null as any,
    onupgradeneeded: null as any,
    readyState: 'done' as const,
});

const mockIDBObjectStore = () => ({
    put: vi.fn().mockImplementation((data) => {
        const req = mockIDBRequest(data.key || data.id);
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
        return req;
    }),
    get: vi.fn().mockImplementation((key) => {
        const req = mockIDBRequest({ key, value: { test: 'data' }, updatedAt: Date.now() });
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
        return req;
    }),
    delete: vi.fn().mockImplementation(() => {
        const req = mockIDBRequest(undefined);
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
        return req;
    }),
    clear: vi.fn().mockImplementation(() => {
        const req = mockIDBRequest(undefined);
        setTimeout(() => req.onsuccess?.({ target: req }), 0);
        return req;
    }),
    index: vi.fn().mockReturnValue({
        getAll: vi.fn().mockImplementation(() => {
            const req = mockIDBRequest([]);
            setTimeout(() => req.onsuccess?.({ target: req }), 0);
            return req;
        }),
    }),
    createIndex: vi.fn(),
});

const mockIDBTransaction = () => ({
    objectStore: vi.fn().mockReturnValue(mockIDBObjectStore()),
    oncomplete: null as any,
    onerror: null as any,
});

const mockIDBDatabase = () => ({
    transaction: vi.fn().mockReturnValue(mockIDBTransaction()),
    objectStoreNames: {
        contains: vi.fn().mockReturnValue(false),
    },
    createObjectStore: vi.fn().mockReturnValue(mockIDBObjectStore()),
});

describe('indexedDBService', () => {
    let originalIndexedDB: IDBFactory;

    beforeEach(() => {
        originalIndexedDB = globalThis.indexedDB;

        // Mock indexedDB.open
        const mockDB = mockIDBDatabase();
        (globalThis as any).indexedDB = {
            open: vi.fn().mockImplementation(() => {
                const req = mockIDBRequest(mockDB);
                setTimeout(() => {
                    req.onupgradeneeded?.({ target: req });
                    req.onsuccess?.({ target: req });
                }, 0);
                return req;
            }),
        };
    });

    afterEach(() => {
        (globalThis as any).indexedDB = originalIndexedDB;
        vi.resetModules();
    });

    describe('openDatabase', () => {
        it('should open the database successfully', async () => {
            const { openDatabase } = await import('@services/indexedDBService');
            const db = await openDatabase();
            expect(db).toBeDefined();
            expect(indexedDB.open).toHaveBeenCalledWith('motext-storage', 1);
        });

        it('should return cached database on subsequent calls', async () => {
            const { openDatabase } = await import('@services/indexedDBService');
            const db1 = await openDatabase();
            const db2 = await openDatabase();
            // Second call should return same instance without calling open again
            expect(db1).toBe(db2);
        });
    });

    describe('saveState', () => {
        it('should save state to IndexedDB', async () => {
            const { saveState } = await import('@services/indexedDBService');
            const testData = { files: [], projects: [] };

            await expect(saveState('test_key', testData)).resolves.toBeUndefined();
        });
    });

    describe('loadState', () => {
        it('should load state from IndexedDB', async () => {
            const { loadState } = await import('@services/indexedDBService');

            const result = await loadState('test_key');
            expect(result).toBeDefined();
        });

        it('should return null for non-existent key', async () => {
            // Override to return null result
            const mockDB = mockIDBDatabase();
            mockDB.transaction = vi.fn().mockReturnValue({
                objectStore: vi.fn().mockReturnValue({
                    get: vi.fn().mockImplementation(() => {
                        const req = mockIDBRequest(null);
                        setTimeout(() => req.onsuccess?.({ target: req }), 0);
                        return req;
                    }),
                }),
            });

            (globalThis as any).indexedDB = {
                open: vi.fn().mockImplementation(() => {
                    const req = mockIDBRequest(mockDB);
                    setTimeout(() => req.onsuccess?.({ target: req }), 0);
                    return req;
                }),
            };

            vi.resetModules();
            const { loadState } = await import('@services/indexedDBService');
            const result = await loadState('nonexistent_key');
            expect(result).toBeNull();
        });
    });

    describe('deleteState', () => {
        it('should delete state from IndexedDB', async () => {
            const { deleteState } = await import('@services/indexedDBService');

            await expect(deleteState('test_key')).resolves.toBeUndefined();
        });
    });

    describe('getStorageEstimate', () => {
        it('should return storage estimate when available', async () => {
            // Mock navigator.storage
            Object.defineProperty(navigator, 'storage', {
                value: {
                    estimate: vi.fn().mockResolvedValue({ usage: 1000, quota: 100000 }),
                    persist: vi.fn().mockResolvedValue(true),
                },
                configurable: true,
            });

            const { getStorageEstimate } = await import('@services/indexedDBService');
            const estimate = await getStorageEstimate();

            expect(estimate.usage).toBe(1000);
            expect(estimate.quota).toBe(100000);
        });

        it('should return zeros when storage API is not available', async () => {
            Object.defineProperty(navigator, 'storage', {
                value: undefined,
                configurable: true,
            });

            vi.resetModules();
            const { getStorageEstimate } = await import('@services/indexedDBService');
            const estimate = await getStorageEstimate();

            expect(estimate.usage).toBe(0);
            expect(estimate.quota).toBe(0);
        });
    });

    describe('requestPersistentStorage', () => {
        it('should request persistent storage when available', async () => {
            Object.defineProperty(navigator, 'storage', {
                value: {
                    persist: vi.fn().mockResolvedValue(true),
                },
                configurable: true,
            });

            const { requestPersistentStorage } = await import('@services/indexedDBService');
            const result = await requestPersistentStorage();

            expect(result).toBe(true);
        });

        it('should return false when storage API is not available', async () => {
            Object.defineProperty(navigator, 'storage', {
                value: undefined,
                configurable: true,
            });

            vi.resetModules();
            const { requestPersistentStorage } = await import('@services/indexedDBService');
            const result = await requestPersistentStorage();

            expect(result).toBe(false);
        });
    });
});
