
import { DbEngine, QueryResult, DbSchema } from '../../types';

export class MockEngine implements DbEngine {
    
  async init() {
      // no-op
  }

  async executeQuery(dbId: string, sql: string): Promise<QueryResult> {
      await new Promise(r => setTimeout(r, 400));
      
      const lowerSql = sql.toLowerCase();
      
      // =========================================================
      // MOCK DATA DISPATCHER
      // Detects dialect based on system table prefixes (pg_ vs sys.)
      // =========================================================

      // --- MSSQL / SQL SERVER DETECTORS (sys., msdb., []) ---
      if (lowerSql.includes('sys.') || lowerSql.includes('msdb.') || lowerSql.includes('[') || lowerSql.includes('blockingtree')) {
          
          if (lowerSql.includes('blockingtree')) {
            return {
                columns: ['SPID', 'Duration ms', 'Wait', 'Resource', 'SQL', 'Detective'],
                rows: [
                    ['54', 0, 'LCK_M_X', 'KEY: 5:72057594043531264 (a1b2c3d4e5f6)', 'UPDATE Orders SET Status = 2 WHERE OrderID = 1001', 'ACTION_INVESTIGATE'],
                    ['--- 62', 1500, 'LCK_M_S', 'KEY: 5:72057594043531264 (a1b2c3d4e5f6)', 'SELECT * FROM Orders WHERE OrderID = 1001', 'ACTION_INVESTIGATE'],
                    ['--- 78', 3200, 'LCK_M_U', 'KEY: 5:72057594043531264 (a1b2c3d4e5f6)', 'UPDATE Orders SET Total = 50.00 WHERE OrderID = 1001', 'ACTION_INVESTIGATE']
                ],
                rowCount: 3,
                executionTimeMs: 145,
                timestamp: Date.now()
            };
          }

          if (lowerSql.includes('msdb.dbo.backupset')) {
            return {
                columns: ['database_name', 'physical_device_name', 'backup_start_date', 'type', 'Size MB'],
                rows: [
                    ['Production_CRM', 'S:\\Backups\\Full\\CRM_Full.bak', '2023-11-01 01:00:00', 'D', 4500.50],
                    ['Production_CRM', 'S:\\Backups\\Log\\CRM_Log_06.trn', '2023-11-01 06:00:00', 'L', 12.20],
                    ['Production_CRM', 'S:\\Backups\\Diff\\CRM_Diff.bak', '2023-11-01 12:00:00', 'I', 45.80],
                    ['Master', 'C:\\SystemDBs\\Master.bak', '2023-10-31 23:00:00', 'D', 1.50]
                ],
                rowCount: 4,
                executionTimeMs: 120,
                timestamp: Date.now()
            };
          }

          if (lowerSql.includes('sys.dm_db_index_physical_stats') || lowerSql.includes('avg_fragmentation_in_percent')) {
              return {
                  columns: ['TableName', 'IndexName', 'Frag%', 'AlterStatement'],
                  rows: [
                      ['SalesOrderHeader', 'PK_SalesOrderHeader', 45.2, 'ALTER INDEX [PK_SalesOrderHeader] ON [SalesOrderHeader] REBUILD'],
                      ['Customer', 'IX_AccountNumber', 22.8, 'ALTER INDEX [IX_AccountNumber] ON [Customer] REORGANIZE'],
                      ['Product', 'IX_ProductNumber', 38.1, 'ALTER INDEX [IX_ProductNumber] ON [Product] REBUILD']
                  ],
                  rowCount: 3,
                  executionTimeMs: 280,
                  timestamp: Date.now()
              };
          }

          if (lowerSql.includes('sys.dm_os_wait_stats')) {
              return {
                columns: ['wait_type', 'Wait (sec)', 'Resource Wait', 'Signal Wait (CPU)'],
                rows: [
                    ['LCK_M_IX', 5420.5, 5000.0, 420.5],
                    ['PAGEIOLATCH_SH', 3200.1, 3200.1, 0.0],
                    ['CXPACKET', 1200.0, 100.0, 1100.0]
                ],
                rowCount: 3,
                executionTimeMs: 50,
                timestamp: Date.now()
              }
          }

          if (lowerSql.includes('sys.configurations')) {
             return {
                 columns: ['name', 'value', 'value_in_use', 'description'],
                 rows: [
                     ['max server memory (MB)', 2147483647, 16000, 'Maximum size of server memory (MB)'],
                     ['cost threshold for parallelism', 5, 5, 'Threshold above which SQL Server creates parallel plans'], // Intentionally low to trigger warning
                     ['max degree of parallelism', 0, 0, 'Maximum number of processors used for parallel execution'], // Intentionally 0 to trigger warning
                     ['optimize for ad hoc workloads', 0, 0, 'Plan cache optimization'] // Intentionally 0
                 ],
                 rowCount: 4,
                 executionTimeMs: 15,
                 timestamp: Date.now()
             }
          }

          if (lowerSql.includes('ring_buffer_connectivity')) {
             return {
                 columns: ['Time', 'Type', 'Spid', 'Error'],
                 rows: [], // Simulating clean health
                 rowCount: 0,
                 executionTimeMs: 80,
                 timestamp: Date.now()
             }
          }

          // Fallback for generic SQL Server queries
          if (lowerSql.includes('sys.tables')) {
             return { columns: ['name'], rows: [['SalesOrderHeader'], ['Customer'], ['Product']], rowCount: 3, executionTimeMs: 10, timestamp: Date.now() };
          }
      }

      // --- POSTGRES DETECTORS (pg_, information_schema) ---
      if (lowerSql.includes('pg_') || lowerSql.includes('information_schema') || lowerSql.includes('blocking_tree')) {
      
          if (lowerSql.includes('blocking_tree')) {
            return {
                columns: ['Tree PID', 'state', 'Age', 'SQL Text', 'Investigate'],
                rows: [
                    ['1422', 'active', '00:00:12.4', 'BEGIN; UPDATE inventory SET stock = 0 WHERE id = 5;', 'ACTION_INVESTIGATE'],
                    ['  1899', 'active', '00:00:05.1', 'UPDATE inventory SET stock = 10 WHERE id = 5;', 'ACTION_INVESTIGATE']
                ],
                rowCount: 2,
                executionTimeMs: 120,
                timestamp: Date.now()
            };
          }

          if (lowerSql.includes('datfrozenxid')) {
            return {
                columns: ['datname', 'XID Age', '% to Critical Limit'],
                rows: [
                    ['production_db', 1250442100, 58.21],
                    ['analytics_db', 120400, 0.01],
                    ['postgres', 4500, 0.00]
                ],
                rowCount: 3,
                executionTimeMs: 110,
                timestamp: Date.now()
            };
          }

          if (lowerSql.includes('pg_stat_database')) {
             return {
                columns: ['datname', 'Hit Ratio %', 'Commits', 'Rollbacks'],
                rows: [['production_db', 99.85, 150400, 23], ['postgres', 99.99, 500, 0]],
                rowCount: 2,
                executionTimeMs: 40,
                timestamp: Date.now()
             };
          }
          
          if (lowerSql.includes('pg_database_size')) {
             return {
                columns: ['Database', 'Pretty Size', 'Bytes'],
                rows: [['production_db', '45 GB', 48318382080], ['postgres', '12 MB', 12582912]],
                rowCount: 2,
                executionTimeMs: 35,
                timestamp: Date.now()
             }
          }

          if (lowerSql.includes('pg_settings')) {
              return {
                  columns: ['name', 'setting', 'unit', 'short_desc'],
                  rows: [
                      ['max_connections', '40', null, 'Sets the maximum number of concurrent connections.'], // Low to trigger warning
                      ['shared_buffers', '16384', '8kB', 'Sets the number of shared memory buffers used by the server.'],
                      ['work_mem', '4096', 'kB', 'Sets the maximum memory to be used for query workspaces.'],
                      ['autovacuum', 'off', null, 'Automated vacuuming.'] // Off to trigger critical warning
                  ],
                  rowCount: 4,
                  executionTimeMs: 12,
                  timestamp: Date.now()
              }
          }

          if (lowerSql.includes('pg_extension')) {
              return {
                  columns: ['extname', 'extversion'],
                  rows: [['plpgsql', '1.0'], ['pg_stat_statements', '1.9'], ['uuid-ossp', '1.1']],
                  rowCount: 3,
                  executionTimeMs: 8,
                  timestamp: Date.now()
              }
          }
      }

      // --- GENERIC / DEFAULT DATA ---
      if (lowerSql.includes('select')) {
         const rowCount = 20;
         return {
             columns: ['id', 'name', 'status', 'created_at'],
             rows: Array.from({length: rowCount}, (_, i) => [i, `Item ${i}`, i % 2 === 0 ? 'active' : 'inactive', '2023-01-01']),
             rowCount,
             executionTimeMs: 120,
             timestamp: Date.now()
         };
      }
      
      return {
          columns: [], rows: [], rowCount: 0, executionTimeMs: 50, timestamp: Date.now()
      };
  }

