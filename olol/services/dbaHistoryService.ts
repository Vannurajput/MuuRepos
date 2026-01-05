import { DbaHistoryRecord, QueryResult } from '../types';

class DbaHistoryService {
  private STORAGE_KEY = 'muul_dba_history';

  getHistory(dbId?: string): DbaHistoryRecord[] {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return [];
    const all: DbaHistoryRecord[] = JSON.parse(raw);
    if (dbId) return all.filter(r => r.dbId === dbId);
    return all;
  }

  saveSnapshot(dbId: string, dbName: string, insightId: string, title: string, data: QueryResult): DbaHistoryRecord {
    const record: DbaHistoryRecord = {
      id: `hist-${Date.now()}`,
      dbId,
      dbName,
      insightId,
      insightTitle: title,
      timestamp: Date.now(),
      data
    };

    const all = this.getHistory();
    all.unshift(record);
    // Keep last 100 records
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all.slice(0, 100)));
    return record;
  }

  clearHistory(dbId?: string) {
    if (!dbId) {
      localStorage.removeItem(this.STORAGE_KEY);
    } else {
      const remaining = this.getHistory().filter(r => r.dbId !== dbId);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(remaining));
    }
  }

  deleteRecord(id: string) {
    const remaining = this.getHistory().filter(r => r.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(remaining));
  }
}

export const dbaHistoryService = new DbaHistoryService();