
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Database, EditorTab, QueryResult, ChartConfig, PinnedChart, DashboardLayout, AppSettings, SavedQuery, DbSchema, SchemaLayout, DbaHistoryRecord, TableDefinition, CredentialEntry, DbStats } from './types.ts';
import { muulService } from './services/muulService.ts';
import { logicalJoinService, LogicalRelation } from './services/logicalJoinService.ts';
import { DbaInsight, DbDialect, DialectRegistry } from './services/dialects/SqlDialects.ts';
import { detectMuulBrowser } from './services/muulBrowserDetect.ts';
import { fetchSavedCredentials } from './services/muulCredentials.ts';
import { 
  Play, Database as DbIcon, Activity, LayoutDashboard, TerminalSquare, Settings, 
  Bookmark, ShieldAlert, BrainCircuit, Wand2, Link2, Table as TableIcon, X, Network, Plus, Info,
  HardDrive, Activity as IoIcon, ListOrdered
} from 'lucide-react';
import SqlEditor, { SqlEditorRef } from './components/SqlEditor.tsx';
import ResultsPane from './components/ResultsPane.tsx';
import Dashboard from './components/Dashboard.tsx';
import SchemaVisualizer from './components/SchemaVisualizer.tsx';
import SettingsModal from './components/SettingsModal.tsx';
import DbaPanel from './components/DbaPanel.tsx';
import DbaPerformanceDashboard from './components/DbaPerformanceDashboard.tsx';
import SqlAlgoView from './components/SqlAlgoView.tsx';
import ProjectionModal from './components/ProjectionModal.tsx';
import JoinBuilderModal, { PendingJoin } from './components/JoinBuilderModal.tsx';
import DbPropertiesModal from './components/DbPropertiesModal.tsx';

