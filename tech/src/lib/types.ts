
export interface MoTextState {
  projects: Project[];
  files: FileTab[];
  activeProjectId: number | null;
  openFileIds: number[];
  history: ProjectHistoryEvent[];
  snapshots: ProjectSnapshot[];
  uiSettings: UISettings;
}

export interface MoTextProps {
  initialData?: MoTextState;
  onSave?: (data: MoTextState) => void;
}

export interface FileTab {
  id: number;
  projectId: number;
  name: string; // Now represents the full path, e.g. "src/components/button.js"
  content: string; // Text content, or base64 data URL for images
  language: string;
  isDirty?: boolean;
  isBinary?: boolean; // For non-text files like images
  mimeType?: string; // e.g. 'image/png', 'application/octet-stream'
  createdAt: number;
  modifiedAt: number;
}

export interface Project {
  id: number;
  name: string;
}

export interface EditorState {
  line: number;
  column: number;
  charCount: number;
  selectionLength: number;
}

export interface ContextMenuState {
  x: number;
  y: number;
  fileId: number;
  visible: boolean;
}

export interface FileContextMenuState {
  x: number;
  y: number;
  targetId: number | string; // file ID or folder path
  targetType: 'file' | 'folder';
  visible: boolean;
  path: string; // full path of the folder or file
}

export interface UISettings {
  menuPosition: 'top' | 'left';
  isAdvancedMode: boolean;
  isInlineSuggestionEnabled: boolean;
  isAutoSaveEnabled: boolean;
  previewMode: boolean;
  isDebugModeEnabled: boolean;
}

export interface FindState {
  isVisible: boolean;
  searchTerm: string;
  replaceTerm: string;
  isCaseSensitive: boolean;
  isWholeWord: boolean;
  isRegex: boolean;
  lastResultIndex: number | null;
}

export type WhitespaceVisibility = 'none' | 'all';

// --- Language & Autocomplete Types ---

export interface FoldableRegion {
  startLine: number;
  endLine: number;
}

export interface LanguageSupport {
  id: string;
  name: string;
  aliases?: string[];
  keywords?: string[];
  isVisual?: boolean; // Can this language be rendered (e.g., HTML, SVG)?
  autoClosePairs?: [string, string][];
  onEnter?: (line: string, indent: string) => { indent: string; append?: string };
  onOpenTag?: (tagName: string) => string;
  getFoldableRegions?: (code: string) => FoldableRegion[];
}

export interface Snippet {
  label: string;       // e.g., 'for-loop'
  detail: string;      // e.g., 'For Loop'
  code: string;        // The actual code snippet
}

export interface AutocompleteState {
  visible: boolean;
  x: number;
  y: number;
  suggestions: (string | Snippet)[];
  activeIndex: number;
  wordFragment: string;
}

export interface InlineSuggestionState {
  text: string;
  wordFragment: string;
  startPos: number;
}

export interface SuggestionContext {
  textBeforeCursor: string;
  currentWord: string;
}

export interface LanguageAdapter {
  getSuggestions(context: SuggestionContext): Promise<(string | Snippet)[]>;
}

export interface Version {
  timestamp: number;
  content: string;
}

export interface EditorPane {
  id: number;
  fileId: number | null;
}

export interface ProjectHistoryEvent {
  timestamp: number;
  type: 'create' | 'delete' | 'move' | 'rename' | 'create_folder' | 'delete_folder';
  details: string;
}

export interface ProjectSnapshot {
  id: number; // timestamp
  name: string;
  data: FileTab[];
}

// --- Analysis Types ---

export interface FunctionDetail {
  name: string;
  params: string;
  type: 'function' | 'arrow' | 'method';
}

export interface VariableDetail {
  name: string;
  type: 'const' | 'let' | 'var' | 'class';
}

export interface DomSelector {
  method: 'getElementById' | 'querySelector' | 'querySelectorAll';
  selector: string;
}

export interface CssSelector {
  type: 'id' | 'class' | 'animation';
  name: string;
}

