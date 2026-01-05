
import { DbDialect } from './dialects/SqlDialects';
import { DbSchema } from '../types';

export interface AdvisorResult {
  id: string;
  category: 'Configuration' | 'Schema' | 'Security';
  severity: 'Critical' | 'Warning' | 'Pass';
  title: string;
  message: string;
  recommendation?: string;
}

export class DbaAdvisorService {

  public auditConfiguration(dialect: DbDialect, configRows: any[]): AdvisorResult[] {
    const results: AdvisorResult[] = [];
    if (!configRows || configRows.length === 0) return results;

    // --- MSSQL Rules ---
    if (dialect === 'mssql') {
      configRows.forEach(row => {
        const name = row['name']?.toLowerCase() || '';
        const value = Number(row['value_in_use'] || row['value']);

        if (name === 'cost threshold for parallelism') {
          if (value < 15) {
            results.push({
              id: 'ms-cost-threshold', category: 'Configuration', severity: 'Warning',
              title: 'Low Parallelism Threshold',
              message: `Current Cost Threshold is ${value}. Default (5) is often too low for modern CPUs.`,
              recommendation: 'Increase to 25-50 to prevent tiny queries from going parallel.'
            });
          } else {
            results.push({ id: 'ms-cost-threshold-ok', category: 'Configuration', severity: 'Pass', title: 'Parallelism Threshold', message: 'Value is within modern standards.' });
          }
        }

        if (name === 'optimize for ad hoc workloads') {
           if (value === 0) {
             results.push({
               id: 'ms-optimize-adhoc', category: 'Configuration', severity: 'Warning',
               title: 'Ad Hoc Optimization Disabled',
               message: 'Plan cache may be bloated with single-use plans.',
               recommendation: 'Enable "optimize for ad hoc workloads" (set to 1).'
             });
           }
        }

        if (name === 'max degree of parallelism') {
           if (value === 0) {
             results.push({
               id: 'ms-maxdop', category: 'Configuration', severity: 'Warning',
               title: 'Unbounded MaxDOP',
               message: 'MaxDOP is 0 (unlimited). Queries may consume all CPU cores.',
               recommendation: 'Set MaxDOP to 8 or the number of physical cores per NUMA node.'
             });
           }
        }
      });
    }

    // --- Postgres Rules ---
    if (dialect === 'postgres') {
       const rowMap: Record<string, string> = {};
       configRows.forEach(row => { rowMap[row.name] = row.setting; });

       if (rowMap['autovacuum'] === 'off') {
         results.push({
            id: 'pg-autovacuum', category: 'Configuration', severity: 'Critical',
            title: 'Autovacuum Disabled',
            message: 'Autovacuum is turned off. This will lead to severe table bloat and XID wraparound failure.',
            recommendation: 'Enable autovacuum immediately.'
         });
       } else if (rowMap['autovacuum']) {
         results.push({ id: 'pg-autovacuum-ok', category: 'Configuration', severity: 'Pass', title: 'Autovacuum Enabled', message: 'System is maintaining itself.' });
       }

       if (rowMap['max_connections'] && Number(rowMap['max_connections']) < 50) {
          results.push({
             id: 'pg-conn-limit', category: 'Configuration', severity: 'Warning',
             title: 'Low Connection Limit',
             message: `Max connections is only ${rowMap['max_connections']}.`,
             recommendation: 'Verify if this is intended for a production system.'
          });
       }
    }

    return results;
  }

  public auditSchema(schema: DbSchema): AdvisorResult[] {
    const results: AdvisorResult[] = [];
    if (!schema || !schema.tables) return results;

    schema.tables.forEach(table => {
      // Rule 1: Missing Primary Key (Heap)
      const hasPk = table.columns.some(c => c.isPrimaryKey);
      if (!hasPk) {
        results.push({
          id: `schema-nopk-${table.name}`,
          category: 'Schema',
          severity: 'Critical',
          title: `Heap Table Detected: ${table.name}`,
          message: `Table "${table.name}" has no Primary Key. Updates/Deletes will be slow and replication may fail.`,
          recommendation: `ALTER TABLE "${table.name}" ADD PRIMARY KEY ...`
        });
      }

      // Rule 2: Wide Columns (heuristic)
      const wideCols = table.columns.filter(c => c.type && (c.type.includes('max') || c.type.includes('text') || c.type.includes('blob')));
      if (wideCols.length > 2) {
         results.push({
           id: `schema-wide-${table.name}`,
           category: 'Schema',
           severity: 'Warning',
           title: `Wide Table: ${table.name}`,
           message: `Contains ${wideCols.length} LOB/Text columns. This may impact memory grants and buffer cache.`,
           recommendation: 'Consider vertical partitioning or moving BLOBS to object storage.'
         });
      }
    });

    if (results.length === 0 && schema.tables.length > 0) {
       results.push({ id: 'schema-ok', category: 'Schema', severity: 'Pass', title: 'Schema Hygiene', message: 'No obvious anti-patterns detected in mapped tables.' });
    }

    return results;
  }
}

export const dbaAdvisorService = new DbaAdvisorService();