type LayoutMode = 'bottom' | 'right' | 'left' | 'float';
type ViewMode = 'editor' | 'dashboard' | 'schema' | 'dba-perf';
type SidebarTab = 'db' | 'saved' | 'dba';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>('editor');
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('db');
  const [databases, setDatabases] = useState<Database[]>([]);
  const [savedCredentials, setSavedCredentials] = useState<CredentialEntry[]>([]);
  const [selectedDbId, setSelectedDbId] = useState<string>('');
  const [showAlgoView, setShowAlgoView] = useState(true);
  const [dbTables, setDbTables] = useState<Record<string, string[]>>({});
  const [activeSchema, setActiveSchema] = useState<DbSchema>({ tables: [] });
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isDraggingTable, setIsDraggingTable] = useState(false);
  const [selectedSidebarTables, setSelectedSidebarTables] = useState<Set<string>>(new Set());
  const [isJoinBuilderOpen, setIsJoinBuilderOpen] = useState(false);
  const [pendingJoins, setPendingJoins] = useState<PendingJoin[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Database Properties & Context Menu State
  const [dbPropertiesOpen, setDbPropertiesOpen] = useState(false);
  const [activeDbStats, setActiveDbStats] = useState<DbStats | null>(null);
  const [activeDbName, setActiveDbName] = useState('');
  const [dbContextMenu, setDbContextMenu] = useState<{ x: number, y: number, visible: boolean, dbId: string, name: string, type: DbDialect } | null>(null);

  const [appSettings, setAppSettings] = useState<AppSettings>(() => ({
      editorFontSize: 14, themeAccent: 'blue', refreshRate: 0, customInsights: {}
  }));
  const [tabs, setTabs] = useState<EditorTab[]>([
    { id: 'tab-1', title: 'Query 1', content: '', isDirty: false, isExecuting: false, results: [], activeResultIndex: -1 }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');
  const [resultViewMode, setResultViewMode] = useState<'table' | 'chart' | 'plan'>('table');
  const [layout, setLayout] = useState<LayoutMode>('bottom');
  const [panelSize, setPanelSize] = useState(40); 

  const [dashboards, setDashboards] = useState<DashboardLayout[]>([
    { id: 'dash-default', title: 'Main Metrics', rows: [], isDefault: true }
  ]);
  const [activeDashboardId, setActiveDashboardId] = useState<string>('dash-default');
  const [pinnedCharts, setPinnedCharts] = useState<PinnedChart[]>([]);

  const editorRef = useRef<SqlEditorRef>(null);
  const isResizing = useRef(false);

  // --- Global Event Handlers ---
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      if (layout === 'bottom') {
        const height = window.innerHeight;
        const newSize = ((height - e.clientY) / height) * 100;
        setPanelSize(Math.max(10, Math.min(80, newSize)));
      } else {
        const width = window.innerWidth;
        const mousePos = layout === 'right' ? (width - e.clientX) : e.clientX;
        const newSize = (mousePos / width) * 100;
        setPanelSize(Math.max(10, Math.min(80, newSize)));
      }
    };
    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = 'default';
    };
    const handleClickOutside = () => {
      setDbContextMenu(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('click', handleClickOutside);
    };
  }, [layout]);

  const allConnections = useMemo(() => {
    const remote = savedCredentials.map(c => ({ id: c.id, name: c.connectionName || c.id, type: (c.dbType || 'postgres') as DbDialect, isRemote: true }));
    const local = databases.map(d => ({ ...d, isRemote: false }));
    return [...remote, ...local];
  }, [savedCredentials, databases]);

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || tabs[0], [tabs, activeTabId]);
  const activeResult = useMemo(() => activeTab?.activeResultIndex >= 0 ? activeTab.results[activeTab.activeResultIndex] : null, [activeTab]);
  const selectedDb = useMemo(() => allConnections.find(d => d.id === selectedDbId), [allConnections, selectedDbId]);

  const updateTabContent = (newContent: string) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, content: newContent, isDirty: true } : t));
  };

  useEffect(() => {
    const initApp = async () => {
      logicalJoinService.init();
      const isMuul = await detectMuulBrowser();
      if (isMuul) setSavedCredentials(await fetchSavedCredentials());
      const dbs = await muulService.getDatabases();
      setDatabases(dbs);
      if (dbs.length > 0) setSelectedDbId(dbs[0].id);
    };
    initApp();
  }, []);

  useEffect(() => {
    if (selectedDbId) {
      const cred = savedCredentials.find(c => c.id === selectedDbId);
      const schemaPromise = cred ? muulService.getRemoteDatabaseSchema(cred) : muulService.getDatabaseSchema(selectedDbId);
      schemaPromise.then(s => {
        setActiveSchema(s);
        setDbTables(prev => ({ ...prev, [selectedDbId]: s.tables.map(t => t.name) }));
      });
    }
  }, [selectedDbId, savedCredentials]);

  const handleRunQuery = async () => {
    const editor = editorRef.current;
    if (!editor) return;
    const content = editor.getSelection().text.trim() || activeTab.content;
    if (!content) return;
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isExecuting: true } : t));
    try {
      const cred = savedCredentials.find(c => c.id === selectedDbId);
      const res = cred ? await muulService.executeRemoteQuery(cred, content) : await muulService.executeQuery(selectedDbId, content, Date.now().toString());
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isExecuting: false, results: [res, ...t.results], activeResultIndex: 0 } : t));
    } catch (e) {
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isExecuting: false } : t));
    }
  };

  const handlePinChart = (config: ChartConfig) => {
    const newPinned: PinnedChart = {
      id: `chart-${Date.now()}`,
      title: `Analysis: ${activeTab.title}`,
      query: activeTab.content,
      dbId: selectedDbId,
      config,
      createdAt: Date.now()
    };
    setPinnedCharts(prev => [...prev, newPinned]);
    setCurrentView('dashboard');
  };

  const handleUpdatePinnedChart = (chartId: string, newConfig: ChartConfig) => {
    setPinnedCharts(prev => prev.map(c => c.id === chartId ? { ...c, config: newConfig } : c));
  };

  // --- Database Context Menu & Properties ---
  const handleDatabaseContextMenu = (e: React.MouseEvent, dbId: string, name: string, type: DbDialect) => {
    e.preventDefault();
    e.stopPropagation();
    setDbContextMenu({ x: e.clientX, y: e.clientY, visible: true, dbId, name, type });
  };

  const showProperties = async () => {
    if (!dbContextMenu) return;
    const { dbId, name } = dbContextMenu;
    setDbContextMenu(null);
    setActiveDbName(name);
    setActiveDbStats(null);
    setDbPropertiesOpen(true);
    
    const cred = savedCredentials.find(c => c.id === dbId);
    const stats = await muulService.getDatabaseStats(dbId, cred);
    setActiveDbStats(stats);
  };

  const runSystemDiagnostic = (insightId: string) => {
    if (!dbContextMenu) return;
    const { type, dbId } = dbContextMenu;
    const dialect = DialectRegistry[type];
    const insight = dialect?.insights.find(i => i.id === insightId);
    if (insight) {
      setSelectedDbId(dbId);
      updateTabContent(insight.query);
      setDbContextMenu(null);
      // Small delay to ensure state updates before running
      setTimeout(handleRunQuery, 100);
    }
  };

  const handleEditorDrop = (e: React.DragEvent) => {
    const tablesJson = e.dataTransfer.getData('application/muul-tables');
    const dbId = e.dataTransfer.getData('application/muul-db-id');
    if (!tablesJson || dbId !== selectedDbId) { setIsDraggingTable(false); return; }
    e.preventDefault();
    setIsDraggingTable(false);
    
    const tableNames: string[] = JSON.parse(tablesJson);
    let newSql = activeTab.content.trim();
    if (!newSql) {
      updateTabContent(tableNames.map(t => `SELECT * FROM "${t}" LIMIT 100;`).join('\n\n'));
      return;
    }

    const foundJoins: PendingJoin[] = [];
    const existingTablesInSql = Array.from(new Set([...newSql.matchAll(/"?([\w$]+)"?/g)].map(m => m[1])));

    tableNames.forEach(newTable => {
        const tableDef = activeSchema.tables.find(t => t.name === newTable);
        if (!tableDef) return;
        let bestJoin: PendingJoin | null = null;
        let bestScore = -1;

        for (const existing of existingTablesInSql) {
            const existingDef = activeSchema.tables.find(t => t.name === existing);
            const fk = tableDef.columns.find(c => c.isForeignKey && c.references?.table === existing);
            if (fk) {
                bestScore = 10;
                bestJoin = { newTable: tableDef, existingTable: existing, joinCondition: `"${newTable}"."${fk.name}" = "${existing}"."${fk.references!.column}"` };
            }
            if (bestScore < 10) {
              const revFk = existingDef?.columns.find(c => c.isForeignKey && c.references?.table === newTable);
              if (revFk) {
                  bestScore = 8;
                  bestJoin = { newTable: tableDef, existingTable: existing, joinCondition: `"${existing}"."${revFk.name}" = "${newTable}"."${revFk.references!.column}"` };
              }
            }
            if (bestScore < 8) {
              const intersect = tableDef.columns.map(c => c.name.toLowerCase()).filter(c => existingDef?.columns.map(ec => ec.name.toLowerCase()).includes(c) && (c.includes('id') || c.includes('key')));
              if (intersect.length > 0) {
                 bestScore = 2;
                 bestJoin = { newTable: tableDef, existingTable: existing, joinCondition: `"${newTable}"."${intersect[0]}" = "${existing}"."${intersect[0]}"`, isHeuristic: true };
              }
            }
        }

        if (bestJoin) foundJoins.push(bestJoin);
        else newSql += `\n\nSELECT * FROM "${newTable}" LIMIT 100;`;
    });

    if (foundJoins.length > 0) { setPendingJoins(foundJoins); setIsJoinBuilderOpen(true); } 
    else updateTabContent(newSql);
  };

  const handleJoinConfirmed = (batch: { tableName: string, existingTable: string, columns: string[], joinSql: string }[]) => {
    let sql = activeTab.content.trim();
    const selectMatch = sql.match(/SELECT\s+([\s\S]+?)\s+FROM/i);
    let selectPart = selectMatch ? selectMatch[1] : '*';
    
    batch.forEach(item => {
      sql = sql.replace(/;?\s*$/, `\nINNER JOIN "${item.tableName}" ON ${item.joinSql};`);
      const tableColumns = item.columns.map(col => {
        const isAmbiguous = selectPart.toLowerCase().includes(`"${col.toLowerCase()}"`) || selectPart.toLowerCase().includes(`, ${col.toLowerCase()}`);
        return isAmbiguous 
          ? `"${item.tableName}"."${col}" AS "${item.tableName}_${col}"`
          : `"${item.tableName}"."${col}"`;
      }).join(',\n  ');
      
      if (selectPart === '*' || selectPart === ' *') selectPart = `*,\n  ${tableColumns}`;
      else selectPart += `,\n  ${tableColumns}`;
    });

    if (selectMatch) sql = sql.replace(selectMatch[1], selectPart);
    else if (!sql.toUpperCase().startsWith('SELECT')) sql = `SELECT ${selectPart} FROM ...\n` + sql;
    
    updateTabContent(sql);
    setIsJoinBuilderOpen(false);
    setPendingJoins([]);
  };

  const addTab = () => {
    const newId = `tab-${Date.now()}`;
    setTabs(prev => [...prev, { id: newId, title: `Query ${prev.length + 1}`, content: '', isDirty: false, isExecuting: false, results: [], activeResultIndex: -1 }]);
    setActiveTabId(newId);
  };

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) setActiveTabId(newTabs[newTabs.length - 1].id);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950">
        <div className="flex flex-1 text-slate-200 overflow-hidden font-sans relative"
             onDragEnter={(e) => { e.preventDefault(); if (e.dataTransfer.types.includes('Files')) setIsDraggingFile(true); }}
             onDragOver={(e) => e.preventDefault()}
             onDrop={async (e) => {
               e.preventDefault(); setIsDraggingFile(false);
               if (e.dataTransfer.types.includes('application/muul-tables')) { handleEditorDrop(e); return; }
               // Explicit cast to File[] to fix 'unknown' type error on FileList iteration
               for (const file of Array.from(e.dataTransfer.files) as File[]) {
                 const newDb = await muulService.uploadDatabase(file);
                 setDatabases(prev => [newDb, ...prev]);
               }
             }}>
            
            {isDraggingFile && <div className="absolute inset-0 z-[100] bg-blue-500/20 backdrop-blur-sm border-4 border-dashed border-blue-400 m-4 rounded-xl flex items-center justify-center text-white text-2xl font-bold">Drop to Import Database</div>}
            
            <JoinBuilderModal isOpen={isJoinBuilderOpen} onClose={() => setIsJoinBuilderOpen(false)} pendingJoins={pendingJoins} onConfirm={handleJoinConfirmed} />
            <DbPropertiesModal isOpen={dbPropertiesOpen} onClose={() => setDbPropertiesOpen(false)} dbName={activeDbName} stats={activeDbStats} />

            {/* Global Context Menu */}
            {dbContextMenu && dbContextMenu.visible && (
              <div 
                className="fixed z-[200] w-56 bg-slate-850 border border-slate-700 rounded shadow-2xl py-1 backdrop-blur-md animate-in fade-in zoom-in-95 duration-75"
                style={{ top: dbContextMenu.y, left: dbContextMenu.x }}
                onClick={e => e.stopPropagation()}
              >
                <div className="px-3 py-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 mb-1">Database Actions</div>
                <button onClick={showProperties} className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-slate-700 flex items-center space-x-2 transition-colors">
                  <Info size={14} className="text-blue-400" />
                  <span>Technical Properties</span>
                </button>
                
                <div className="px-3 py-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 my-1">Server Parameters</div>
                <button 
                  onClick={() => runSystemDiagnostic(dbContextMenu.type === 'postgres' ? 'pg-storage' : 'ms-disk-usage')}
                  className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-slate-700 flex items-center space-x-2 transition-colors"
                >
                  <HardDrive size={14} className="text-purple-400" />
                  <span>Disk & Space Usage</span>
                </button>
                <button 
                  onClick={() => runSystemDiagnostic(dbContextMenu.type === 'postgres' ? 'pg-io-stats' : 'ms-io-perf')}
                  className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-slate-700 flex items-center space-x-2 transition-colors"
                >
                  <IoIcon size={14} className="text-green-400" />
                  <span>I/O Operations (Read/Write)</span>
                </button>
                <button 
                  onClick={() => runSystemDiagnostic(dbContextMenu.type === 'postgres' ? 'pg-db-count' : 'ms-db-count')}
                  className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-slate-700 flex items-center space-x-2 transition-colors"
                >
                  <ListOrdered size={14} className="text-cyan-400" />
                  <span>Inventory (DB Count)</span>
                </button>
              </div>
            )}

            <aside className="w-12 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-4 space-y-4 shrink-0 z-50">
                <div className="text-blue-500 mb-2"><DbIcon size={24} /></div>
                
                <button 
                  onClick={() => setCurrentView('editor')} 
                  className={`p-2 rounded-lg ${currentView === 'editor' ? 'bg-slate-800 text-blue-500' : 'text-slate-500'}`} 
                  title="SQL Editor"
                >
                  <TerminalSquare size={20} />
                </button>
                
                <button 
                  onClick={() => setCurrentView('dashboard')} 
                  className={`p-2 rounded-lg ${currentView === 'dashboard' ? 'bg-slate-800 text-blue-500' : 'text-slate-500'}`} 
                  title="Dashboard"
                >
                  <LayoutDashboard size={20} />
                </button>
                
                <button 
                  onClick={() => setCurrentView('dba-perf')} 
                  className={`p-2 rounded-lg ${currentView === 'dba-perf' ? 'bg-slate-800 text-blue-500' : 'text-slate-500'}`} 
                  title="Performance Pulse"
                >
                  <Activity size={20} />
                </button>
                
                <button 
                  onClick={() => { setCurrentView('schema'); setSidebarTab('db'); }} 
                  className={`p-2 rounded-lg ${currentView === 'schema' ? 'bg-slate-800 text-blue-500' : 'text-slate-500'}`} 
                  title="Schema Visualizer"
                >
                  <Network size={20} />
                </button>
                
                <div className="h-px w-6 bg-slate-800 my-2"></div>
                
                <button 
                  onClick={() => { setCurrentView('editor'); setSidebarTab('dba'); }} 
                  className={`p-2 rounded-lg ${sidebarTab === 'dba' ? 'text-blue-400 bg-slate-800' : 'text-slate-500'}`} 
                  title="DBA Studio"
                >
                  <ShieldAlert size={20} />
                </button>
                
                <div className="flex-1" />
                <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-500 hover:text-white"><Settings size={20} /></button>
            </aside>

            {(currentView === 'editor' || currentView === 'schema') && (
                <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden">
                    <div className="h-10 flex items-center justify-between px-4 font-bold text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800">
                      <span>{sidebarTab === 'db' ? 'Databases' : 'DBA Studio'}</span>
                    </div>
                    {sidebarTab === 'db' ? (
                        <div className="flex-1 overflow-y-auto p-2">
                            {allConnections.map(db => (
                                <div key={db.id} className="mb-1">
                                    <div 
                                      onClick={() => setSelectedDbId(db.id)} 
                                      onContextMenu={(e) => handleDatabaseContextMenu(e, db.id, db.name, db.type)}
                                      className={`flex items-center p-2 rounded cursor-pointer transition-colors ${selectedDbId === db.id ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:bg-slate-800/50'}`}
                                    >
                                        <DbIcon size={14} className="mr-2" />
                                        <span className="text-sm truncate font-medium">{db.name}</span>
                                    </div>
                                    {selectedDbId === db.id && (
                                        <div className="ml-6 mt-1 space-y-0.5 border-l border-slate-800 pl-2">
                                            {(dbTables[db.id] || []).map(tbl => (
                                                <div key={tbl} draggable="true" 
                                                     onDragStart={(e) => { e.dataTransfer.setData('application/muul-tables', JSON.stringify([tbl])); e.dataTransfer.setData('application/muul-db-id', selectedDbId); setIsDraggingTable(true); }}
                                                     onClick={() => { updateTabContent(`SELECT * FROM "${tbl}" LIMIT 100;`); handleRunQuery(); }}
                                                     className="text-[11px] py-1 px-2 rounded hover:bg-slate-800 transition-colors cursor-pointer flex items-center text-slate-500 hover:text-slate-300">
                                                  <TableIcon size={10} className="mr-2 opacity-50" /> {tbl}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <DbaPanel 
                            dialect={selectedDb?.type || 'sqlite'} 
                            dbId={selectedDbId} 
                            dbName={selectedDb?.name || ''} 
                            onSelectInsight={(i) => { updateTabContent(i.query); handleRunQuery(); }} 
                            onViewHistory={()=>{}} 
                            onLaunchDashboard={()=>setCurrentView('dba-perf')} 
                            activeSchema={activeSchema} // PASSING SCHEMA HERE
                        />
                    )}
                </div>
            )}

            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                <header className="h-14 border-b border-slate-800 bg-slate-900 flex items-center px-4 justify-between shrink-0">
                    <div className="flex items-center space-x-4">
                        <div className="text-blue-400 font-bold text-lg">Muul<span className="text-white">SQL</span></div>
                        <select value={selectedDbId} onChange={(e) => setSelectedDbId(e.target.value)} className="bg-slate-800 border border-slate-700 text-xs rounded py-1 px-2 w-64 focus:ring-1 focus:ring-blue-500 outline-none">
                            {allConnections.map(db => <option key={db.id} value={db.id}>{db.type.toUpperCase()} • {db.name}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button onClick={() => setShowAlgoView(!showAlgoView)} className={`p-2 transition-colors ${showAlgoView ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`} title="Toggle Blueprint"><BrainCircuit size={18} /></button>
                        <div className="h-6 w-px bg-slate-800 mx-2"></div>
                        <button onClick={handleRunQuery} disabled={activeTab.isExecuting} className="flex items-center px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded shadow active:scale-95 transition-all"><Play size={16} className="mr-2" /> Run</button>
                    </div>
                </header>

                <div className="bg-slate-900 border-b border-slate-800 flex items-center px-2 space-x-1 shrink-0 overflow-x-auto no-scrollbar">
                  {tabs.map(tab => (
                    <div 
                      key={tab.id}
                      onClick={() => setActiveTabId(tab.id)}
                      className={`flex items-center h-10 px-4 min-w-[120px] max-w-[200px] border-r border-slate-800 cursor-pointer transition-colors relative group ${activeTabId === tab.id ? 'bg-slate-950 text-blue-400 border-b-2 border-b-blue-500' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
                    >
                      <TerminalSquare size={12} className="mr-2 shrink-0" />
                      <span className="text-xs truncate font-medium">{tab.title}{tab.isDirty && '*'}</span>
                      <button 
                        onClick={(e) => closeTab(e, tab.id)}
                        className="ml-auto opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all shrink-0"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  <button onClick={addTab} className="p-2 text-slate-500 hover:text-blue-400 hover:bg-slate-800 transition-all rounded m-1 shrink-0"><Plus size={16} /></button>
                </div>

                <main className="flex-1 flex min-h-0 relative bg-slate-950">
                    {currentView === 'editor' && (
                        <div className="flex-1 flex flex-col relative overflow-hidden">
                            <div className={`flex-1 flex ${layout === 'bottom' ? 'flex-col' : 'flex-row'} overflow-hidden`}>
                                <div className="flex-1 flex relative min-h-0 min-w-0">
                                    <SqlEditor ref={editorRef} value={activeTab.content} onChange={updateTabContent} schema={activeSchema} />
                                    {showAlgoView && <div className="w-80 border-l border-slate-800 shrink-0"><SqlAlgoView sql={activeTab.content} onClose={() => setShowAlgoView(false)} /></div>}
                                    {isDraggingTable && <div className="absolute inset-0 z-50 bg-blue-500/10 backdrop-blur-[2px] border-2 border-dashed border-blue-500/50 m-4 rounded-xl flex items-center justify-center pointer-events-none"><Link2 size={48} className="text-blue-400 animate-pulse" /></div>}
                                </div>
                                <div 
                                  onMouseDown={() => { isResizing.current = true; document.body.style.cursor = layout === 'bottom' ? 'row-resize' : 'col-resize'; }} 
                                  className={`${layout === 'bottom' ? 'h-1.5 w-full cursor-row-resize' : 'w-1.5 h-full cursor-col-resize'} bg-slate-800 hover:bg-blue-500 transition-colors z-20 shrink-0`} 
                                />
                                <div style={layout === 'bottom' ? { height: `${panelSize}%` } : { width: `${panelSize}%` }} className="min-h-0 min-w-0 bg-slate-900 border-slate-800 flex flex-col shrink-0 overflow-hidden">
                                    <ResultsPane 
                                      result={activeResult} 
                                      viewMode={resultViewMode} 
                                      setViewMode={setResultViewMode} 
                                      layout={layout} 
                                      setLayout={setLayout} 
                                      queryText={activeTab.content} 
                                      dbType={selectedDb?.type}
                                      onPinChart={handlePinChart}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    {currentView === 'dashboard' && <Dashboard dashboards={dashboards} pinnedCharts={pinnedCharts} databases={databases} activeDashboardId={activeDashboardId} refreshRate={appSettings.refreshRate} onSetActiveDashboard={setActiveDashboardId} onAddDashboard={()=>{}} onUpdateDashboard={()=>{}} onDeleteDashboard={()=>{}} onRemoveChartDefinition={()=>{}} onUpdateChartDefinition={handleUpdatePinnedChart} onEditChart={()=>{}} />}
                    {currentView === 'schema' && <SchemaVisualizer schema={activeSchema} dbName={selectedDb?.name || ''} layouts={[]} activeLayoutId={null} onLayoutCreate={()=>{}} onLayoutSelect={()=>{}} onLayoutUpdate={()=>{}} onLayoutDelete={()=>{}} />}
                    {currentView === 'dba-perf' && selectedDb && <DbaPerformanceDashboard database={selectedDb} customInsights={appSettings.customInsights} />}
                </main>
            </div>
        </div>
        {isSettingsOpen && <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={appSettings} onSave={setAppSettings} />}
    </div>
  );
};

export default App;