  async getSchema(dbId: string): Promise<DbSchema> {
      if (dbId === 'db-mssql') {
          return {
              tables: [
                {
                    name: 'SalesOrderHeader',
                    columns: [
                        { name: 'SalesOrderID', type: 'int', isPrimaryKey: true, isForeignKey: false },
                        { name: 'OrderDate', type: 'datetime', isPrimaryKey: false, isForeignKey: false },
                        { name: 'CustomerID', type: 'int', isPrimaryKey: false, isForeignKey: true, references: { table: 'Customer', column: 'CustomerID' } },
                        { name: 'TotalDue', type: 'money', isPrimaryKey: false, isForeignKey: false }
                    ]
                }
              ]
          };
      }

      // Simulate a table without PK for Advisor Audit
      return {
          tables: [
              {
                  name: 'users',
                  columns: [
                      { name: 'id', type: 'uuid', isPrimaryKey: true, isForeignKey: false },
                      { name: 'email', type: 'varchar', isPrimaryKey: false, isForeignKey: false }
                  ]
              },
              {
                  name: 'audit_log_heap',
                  columns: [
                      { name: 'event_id', type: 'uuid', isPrimaryKey: false, isForeignKey: false }, // No PK!
                      { name: 'payload', type: 'text', isPrimaryKey: false, isForeignKey: false }
                  ]
              }
          ]
      };
  }
}
