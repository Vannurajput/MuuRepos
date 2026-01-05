
import initSqlJs from 'sql.js';
import Papa from 'papaparse';
import { parquetRead } from 'hyparquet';
import * as fflate from 'fflate';
import { DbEngine, QueryResult, DbSchema, TableDefinition, ColumnDefinition, DbStats } from '../../types';

export class SqliteEngine implements DbEngine {
  private sqlPromise: Promise<any>;
  private instances: Map<string, any> = new Map();

  constructor() {
    this.sqlPromise = initSqlJs({
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });
  }

  async init() {
    await this.sqlPromise;
  }

  registerDatabase(id: string, db: any) {
    this.instances.set(id, db);
  }

  async createDatabaseFromFile(file: File): Promise<{ db: any, type: string }> {
     const SQL = await this.sqlPromise;
     if (file.name.endsWith('.sqlite') || file.name.endsWith('.db')) {
        const buffer = await file.arrayBuffer();
        const db = new SQL.Database(new Uint8Array(buffer));
        db.run('PRAGMA foreign_keys = ON;');
        return { db, type: 'sqlite' };
     } else if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const parseResult = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true });
        const db = new SQL.Database();
        const tableName = this.sanitizeTableName(file.name);
        if (parseResult.meta.fields && parseResult.data.length > 0) {
            this.importDataToTable(db, tableName, parseResult.meta.fields, parseResult.data);
        }
        return { db, type: 'sqlite' };
     }
     const db = new SQL.Database();
     return { db, type: 'sqlite' };
  }

  async executeQuery(dbId: string, sql: string): Promise<QueryResult> {
    const db = this.instances.get(dbId);
    if (!db) throw new Error("Database instance not found");
    const startTime = performance.now();
    try {
        const results = db.exec(sql);
        if (results.length === 0) {
            return { columns: [], rows: [], rowCount: 0, executionTimeMs: Math.round(performance.now() - startTime), timestamp: Date.now() };
        }
        const lastRes = results[results.length - 1];
        return {
            columns: lastRes.columns,
            rows: lastRes.values,
            rowCount: lastRes.values.length,
            executionTimeMs: Math.round(performance.now() - startTime),
            timestamp: Date.now()
        };
    } catch (e: any) {
        return { columns: [], rows: [], rowCount: 0, executionTimeMs: Math.round(performance.now() - startTime), timestamp: Date.now(), error: e.message };
    }
  }

  async getSchema(dbId: string): Promise<DbSchema> {
    const db = this.instances.get(dbId);
    if (!db) return { tables: [] };
    try {
        const tablesRes = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        if (tablesRes.length === 0) return { tables: [] };
        const tableNames = tablesRes[0].values.flat();
        const tables: TableDefinition[] = [];

        for (const tableName of tableNames as string[]) {
            const colsRes = db.exec(`PRAGMA table_info("${tableName}")`);
            const fkRes = db.exec(`PRAGMA foreign_key_list("${tableName}")`);
            
            const fks = fkRes.length > 0 ? fkRes[0].values.map((row: any[]) => ({
                from: row[3],
                table: row[2],
                to: row[4]
            })) : [];

            const columns: ColumnDefinition[] = colsRes[0].values.map((row: any[]) => {
                const name = row[1];
                const type = row[2];
                const isPk = row[5] > 0;
                const fkDef = fks.find(f => f.from === name);

                return {
                    name,
                    type,
                    isPrimaryKey: isPk,
                    isForeignKey: !!fkDef,
                    references: fkDef ? { table: fkDef.table, column: fkDef.to } : undefined
                };
            });
            tables.push({ name: tableName, columns });
        }
        return { tables };
    } catch (e) {
        console.error("SQLite Schema Error:", e);
        return { tables: [] };
    }
  }

  async getStats(dbId: string): Promise<DbStats> {
    const db = this.instances.get(dbId);
    if (!db) return { tableCount: 0, columnCount: 0, pkCount: 0, fkCount: 0, indexCount: 0 };
    
    try {
        const schema = await this.getSchema(dbId);
        const indexRes = db.exec("SELECT count(*) FROM sqlite_master WHERE type='index'");
        const indexCount = indexRes.length > 0 ? Number(indexRes[0].values[0][0]) : 0;

        let pks = 0;
        let fks = 0;
        let cols = 0;
        schema.tables.forEach(t => {
            t.columns.forEach(c => {
                cols++;
                if (c.isPrimaryKey) pks++;
                if (c.isForeignKey) fks++;
            });
        });

        return {
            tableCount: schema.tables.length,
            columnCount: cols,
            pkCount: pks,
            fkCount: fks,
            indexCount: indexCount
        };
    } catch (e) {
        return { tableCount: 0, columnCount: 0, pkCount: 0, fkCount: 0, indexCount: 0 };
    }
  }

  private importDataToTable(db: any, tableName: string, fields: string[], data: any[]) {
      const columnsDef = fields.map(f => `"${f}" TEXT`).join(', '); 
      db.run(`CREATE TABLE "${tableName}" (${columnsDef});`);
      const placeholders = fields.map(() => '?').join(', ');
      const stmt = db.prepare(`INSERT INTO "${tableName}" VALUES (${placeholders})`);
      db.exec("BEGIN TRANSACTION");
      for (const row of data) {
          const values = fields.map(f => row[f] ?? null);
          stmt.run(values);
      }
      db.exec("COMMIT");
      stmt.free();
  }

  private sanitizeTableName(filename: string): string {
      return filename.replace(/[^a-zA-Z0-9]/g, '_').replace(/_(csv|json|parquet)$/i, '');
  }
}
