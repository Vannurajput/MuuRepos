
import { Database, QueryResult, DbSchema, CredentialEntry, TableDefinition, ColumnDefinition, DbStats } from '../types';
import { SqliteEngine } from './engines/SqliteEngine';
import { MockEngine } from './engines/MockEngine';
import { MongoEngine } from './engines/MongoEngine';
import { DialectRegistry, DbDialect } from './dialects/SqlDialects';

class MuulService {
  private sqliteEngine: SqliteEngine;
  private mockEngine: MockEngine;
  private mongoEngine: MongoEngine;
  
  private realDatabases: Map<string, { name: string, type: DbDialect }> = new Map();
  private virtualIdCounter = 1;

  constructor() {
    this.sqliteEngine = new SqliteEngine();
    this.mockEngine = new MockEngine();
    this.mongoEngine = new MongoEngine();
  }

  async getDatabases(): Promise<Database[]> {
    const systemDbs: Database[] = [
      { id: 'db-1', name: 'Production DB (Mock SQL)', type: 'postgres' },
      { id: 'db-mssql', name: 'Enterprise SQL Server (Mock)', type: 'mssql' },
      { id: 'db-2', name: 'Analytics Parquet (Mock)', type: 'parquet' },
      { id: 'db-mongo', name: 'User Store (Mock MongoDB)', type: 'mongodb' },
    ];
    const userDbs: Database[] = Array.from(this.realDatabases.entries()).map(([id, meta]) => ({
      id, name: meta.name, type: meta.type
    }));
    return [...userDbs, ...systemDbs];
  }

  async uploadDatabase(file: File): Promise<Database> {
     const { db, type } = await this.sqliteEngine.createDatabaseFromFile(file);
     const dbId = `user-db-${this.virtualIdCounter++}`;
     this.sqliteEngine.registerDatabase(dbId, db);
     this.realDatabases.set(dbId, { name: file.name, type: type as DbDialect });
     return { id: dbId, name: file.name, type: type as DbDialect };
  }

  async getDatabaseSchema(dbId: string): Promise<DbSchema> {
      if (dbId === 'db-mongo') return this.mongoEngine.getSchema(dbId);
      if (this.realDatabases.has(dbId)) return this.sqliteEngine.getSchema(dbId);
      return this.mockEngine.getSchema(dbId);
  }

  /**
   * Technical Metadata Aggregator
   */
  async getDatabaseStats(dbId: string, credential?: CredentialEntry): Promise<DbStats> {
      if (credential) {
          const schema = await this.getRemoteDatabaseSchema(credential);
          return this.calculateStatsFromSchema(schema);
      }
      
      if (this.realDatabases.has(dbId)) {
          return this.sqliteEngine.getStats(dbId);
      }

      // Mock fallback
      const schema = await this.mockEngine.getSchema(dbId);
      return this.calculateStatsFromSchema(schema);
  }