export interface HtmlElement {
  tag: string;
  id?: string;
  classes?: string[];
}

export interface CodeSummary {
  commentLineCount: number;
  totalLines: number;
  charCount: number;
  functionCount?: number;
  classCount?: number;
  variableCount?: number;
  importCount?: number;
  domSelectorCount?: number;
  cssSelectorCount?: number;
  htmlElementCount?: number;
}

export interface AnalysisResult {
  summary: CodeSummary | null;
  references: string[];
  // New detailed fields
  functions?: FunctionDetail[];
  variables?: VariableDetail[];
  domSelectors?: DomSelector[];
  cssSelectors?: CssSelector[];
  htmlElements?: HtmlElement[];
}


export interface FileAnalysis {
  fileName: string;
  analysisResult: AnalysisResult;
}
export interface ProjectAnalysisReport {
  overviewMarkdown: string;
  fileAnalyses: FileAnalysis[];
}

// --- Deep Analysis Types ---

export interface SymbolDefinition {
  symbol: string;
  type: 'function' | 'class' | 'const' | 'let' | 'var' | 'id' | 'animation';
  line: number;
  algorithm?: string;
}

export interface CrossReference {
  // File where the symbol is USED
  sourceFile: string;
  // File where the symbol is DEFINED
  targetFile: string;
  symbol: string;
  // line in the sourceFile where the symbol is used
  line: number;
}

export interface DeepFileAnalysis {
  fileName: string;
  // Symbols this file DEFINES
  definitions: SymbolDefinition[];
  // Symbols from OTHER files that this file USES
  usages: CrossReference[];
}

export interface DeepAnalysisReport {
  summary: {
    totalFiles: number;
    jsFiles: number;
    cssFiles: number;
    htmlFiles: number;
    otherFiles: number;
    totalCrossReferences: number;
  };
  // A map for definitions: key is symbol name, value is where it's defined.
  symbolDefinitions: { [symbol: string]: { file: string, line: number, type: 'js' | 'css', jsType: SymbolDefinition['type'], algorithm?: string } };
  // A map for quick lookup: key is symbol name, value is list of files using it.
  symbolUsage: { [symbol: string]: { file: string, line: number }[] };
  // A file-centric breakdown for individual tabs
  fileAnalyses: DeepFileAnalysis[];
}

// --- Project Search Types ---
export interface SearchResult {
  fileName: string;
  lineNumber: number;
  lineContent: string;
}

export interface ProjectSearchState {
  isActive: boolean;
  query: string;
  results: SearchResult[];
  include: string;
  exclude: string;
  isCaseSensitive: boolean;
  isWholeWord: boolean;
  isSearching: boolean;
}

// --- Git Types ---
export interface GitConfig {
  url: string;
  corsProxy: string;
  authorName: string;
  authorEmail: string;
  token: string;
}

export interface GitFileStatus {
  filepath: string;
  status: string;
}

export type GitProcessingAction = 'none' | 'pull' | 'push' | 'commit' | 'status';
export interface GitState {
  status: GitFileStatus[];
  processingAction: GitProcessingAction;
  processingMessage: string | null;
}

// --- Data Viewer Types ---
export interface TableSchema {
  name: string;
  columns: { name: string; type: string }[];
}

export interface QueryResult {
  columns: string[];
  values: any[][];
}

// --- Test Runner Types ---
export interface TestCaseResult {
  name: string;
  passed: boolean;
  error?: string;
}
export interface TestSuiteResult {
  suiteName: string;
  fileName: string;
  tests: TestCaseResult[];
  passed: boolean;
  error?: string; // For errors outside of an 'it' block
}
export interface TestResult {
  suites: TestSuiteResult[];
  stats: {
    total: number;
    passed: number;
    failed: number;
  };
}


declare global {
  interface Window {
    monaco: any;
    hljs: any;
    marked: any;
    prettier: any;
    prettierPlugins: any;
    'sql-wasm.js': any;
    initSqlJs: any;
    duckdb: any;
  }
}
