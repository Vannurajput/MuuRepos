
export type DbDialect = 'postgres' | 'mysql' | 'sqlite' | 'mssql' | 'parquet' | 'mongodb';

export type InsightCategory = 
  'Performance' | 'Storage' | 'Indexes' | 'Fragmentation' | 
  'Expensive Queries' | 'System' | 'Locks' | 'Wait Stats' | 
  'Processes' | 'Backups' | 'Maintenance' | 'Server Parameters' | 'Security' | 'Configuration';

export interface DbaInsight {
  id: string;
  category: InsightCategory;
  context: 'server' | 'database';
  title: string;
  description: string;
  query: string;
  minVersion?: string;
  impact: 'High' | 'Medium' | 'Low';
}

export interface DialectDefinition {
  version: string;
  queries: {
    getTables: string;
    getColumns: (tableName: string) => string;
    getForeignKeys: (tableName: string) => string;
  };
  management: {
    killSession: (id: string) => string;
    reindexTable: (table: string) => string;
  };
  insights: DbaInsight[];
}

// --- CENTRALIZED CONFIGURATION STORE ---
export const DIALECT_CONFIG_STORE: Record<DbDialect, DialectDefinition> = {
  postgres: {
    version: '2.5.0-stable',
    queries: {
      getTables: `SELECT table_name AS "name" FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
      getColumns: (table) => `
        SELECT 
          c.column_name AS "name", 
          c.data_type AS "type", 
          (SELECT COUNT(*) > 0 FROM information_schema.table_constraints tc 
           JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name 
           WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name='${table}' AND kcu.column_name=c.column_name) as "pk" 
        FROM information_schema.columns c 
        WHERE c.table_name = '${table}' AND c.table_schema = 'public'
        ORDER BY c.ordinal_position`,
      getForeignKeys: (table) => `
        SELECT 
          kcu.column_name AS "from", 
          ccu.table_name AS "table", 
          ccu.column_name AS "to" 
        FROM information_schema.key_column_usage AS kcu 
        JOIN information_schema.table_constraints AS tc ON kcu.constraint_name = tc.constraint_name 
        JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name 
        WHERE tc.constraint_type = 'FOREIGN KEY' AND kcu.table_name = '${table}' AND kcu.table_schema = 'public'`,
    },
    management: {
      killSession: (pid) => `SELECT pg_terminate_backend(${pid});`,
      reindexTable: (table) => `VACUUM ANALYZE "${table}"; REINDEX TABLE "${table}";`
    },
    insights: [
      // --- POSTGRES SPECIFIC ---
      { id: 'pg-conn-overview', context: 'server', category: 'System', title: 'Connection State Overview', description: 'Count of connections grouped by state (active, idle, etc).', query: `SELECT state, count(*) as "Count", pg_size_pretty(sum(pg_backend_memory_allocated())) as "Mem Alloc" FROM pg_stat_activity GROUP BY 1 ORDER BY 2 DESC;`, impact: 'Medium' },
      { id: 'pg-storage', context: 'server', category: 'Storage', title: 'Database Disk Usage', description: 'Physical disk space occupied by each database.', query: 'SELECT datname AS "Database", pg_size_pretty(pg_database_size(datname)) AS "Pretty Size", pg_database_size(datname) AS "Bytes" FROM pg_database ORDER BY 3 DESC;', impact: 'Medium' },
      { id: 'pg-io-stats', context: 'server', category: 'Performance', title: 'I/O Cache Hit Ratio', description: 'Critical metric: % of reads found in memory (should be > 99%).', query: 'SELECT datname, round(100 * blks_hit / (blks_hit + blks_read + 1), 2) AS "Hit Ratio %", xact_commit AS "Commits", xact_rollback AS "Rollbacks" FROM pg_stat_database ORDER BY 2 ASC;', impact: 'High' },
      { id: 'pg-wait-topology', context: 'server', category: 'Wait Stats', title: 'Wait Event Distribution', description: 'Identifies current session bottlenecks (Lock vs IO vs CPU).', query: 'SELECT wait_event_type, wait_event, count(*) as "Active Sessions" FROM pg_stat_activity WHERE state = \'active\' AND wait_event IS NOT NULL GROUP BY 1, 2 ORDER BY 3 DESC;', impact: 'High' },
      { id: 'pg-block-tree', context: 'server', category: 'Locks', title: 'Recursive Blocking Tree', description: 'Visualizes the chain of blocked PIDs and the head root blocker.', query: `
        WITH RECURSIVE blocking_tree AS (
          SELECT pid, NULL::integer AS blocking_pid, ARRAY[pid] AS path, query, wait_event_type, state, now() - xact_start as duration
          FROM pg_stat_activity
          WHERE pid IN (SELECT DISTINCT(unnest(pg_blocking_pids(pid))) FROM pg_stat_activity)
            AND (pg_blocking_pids(pid) = '{}' OR pg_blocking_pids(pid) IS NULL)
          UNION ALL
          SELECT a.pid, (pg_blocking_pids(a.pid))[1] AS blocking_pid, bt.path || a.pid, a.query, a.wait_event_type, a.state, now() - a.xact_start
          FROM pg_stat_activity a
          JOIN blocking_tree bt ON (pg_blocking_pids(a.pid))[1] = bt.pid
          WHERE NOT a.pid = ANY(bt.path)
        )
        SELECT repeat('  ', array_length(path, 1) - 1) || pid AS "Tree PID", state, duration AS "Age", query AS "SQL Text", 'ACTION_INVESTIGATE' AS "Investigate" FROM blocking_tree;`, impact: 'High' },
      { id: 'pg-long-running', context: 'server', category: 'Expensive Queries', title: 'Long Running Queries', description: 'Queries running longer than 5 minutes.', query: `SELECT pid, user, pg_stat_activity.datname, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE pg_stat_activity.query_start < (now() - '5 minutes'::interval) AND state = 'active' ORDER BY duration DESC;`, impact: 'High' },
      { id: 'pg-xid-wraparound', context: 'server', category: 'Maintenance', title: 'XID Wraparound Risk', description: 'Monitors transaction ID age to prevent forced read-only mode.', query: 'SELECT datname, age(datfrozenxid) AS "XID Age", round(age(datfrozenxid)::numeric / 2147483647 * 100, 2) AS "% to Critical Limit" FROM pg_database WHERE datallowconn ORDER BY 2 DESC;', impact: 'High' },
      { id: 'pg-index-bloat', context: 'database', category: 'Indexes', title: 'Unused Indexes', description: 'Indexes that are rarely used but consume write overhead.', query: 'SELECT schemaname, relname AS "Table", indexrelname AS "Index", pg_size_pretty(pg_relation_size(i.indexrelid)) AS "Size", idx_scan AS "Scans" FROM pg_stat_user_indexes i JOIN pg_index USING (indexrelid) WHERE idx_scan < 50 AND indisunique IS FALSE ORDER BY pg_relation_size(i.indexrelid) DESC LIMIT 20;', impact: 'Medium' },
      { id: 'pg-table-stats', context: 'database', category: 'Storage', title: 'Table Size & Tuple Stats', description: 'Dead tuples ratio indicates need for VACUUM.', query: `SELECT relname AS "Table", pg_size_pretty(pg_total_relation_size(relid)) AS "Total Size", n_live_tup AS "Live Rows", n_dead_tup AS "Dead Rows", round(n_dead_tup::numeric / (n_live_tup + n_dead_tup + 1) * 100, 2) AS "Dead Ratio %" FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 20;`, impact: 'Medium' },
      { id: 'pg-settings', context: 'server', category: 'Configuration', title: 'Important Settings', description: 'Key performance configuration parameters.', query: `SELECT name, setting, unit, short_desc FROM pg_settings WHERE name IN ('max_connections', 'shared_buffers', 'work_mem', 'maintenance_work_mem', 'effective_cache_size', 'wal_buffers', 'autovacuum');`, impact: 'Medium' },
      { id: 'pg-extensions', context: 'database', category: 'Configuration', title: 'Installed Extensions', description: 'List of extensions installed in the current database.', query: `SELECT extname, extversion FROM pg_extension ORDER BY extname;`, impact: 'Low' }
    ]
  },
  mssql: {
    version: '1.9.0-stable',
    queries: {
      getTables: `SELECT name AS "name" FROM sys.tables WHERE is_ms_shipped = 0 ORDER BY name`,
      getColumns: (table) => `
        SELECT 
          c.name AS "name", 
          TYPE_NAME(c.system_type_id) as "type", 
          CONVERT(bit, i.is_primary_key) as "pk" 
        FROM sys.columns c 
        LEFT JOIN sys.index_columns ic ON ic.object_id = c.object_id AND ic.column_id = c.column_id 
        LEFT JOIN sys.indexes i ON i.object_id = c.object_id AND i.index_id = ic.index_id AND i.is_primary_key = 1 
        WHERE c.object_id = OBJECT_ID('${table}')
        ORDER BY c.column_id`,
      getForeignKeys: (table) => `
        SELECT 
          cpa.name AS "from", 
          OBJECT_NAME(f.referenced_object_id) AS "table", 
          cpr.name AS "to" 
        FROM sys.foreign_keys AS f 
        INNER JOIN sys.foreign_key_columns AS fc ON f.object_id = fc.constraint_object_id 
        INNER JOIN sys.columns AS cpa ON fc.parent_object_id = cpa.object_id AND fc.parent_column_id = cpa.column_id 
        INNER JOIN sys.columns AS cpr ON fc.referenced_object_id = cpr.object_id AND fc.referenced_column_id = cpr.column_id 
        WHERE f.parent_object_id = OBJECT_ID('${table}')`,
    },
    management: {
      killSession: (spid) => `KILL ${spid};`,
      reindexTable: (table) => `ALTER INDEX ALL ON [${table}] REBUILD;`
    },
    insights: [
      // --- SQL SERVER SPECIFIC ---
      { id: 'ms-disk-usage', context: 'server', category: 'Storage', title: 'File & Drive Space', description: 'Allocation of physical files (.mdf/.ldf) across OS drives.', query: 'SELECT DB_NAME(database_id) AS [Database], name AS [Logical Name], physical_name AS [Path], size * 8 / 1024 AS [Size MB], CAST(FILEPROPERTY(name, \'SpaceUsed\') AS INT) * 8 / 1024 AS [Used MB] FROM sys.master_files ORDER BY [Size MB] DESC;', impact: 'Medium' },
      { id: 'ms-io-perf', context: 'server', category: 'Performance', title: 'Virtual File I/O Latency', description: 'Detailed read/write latency and stall metrics per file.', query: 'SELECT DB_NAME(vfs.database_id) AS [DB], mf.name AS [File], num_of_reads AS [Reads], num_of_writes AS [Writes], io_stall_read_ms AS [Read Stall ms], io_stall_write_ms AS [Write Stall ms], CAST(1.0 * io_stall / (num_of_reads + num_of_writes + 1) AS DECIMAL(10,2)) AS [Avg Stall ms] FROM sys.dm_io_virtual_file_stats(NULL, NULL) vfs JOIN sys.master_files mf ON vfs.database_id = mf.database_id AND vfs.file_id = mf.file_id ORDER BY [Avg Stall ms] DESC;', impact: 'High' },
      { id: 'ms-cpu-hogs', context: 'server', category: 'Expensive Queries', title: 'Top CPU Consumers', description: 'Queries consuming the most CPU time from cached plans.', query: 'SELECT TOP 10 st.text AS [SQL], qs.total_worker_time AS [Total CPU], qs.execution_count AS [Execs], qs.total_worker_time/qs.execution_count AS [Avg CPU] FROM sys.dm_exec_query_stats qs CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st ORDER BY qs.total_worker_time DESC;', impact: 'High' },
      { id: 'ms-wait-stats', context: 'server', category: 'Wait Stats', title: 'Wait Resource Profile', description: 'Compares Signal (CPU) vs Resource (IO/Memory) waits.', query: 'SELECT TOP 10 wait_type, wait_time_ms / 1000.0 AS "Wait (sec)", (wait_time_ms - signal_wait_time_ms) / 1000.0 AS "Resource Wait", signal_wait_time_ms / 1000.0 AS "Signal Wait (CPU)" FROM sys.dm_os_wait_stats WHERE wait_type NOT IN (\'SLEEP_TASK\', \'BROKER_RECEIVE_WAITFOR\', \'CHECKPOINT_QUEUE\', \'REQUEST_FOR_DEADLOCK_SEARCH\') ORDER BY wait_time_ms DESC;', impact: 'High' },
      { id: 'ms-buffer-cache', context: 'server', category: 'Performance', title: 'Buffer Pool Usage', description: 'Memory consumption per database.', query: 'SELECT DB_NAME(database_id) AS [Database], COUNT(*) * 8 / 1024 AS [Cache MB] FROM sys.dm_os_buffer_descriptors GROUP BY database_id ORDER BY [Cache MB] DESC;', impact: 'Medium' },
      { id: 'ms-missing-idx', context: 'database', category: 'Indexes', title: 'Missing Index Recommendations', description: 'Indexes suggested by the query optimizer.', query: 'SELECT TOP 10 db_name(d.database_id) as [DB], s.avg_total_user_cost * s.avg_user_impact * (s.user_seeks + s.user_scans) as [Impact], \'CREATE INDEX [IX_MISSING_1] ON \' + d.statement + \' (\' + ISNULL(d.equality_columns,\'\') + CASE WHEN d.equality_columns IS NOT NULL AND d.inequality_columns IS NOT NULL THEN \',\' ELSE \'\' END + ISNULL(d.inequality_columns, \'\') + \')\' + ISNULL(\' INCLUDE (\' + d.included_columns + \')\', \'\') AS [Create Statement] FROM sys.dm_db_missing_index_group_stats s, sys.dm_db_missing_index_groups g, sys.dm_db_missing_index_details d WHERE s.group_handle = g.index_group_handle AND g.index_handle = d.index_handle ORDER BY [Impact] DESC;', impact: 'High' },
      { id: 'ms-backups', context: 'server', category: 'Backups', title: 'Backup History (Last 7 Days)', description: 'Checks recent backup completion status.', query: 'SELECT s.database_name, m.physical_device_name, s.backup_start_date, s.type, s.backup_size/1024/1024 as [Size MB] FROM msdb.dbo.backupset s INNER JOIN msdb.dbo.backupmediafamily m ON s.media_set_id = m.media_set_id WHERE s.backup_start_date > DATEADD(day, -7, GETDATE()) ORDER BY s.backup_start_date DESC;', impact: 'Low' },
      { id: 'ms-block-tree', context: 'server', category: 'Locks', title: 'Recursive Blocking Hierarchy', description: 'Full chain of SPID dependencies with wait resource hex IDs.', query: `
        WITH BlockingTree AS (
            SELECT r.session_id, r.blocking_session_id, r.wait_type, r.wait_resource, st.text AS [SQL], r.total_elapsed_time, 0 AS [Level], CAST(r.session_id AS VARCHAR(MAX)) AS [Path]
            FROM sys.dm_exec_requests r CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) st
            WHERE r.blocking_session_id = 0 AND r.session_id IN (SELECT blocking_session_id FROM sys.dm_exec_requests WHERE blocking_session_id <> 0)
            UNION ALL
            SELECT r.session_id, r.blocking_session_id, r.wait_type, r.wait_resource, st.text AS [SQL], r.total_elapsed_time, bt.[Level] + 1, bt.[Path] + ' > ' + CAST(r.session_id AS VARCHAR(MAX))
            FROM sys.dm_exec_requests r CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) st
            INNER JOIN BlockingTree bt ON r.blocking_session_id = bt.session_id
        )
        SELECT REPLICATE('--- ', [Level]) + CAST(session_id AS VARCHAR(10)) AS [SPID], total_elapsed_time AS [Duration ms], wait_type AS [Wait], wait_resource AS [Resource], [SQL], 'ACTION_INVESTIGATE' AS [Detective] FROM BlockingTree ORDER BY [Path];`, impact: 'High' },
      { id: 'ms-frag', context: 'database', category: 'Fragmentation', title: 'Index Maintenance HUD', description: 'Identifies high fragmentation with auto-generated REBUILD scripts.', query: `
        SELECT OBJECT_NAME(ips.object_id) AS [TableName], i.name AS [IndexName], ips.avg_fragmentation_in_percent AS [Frag%], 
        CASE WHEN ips.avg_fragmentation_in_percent > 30 THEN 'ALTER INDEX [' + i.name + '] ON [' + OBJECT_NAME(ips.object_id) + '] REBUILD'
        WHEN ips.avg_fragmentation_in_percent > 5 THEN 'ALTER INDEX [' + i.name + '] ON [' + OBJECT_NAME(ips.object_id) + '] REORGANIZE' ELSE '-- Healthy' END AS [AlterStatement]
        FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'DETAILED') ips JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
        WHERE ips.avg_fragmentation_in_percent > 5 ORDER BY ips.avg_fragmentation_in_percent DESC;`, impact: 'High' },
      { id: 'ms-config', context: 'server', category: 'Configuration', title: 'Server Configuration', description: 'Global server settings (Memory, Parallelism, etc).', query: 'SELECT name, value, value_in_use, description FROM sys.configurations ORDER BY name;', impact: 'Low' },
      { id: 'ms-logins', context: 'server', category: 'Security', title: 'Failed Logins (Recent)', description: 'Checks ring buffer for recent connectivity errors.', query: `SELECT record.value('(./Record/@time)[1]', 'bigint') AS [Time], record.value('(./Record/ConnectivityTraceRecord/RecordType)[1]', 'varchar(50)') AS [Type], record.value('(./Record/ConnectivityTraceRecord/Spid)[1]', 'int') AS [Spid], record.value('(./Record/ConnectivityTraceRecord/ErrorMessage)[1]', 'varchar(max)') AS [Error] FROM (SELECT CAST(record as xml) as record FROM sys.dm_os_ring_buffers WHERE ring_buffer_type = 'RING_BUFFER_CONNECTIVITY') AS x ORDER BY [Time] DESC;`, impact: 'Medium' }
    ]
  },
  mysql: {
    version: '1.2.0',
    queries: {
      getTables: `SELECT table_name AS "name" FROM information_schema.tables WHERE table_schema = DATABASE()`,
      getColumns: (table) => `DESCRIBE \`${table}\``,
      getForeignKeys: (table) => `SELECT K.COLUMN_NAME AS 'from', K.REFERENCED_TABLE_NAME AS 'table', K.REFERENCED_COLUMN_NAME AS 'to' FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS K WHERE K.TABLE_SCHEMA = SCHEMA() AND K.TABLE_NAME = '${table}' AND K.REFERENCED_TABLE_NAME IS NOT NULL;`,
    },
    management: {
      killSession: (id) => `KILL ${id};`,
      reindexTable: (table) => `OPTIMIZE TABLE \`${table}\`;`
    },
    insights: [
      { id: 'my-buffer', context: 'server', category: 'Performance', title: 'InnoDB Buffer Cache Efficiency', description: 'Ratio of memory reads vs disk reads.', query: 'SELECT (1 - (Variable_value / (SELECT Variable_value FROM information_schema.global_status WHERE Variable_name = "Innodb_buffer_pool_read_requests"))) * 100 AS "Hit Rate (%)" FROM information_schema.global_status WHERE Variable_name = "Innodb_buffer_pool_reads";', impact: 'High' },
      { id: 'my-connections', context: 'server', category: 'System', title: 'Connection Usage', description: 'Current open connections vs max allowed.', query: 'SELECT Variable_name, Variable_value FROM information_schema.global_status WHERE Variable_name IN ("Threads_connected", "Max_used_connections");', impact: 'Medium' }
    ]
  },
  sqlite: {
    version: '1.0.0',
    queries: {
      getTables: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      getColumns: (table) => `PRAGMA table_info("${table}")`,
      getForeignKeys: (table) => `PRAGMA foreign_key_list("${table}")`,
    },
    management: {
      killSession: () => `-- SQLite does not support killing sessions remotely`,
      reindexTable: (table) => `REINDEX "${table}";`
    },
    insights: [
      { id: 'sq-integrity', context: 'database', category: 'Maintenance', title: 'Integrity Check', description: 'Physical page scan for database corruption.', query: 'PRAGMA integrity_check;', impact: 'High' },
      { id: 'sq-freelist', context: 'database', category: 'Storage', title: 'Unused (Free) Pages', description: 'Pages ready for reuse. High counts suggest VACUUM is needed.', query: 'PRAGMA freelist_count;', impact: 'Low' },
      { id: 'sq-compile-ops', context: 'database', category: 'System', title: 'Compile Options', description: 'List of compile-time options used to build SQLite.', query: 'PRAGMA compile_options;', impact: 'Low' }
    ]
  },
  mongodb: {
    version: '1.0.0',
    queries: { getTables: "", getColumns: (table) => "", getForeignKeys: (table) => "" },
    management: {
       killSession: (id) => `db.killOp(${id})`,
       reindexTable: (coll) => `db.${coll}.reIndex()`
    },
    insights: [
      { id: 'mg-db-stats', context: 'database', category: 'Storage', title: 'Database Statistics', description: 'Detailed size and object counts.', query: 'db.stats()', impact: 'Low' },
      { id: 'mg-slow-ops', context: 'database', category: 'Expensive Queries', title: 'Slow Op Profiling', description: 'Operations exceeding 100ms from the profiler.', query: 'db.system.profile.find({millis: {$gt: 100}}).sort({ts: -1}).limit(10)', impact: 'High' },
      { id: 'mg-conn', context: 'server', category: 'System', title: 'Connection Status', description: 'Current active connections.', query: 'db.serverStatus().connections', impact: 'Medium' }
    ]
  },
  parquet: { version: '0.0.1', queries: { getTables: "", getColumns: (table) => "", getForeignKeys: (table) => "" }, management: { killSession: ()=>"", reindexTable: ()=>"" }, insights: [] }
};

// Export the Registry for backward compatibility usage in components
export const DialectRegistry = DIALECT_CONFIG_STORE;