  private calculateStatsFromSchema(schema: DbSchema): DbStats {
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
          indexCount: pks // Simplified estimation for remote
      };
  }

  async executeRemoteQuery(credential: CredentialEntry, sql: string): Promise<QueryResult> {
    console.log(`[MessageHandler] Executing remote query for credential: ${credential.id}`);
    if (!window.externalMessage?.send) {
        console.error("[MessageHandler] Bridge not detected for remote query execution.");
        return { columns: [], rows: [], rowCount: 0, executionTimeMs: 0, timestamp: Date.now(), error: "Muul Browser bridge not detected." };
    }
    try {
        const requestPayload = { type: "EXECUTE_REMOTE_QUERY", credentialId: credential.id, sql: sql, requestId: `query-${Date.now()}` };
        console.log("[MessageHandler] Sending remote query payload:", requestPayload);
        const response = await window.externalMessage.send(JSON.stringify(requestPayload));
        console.log("[MessageHandler] Received response for remote query:", response);

        if (response && response.ok) {
            let columns = response.columns || [];
            let rows = response.rows || [];

            // Data shape inference for native responses that return an array of objects without columns.
            if ((!columns || columns.length === 0) && Array.isArray(rows) && rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null) {
                console.log("[MessageHandler] Inferring columns from object array response.");
                columns = Object.keys(rows[0]);
                rows = rows.map((obj: any) => columns.map((col: string) => obj[col]));
            }

            const result = {
                columns: columns,
                rows: rows,
                rowCount: response.rowCount || (rows ? rows.length : 0),
                executionTimeMs: response.executionTimeMs || 0,
                timestamp: Date.now(),
                rawJson: response.rawJson
            };
            console.log(`[MessageHandler] Query successful. ${result.rowCount} rows returned in ${result.executionTimeMs}ms.`);
            return result;
        }
        console.error("[MessageHandler] Remote query failed. Response:", response);
        return { columns: [], rows: [], rowCount: 0, executionTimeMs: 0, timestamp: Date.now(), error: response?.error || "Unknown remote error" };
    } catch (error: any) {
        console.error("[MessageHandler] Bridge communication failed during query execution:", error);
        return { columns: [], rows: [], rowCount: 0, executionTimeMs: 0, timestamp: Date.now(), error: error.message || "Bridge communication failed" };
    }
  }

  async getRemoteDatabaseSchema(credential: CredentialEntry): Promise<DbSchema> {
    let dbTypeStr = (credential.dbType?.toLowerCase() === 'sqlserver' ? 'mssql' : credential.dbType?.toLowerCase() || 'postgres') as DbDialect;
    const dialect = DialectRegistry[dbTypeStr];
    if (!dialect) return { tables: [] };
    const toObjects = (res: QueryResult) => res.rows.map(row => {
        const obj: { [key: string]: any } = {};
        res.columns.forEach((col, i) => obj[col.toLowerCase()] = row[i]);
        return obj;
    });
    const tablesResult = await this.executeRemoteQuery(credential, dialect.queries.getTables);
    if (tablesResult.error || !tablesResult.rows) return { tables: [] };
    const tableObjects = toObjects(tablesResult);
    const firstColName = tablesResult.columns.length > 0 ? tablesResult.columns[0].toLowerCase() : null;
    const tableNames = tableObjects.map(row => row.name || (firstColName ? row[firstColName] : undefined)).filter(n => n);
    const tables: TableDefinition[] = [];
    for (const tableName of tableNames) {
        const colsResult = await this.executeRemoteQuery(credential, dialect.queries.getColumns(tableName));
        if (colsResult.error) continue;
        const fksResult = await this.executeRemoteQuery(credential, dialect.queries.getForeignKeys(tableName));
        const fksData = fksResult.error ? [] : toObjects(fksResult);
        const columns: ColumnDefinition[] = toObjects(colsResult).map(colRow => {
            const name = colRow.name || colRow.field || colRow.column_name;
            const type = colRow.type || colRow.data_type;
            let isPk = false;
            if (dbTypeStr === 'sqlite') isPk = colRow.pk > 0;
            else if (dbTypeStr === 'postgres' || dbTypeStr === 'mssql') isPk = colRow.pk === 1 || colRow.pk === true;
            else if (dbTypeStr === 'mysql') isPk = (colRow.key || '').toUpperCase() === 'PRI';
            const fkDef = fksData.find(fk => fk.from === name);
            return { name, type, isPrimaryKey: isPk, isForeignKey: !!fkDef, references: fkDef ? { table: fkDef.table, column: fkDef.to } : undefined };
        });
        tables.push({ name: tableName, columns });
    }
    return { tables };
  }

  async executeQuery(dbId: string, sql: string, queryId: string): Promise<QueryResult> {
      if (dbId === 'db-mongo') return this.mongoEngine.executeQuery(dbId, sql);
      if (this.realDatabases.has(dbId)) return this.sqliteEngine.executeQuery(dbId, sql);
      return this.mockEngine.executeQuery(dbId, sql);
  }

  async explainQuery(dbId: string, sql: string, credential?: CredentialEntry): Promise<QueryResult> {
      const type = this.getDialectForDb(dbId, credential);
      let explainSql = '';
      switch(type) {
        case 'postgres': explainSql = `EXPLAIN (FORMAT JSON, ANALYZE) ${sql}`; break;
        case 'sqlite': explainSql = `EXPLAIN QUERY PLAN ${sql}`; break;
        case 'mssql': explainSql = `SET SHOWPLAN_XML ON;\nGO\n${sql}\nGO\nSET SHOWPLAN_XML OFF;`; break;
        case 'mysql': explainSql = `EXPLAIN FORMAT=JSON ${sql}`; break;
        case 'mongodb': return this.executeQuery(dbId, sql.includes('.explain') ? sql : `${sql}.explain("executionStats")`, `expl-${Date.now()}`);
        default: explainSql = `EXPLAIN ${sql}`;
      }
      if (credential) return this.executeRemoteQuery(credential, explainSql);
      return this.executeQuery(dbId, explainSql, `expl-${Date.now()}`);
  }

  private getDialectForDb(dbId: string, credential?: CredentialEntry): DbDialect {
    if (credential) return (credential.dbType?.toLowerCase() === 'sqlserver' ? 'mssql' : credential.dbType?.toLowerCase() || 'postgres') as DbDialect;
    if (dbId === 'db-mssql') return 'mssql';
    if (dbId === 'db-mongo') return 'mongodb';
    if (this.realDatabases.has(dbId)) return this.realDatabases.get(dbId)!.type;
    return 'postgres';
  }
}

export const muulService = new MuulService();
