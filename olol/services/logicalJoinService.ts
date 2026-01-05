import { ColumnDefinition } from '../types';

export interface LogicalRelation {
  id: string;
  dbId: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
}

class LogicalJoinService {
  private DB_NAME = 'MuulLogicalJoins';
  private STORE_NAME = 'relations';
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveRelation(rel: Omit<LogicalRelation, 'id'>): Promise<void> {
    await this.init();
    const id = `${rel.dbId}:${rel.sourceTable}.${rel.sourceColumn}->${rel.targetTable}.${rel.targetColumn}`;
    const transaction = this.db!.transaction(this.STORE_NAME, 'readwrite');
    transaction.objectStore(this.STORE_NAME).put({ ...rel, id });
  }

  async getRelations(dbId: string): Promise<LogicalRelation[]> {
    await this.init();
    return new Promise((resolve) => {
      const transaction = this.db!.transaction(this.STORE_NAME, 'readonly');
      const request = transaction.objectStore(this.STORE_NAME).getAll();
      request.onsuccess = () => {
        const all = request.result as LogicalRelation[];
        resolve(all.filter(r => r.dbId === dbId));
      };
    });
  }

  async deleteRelation(id: string): Promise<void> {
    await this.init();
    const transaction = this.db!.transaction(this.STORE_NAME, 'readwrite');
    transaction.objectStore(this.STORE_NAME).delete(id);
  }
}

export const logicalJoinService = new LogicalJoinService();