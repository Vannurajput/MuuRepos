import { DbEngine, QueryResult, DbSchema, TableDefinition, ColumnDefinition } from '../../types';

export class MongoEngine implements DbEngine {
  async init() {}

  async executeQuery(dbId: string, query: string): Promise<QueryResult> {
    const startTime = performance.now();
    await new Promise(r => setTimeout(r, 300)); // Simulate latency

    try {
      // Very basic MQL parser simulator for the demo
      // In a real app, this would send the string to a backend or bridge
      let collectionName = 'users';
      if (query.includes('db.')) {
        const match = query.match(/db\.(\w+)\./);
        if (match) collectionName = match[1];
      }

      // Mock data generation for MongoDB
      const mockDocs = this.getMockDocuments(collectionName);
      
      // Flatten keys for tabular view
      const columns = this.extractColumns(mockDocs);
      const rows = mockDocs.map(doc => columns.map(col => this.getNestedValue(doc, col)));

      return {
        columns,
        rows,
        rowCount: rows.length,
        executionTimeMs: Math.round(performance.now() - startTime),
        timestamp: Date.now(),
        rawJson: mockDocs
      };
    } catch (e: any) {
      return {
        columns: [], rows: [], rowCount: 0,
        executionTimeMs: Math.round(performance.now() - startTime),
        timestamp: Date.now(),
        error: "MQL Syntax Error: " + e.message
      };
    }
  }

  async getSchema(dbId: string): Promise<DbSchema> {
    const collections = ['users', 'orders', 'logs', 'settings'];
    const tables: TableDefinition[] = collections.map(name => {
      const sampleDocs = this.getMockDocuments(name).slice(0, 1);
      const cols = this.extractColumns(sampleDocs);
      
      return {
        name,
        columns: cols.map(c => ({
          name: c,
          type: 'bson',
          isPrimaryKey: c === '_id',
          isForeignKey: c.endsWith('_id') && c !== '_id'
        }))
      };
    });

    return { tables };
  }

  private extractColumns(docs: any[]): string[] {
    const keys = new Set<string>();
    docs.forEach(doc => {
      Object.keys(doc).forEach(k => {
        if (typeof doc[k] === 'object' && doc[k] !== null && !Array.isArray(doc[k])) {
          Object.keys(doc[k]).forEach(subK => keys.add(`${k}.${subK}`));
        } else {
          keys.add(k);
        }
      });
    });
    return Array.from(keys);
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((prev, curr) => prev && prev[curr], obj);
  }

  private getMockDocuments(collection: string): any[] {
    if (collection === 'users') {
        return [
            { _id: '64a1b2c3', username: 'jdoe', profile: { age: 30, city: 'NY' }, tags: ['dev', 'admin'] },
            { _id: '64a1b2c4', username: 'asmith', profile: { age: 25, city: 'SF' }, tags: ['design'] },
            { _id: '64a1b2c5', username: 'bwong', profile: { age: 34, city: 'London' }, tags: ['hr'] },
        ];
    }
    return [
        { _id: '99x88y77', collection: collection, status: 'processed', metadata: { source: 'web' } },
        { _id: '99x88y78', collection: collection, status: 'pending', metadata: { source: 'api' } },
    ];
  }
}