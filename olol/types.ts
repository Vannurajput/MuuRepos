
import { DbaInsight, DbDialect } from './services/dialects/SqlDialects';

export interface CredentialEntry {
  id: string;
  connectionName: string;
  dbType?: string;
  host?: string;
  user?: string;
  [key:string]: any;
}

export interface Database {
  id: string;
  name: string;
  type: DbDialect;
  connectionString?: string;
}

export interface DbStats {
  tableCount: number;
  columnCount: number;
  pkCount: number;
  fkCount: number;
  indexCount: number;
  engineVersion?: string;
}

export interface QueryResult {
  columns: string[];
  rows: any[][];
  executionTimeMs: number;
  rowCount: number;
  error?: string;
  timestamp: number;
  rawJson?: any; 
}

export interface DbaHistoryRecord {
  id: string;
  dbId: string;
  dbName: string;
  insightId: string;
  insightTitle: string;
  timestamp: number;
  data: QueryResult;
}

export interface EditorTab {
  id: string;
  title: string;
  content: string;
  isDirty: boolean;
  isExecuting: boolean;
  results: QueryResult[]; 
  activeResultIndex: number; 
  linkedChartId?: string; 
}

export interface AppSettings {
  editorFontSize: number;
  themeAccent: 'blue' | 'purple' | 'green' | 'orange';
  refreshRate: number; 
  customInsights?: Partial<Record<DbDialect, DbaInsight[]>>;
}

export interface PinnedChart {
  id: string;
  title: string;
  query: string;
  dbId: string;
  config: ChartConfig;
  createdAt: number;
}

export type ChartType = 'bar' | 'line' | 'area' | 'scatter' | 'radar' | 'pie';

export interface ChartConfig {
  type: ChartType;
  xAxisKey: string;
  dataKeys: string[];
  stackId?: string; 
}

export interface SavedQuery {
  id: string;
  name: string;
  content: string;
  dbId?: string;
  createdAt: number;
}

export interface DashboardLayout {
  id: string;
  title: string;
  rows: DashboardRow[];
  isDefault: boolean;
}

export interface DashboardRow {
  id: string;
  widgets: DashboardWidget[];
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'markdown';
  title?: string;
  colSpan: number; 
  content: string; 
}

export interface DbSchema {
  tables: TableDefinition[];
}

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
}

export interface ColumnDefinition {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export interface SchemaLayout {
  id: string;
  name: string;
  dbId: string;
  tables: string[]; 
  createdAt: number;
}

export interface DbEngine {
  init(): Promise<void>;
  executeQuery(dbId: string, sql: string): Promise<QueryResult>;
  getSchema(dbId: string): Promise<DbSchema>;
  getStats?(dbId: string): Promise<DbStats>;
}
