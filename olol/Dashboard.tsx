import React, { useEffect, useState, useRef, useMemo } from 'react';
import { PinnedChart, QueryResult, ChartConfig, Database, DashboardLayout, DashboardRow, DashboardWidget } from '../types';
import { muulService } from '../services/muulService';
import { exportService } from '../services/exportService';
import DataVisualizer from './DataVisualizer';
import MarkdownVisualizer from './MarkdownVisualizer';
import { 
  RefreshCw, Trash2, Edit, AlertCircle, Database as DbIcon, 
  Plus, Layout, Monitor, MoveHorizontal, X, FileText, BarChart3, GripVertical,
  Download
} from 'lucide-react';

interface DashboardProps {
  dashboards: DashboardLayout[];
  pinnedCharts: PinnedChart[];
  databases: Database[];
  activeDashboardId: string;
  refreshRate: number; 
  onSetActiveDashboard: (id: string) => void;
  onAddDashboard: () => void;
  onUpdateDashboard: (layout: DashboardLayout) => void;
  onDeleteDashboard: (id: string) => void;
  onRemoveChartDefinition: (id: string) => void;
  onUpdateChartDefinition: (id: string, newConfig: ChartConfig) => void;
  onEditChart: (chartId: string) => void; // New prop
}

const Dashboard: React.FC<DashboardProps> = ({ 
  dashboards, 
  pinnedCharts, 
  databases, 
  activeDashboardId,
  refreshRate,
  onSetActiveDashboard,
  onAddDashboard,
  onUpdateDashboard,
  onDeleteDashboard,
  onRemoveChartDefinition,
  onUpdateChartDefinition,
  onEditChart
}) => {
  const [results, setResults] = useState<Record<string, QueryResult>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [isDesignerMode, setIsDesignerMode] = useState(false);
  const [draggingItem, setDraggingItem] = useState<{ rowId: string; index: number } | null>(null);
  const refreshIntervalRef = useRef<number | null>(null);

  // --- Helpers ---
  const activeDashboard = dashboards.find(d => d.id === activeDashboardId) || dashboards[0];
  const getChartDef = (chartId: string) => pinnedCharts.find(c => c.id === chartId);
  const getDbName = (dbId?: string) => databases.find(d => d.id === dbId)?.name || 'Unknown DB';

  const unassignedCharts = useMemo(() => {
    if (!activeDashboard) return [];
    
    const existingWidgetChartIds = new Set<string>();
    activeDashboard.rows.forEach(row => {
      row.widgets.forEach(widget => {
        if (widget.type === 'chart') {
          existingWidgetChartIds.add(widget.content);
        }
      });
    });
    
    return pinnedCharts.filter(c => !existingWidgetChartIds.has(c.id));
  }, [activeDashboard, pinnedCharts]);

  // --- Data Fetching ---
  const refreshChart = async (chartId: string) => {
    const chart = getChartDef(chartId);
    if (!chart) {
        console.warn(`[WARN] Dashboard refresh failed for chartId ${chartId}: Definition not found.`);
        return;
    }

    console.log(`[LOG] Refreshing dashboard chart: "${chart.title}" (ID: ${chart.id})`);
    setLoading(prev => ({ ...prev, [chartId]: true }));
    try {
      const result = await muulService.executeQuery(chart.dbId, chart.query, `dash-${chart.id}-${Date.now()}`);
      setResults(prev => ({ ...prev, [chartId]: result }));
      console.debug(`[LOG] Refresh success for chart "${chart.title}".`);
    } catch (error) {
       console.error(`[ERROR] Dashboard execution error for chart "${chart.title}":`, error);
    } finally {
      setLoading(prev => ({ ...prev, [chartId]: false }));
    }
  };

  const handleRefreshAll = () => {
     if (!activeDashboard) return;
     console.log(`[LOG] Refreshing all widgets for dashboard: "${activeDashboard.title}"`);
     activeDashboard.rows.forEach(row => {
         row.widgets.forEach(w => {
             if (w.type === 'chart') refreshChart(w.content);
         });
     });
     unassignedCharts.forEach(c => refreshChart(c.id));
  };

  // --- Effects ---

  // Data fetch logic
  useEffect(() => {
    if (!activeDashboard) return;

    const allVisibleChartIds = new Set<string>();
    // Add charts from widgets
    activeDashboard.rows.forEach(row => {
      row.widgets.forEach(widget => {
        if (widget.type === 'chart') {
          allVisibleChartIds.add(widget.content);
        }
      });
    });
    // Add unassigned charts
    unassignedCharts.forEach(chart => {
      allVisibleChartIds.add(chart.id);
    });

    // Fetch data for any visible chart that doesn't have it yet
    allVisibleChartIds.forEach(id => {
      if (!results[id] && !loading[id]) {
        refreshChart(id);
      }
    });
  }, [activeDashboard, unassignedCharts]);

  // Auto Refresh Logic
  useEffect(() => {
    if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
    }

    if (refreshRate > 0) {
        refreshIntervalRef.current = window.setInterval(() => {
            console.log("Auto-refreshing dashboard...");
            handleRefreshAll();
        }, refreshRate * 1000);
    }

    return () => {
        if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    }
  }, [refreshRate, activeDashboard]); // Re-setup if rate or dash changes

  // --- Export ---
  const handleExportPPT = () => {
      if (!activeDashboard) return;
      exportService.exportDashboardToPPT(activeDashboard, pinnedCharts, results);
  };

  // --- Designer Actions ---

  const handleAddRow = () => {
    const newRow: DashboardRow = {
        id: `row-${Date.now()}`,
        widgets: []
    };
    onUpdateDashboard({
        ...activeDashboard,
        rows: [...activeDashboard.rows, newRow]
    });
  };

  const handleDeleteRow = (rowId: string) => {
      onUpdateDashboard({
          ...activeDashboard,
          rows: activeDashboard.rows.filter(r => r.id !== rowId)
      });
  };

  const handleAddWidget = (rowId: string, type: 'chart' | 'markdown') => {
      let content = '';
      let title = 'New Widget';

      if (type === 'markdown') {
          content = '### New Markdown\nEdit this content...';
          title = 'Text Block';
      } else {
          if (pinnedCharts.length === 0) {
              alert("No pinned charts available to add. Go to SQL Editor to pin queries.");
              return;
          }
          const firstChart = pinnedCharts[0];
          content = firstChart.id;
          title = firstChart.title;
      }

      const newWidget: DashboardWidget = {
          id: `widget-${Date.now()}`,
          type,
          colSpan: 12, // Default full width
          content,
          title
      };

      onUpdateDashboard({
          ...activeDashboard,
          rows: activeDashboard.rows.map(r => 
            r.id === rowId ? { ...r, widgets: [...r.widgets, newWidget] } : r
          )
      });
  };

  const handleRemoveWidget = (rowId: string, widgetId: string) => {
      onUpdateDashboard({
          ...activeDashboard,
          rows: activeDashboard.rows.map(r => 
            r.id === rowId ? { ...r, widgets: r.widgets.filter(w => w.id !== widgetId) } : r
          )
      });
  };

  const handleChangeWidgetWidth = (rowId: string, widgetId: string, delta: number) => {
    onUpdateDashboard({
        ...activeDashboard,
        rows: activeDashboard.rows.map(r => {
            if (r.id !== rowId) return r;
            return {
                ...r,
                widgets: r.widgets.map(w => {
                    if (w.id !== widgetId) return w;
                    const newSpan = Math.max(1, Math.min(12, w.colSpan + delta));
                    return { ...w, colSpan: newSpan };
                })
            };
        })
    });
  };

  const handleMarkdownChange = (rowId: string, widgetId: string, newContent: string) => {
      onUpdateDashboard({
          ...activeDashboard,
          rows: activeDashboard.rows.map(r => {
              if (r.id !== rowId) return r;
              return {
                  ...r,
                  widgets: r.widgets.map(w => w.id === widgetId ? { ...w, content: newContent } : w)
              };
          })
      });
  };

  // --- Drag and Drop Logic ---

  const handleDragStart = (e: React.DragEvent, rowId: string, index: number) => {
      setDraggingItem({ rowId, index });
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); 
      e.dataTransfer.dropEffect = 'move';
  };

  const moveWidget = (sourceRowId: string, sourceIndex: number, targetRowId: string, targetIndex: number) => {
      const newRows = activeDashboard.rows.map(r => ({
          ...r,
          widgets: [...r.widgets]
      }));

      const sourceRow = newRows.find(r => r.id === sourceRowId);
      const targetRow = newRows.find(r => r.id === targetRowId);

      if (!sourceRow || !targetRow) return;

      const [widget] = sourceRow.widgets.splice(sourceIndex, 1);
      let finalIndex = targetIndex;
      if (sourceRowId === targetRowId && sourceIndex < targetIndex) {
          finalIndex--;
      }
      targetRow.widgets.splice(finalIndex, 0, widget);

      onUpdateDashboard({
          ...activeDashboard,
          rows: newRows
      });
  };

  const handleDropOnWidget = (e: React.DragEvent, targetRowId: string, targetIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      if (!draggingItem) return;
      moveWidget(draggingItem.rowId, draggingItem.index, targetRowId, targetIndex);
      setDraggingItem(null);
  };

  const handleDropOnRow = (e: React.DragEvent, targetRowId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (!draggingItem) return;
      const targetRow = activeDashboard.rows.find(r => r.id === targetRowId);
      if (targetRow) {
          moveWidget(draggingItem.rowId, draggingItem.index, targetRowId, targetRow.widgets.length);
      }
      setDraggingItem(null);
  };

  // --- Render ---

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 overflow-hidden relative">
      
      {/* Dashboard Toolbar / Tabs */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar">
              {dashboards.map(d => (
                  <button
                    key={d.id}
                    onClick={() => onSetActiveDashboard(d.id)}
                    className={`px-4 py-2 text-sm rounded-t-lg border-t border-r border-l border-b-0 transition-colors ${
                        activeDashboardId === d.id 
                        ? 'bg-slate-950 border-slate-700 text-blue-400 font-medium translate-y-[1px]' 
                        : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                      {d.title}
                  </button>
              ))}
              <button 
                onClick={onAddDashboard} 
                className="p-2 ml-2 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded"
              >
                  <Plus size={16} />
              </button>
          </div>

          <div className="flex items-center space-x-3">
               <button 
                onClick={handleExportPPT}
                className="flex items-center px-3 py-1.5 bg-orange-700/50 hover:bg-orange-600 text-orange-200 text-xs rounded border border-orange-600 transition-all"
                title="Export Dashboard to PowerPoint"
              >
                <Download size={14} className="mr-2" /> Export PPT
              </button>

              <div className="h-6 w-px bg-slate-800"></div>

              <button 
                onClick={() => setIsDesignerMode(!isDesignerMode)}
                className={`flex items-center px-3 py-1.5 text-xs rounded border transition-all ${
                    isDesignerMode 
                    ? 'bg-blue-900/30 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                  {isDesignerMode ? <Layout size={14} className="mr-2" /> : <Monitor size={14} className="mr-2" />}
                  {isDesignerMode ? 'Designer Active' : 'View Mode'}
              </button>
              
              <div className="h-6 w-px bg-slate-800"></div>

              <button 
                onClick={handleRefreshAll}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded relative" 
                title={`Refresh Data ${refreshRate > 0 ? `(Auto: ${refreshRate}s)` : ''}`}
              >
                <RefreshCw size={16} className={refreshRate > 0 ? "text-green-400" : ""} />
                {refreshRate > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>}
              </button>
          </div>
      </div>

      {/* Workspace */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-950">
          
          {/* Dashboard Rows */}
          <div className="space-y-6 max-w-7xl mx-auto">
              {activeDashboard.rows.map((row, rowIndex) => (
                  <div 
                    key={row.id} 
                    className={`relative group/row ${isDesignerMode ? 'p-2 border border-dashed border-slate-700 rounded-xl bg-slate-900/30 min-h-[100px] transition-colors hover:border-blue-500/30' : ''}`}
                    onDragOver={isDesignerMode ? handleDragOver : undefined}
                    onDrop={isDesignerMode ? (e) => handleDropOnRow(e, row.id) : undefined}
                  >
                      {/* Row Controls */}
                      {isDesignerMode && (
                          <div className="absolute -top-3 left-4 bg-slate-800 text-xs text-slate-400 px-2 py-0.5 rounded border border-slate-700 flex items-center space-x-2 shadow-sm z-10">
                              <span className="font-mono">Row {rowIndex + 1}</span>
                              <div className="h-3 w-px bg-slate-600"></div>
                              <button onClick={() => handleDeleteRow(row.id)} className="hover:text-red-400"><Trash2 size={12} /></button>
                          </div>
                      )}

                      {/* Row Grid */}
                      <div className="grid grid-cols-12 gap-6 min-h-[50px]">
                          {row.widgets.length === 0 && isDesignerMode && (
                              <div className="col-span-12 flex items-center justify-center py-8 text-slate-600 border-2 border-dashed border-slate-800 rounded-lg pointer-events-none">
                                  Empty Row - Drop widget here or add new
                              </div>
                          )}

                          {row.widgets.map((widget, widgetIndex) => {
                              const chartDef = widget.type === 'chart' ? getChartDef(widget.content) : null;
                              
                              return (
                                <div 
                                    key={widget.id} 
                                    className={`relative flex flex-col bg-slate-900 border border-slate-800 rounded-lg shadow-sm overflow-hidden min-h-[300px] transition-all 
                                        ${isDesignerMode ? 'cursor-grab active:cursor-grabbing hover:border-blue-500' : ''}
                                        ${draggingItem?.rowId === row.id && draggingItem?.index === widgetIndex ? 'opacity-40 border-dashed border-slate-600' : ''}
                                    `}
                                    style={{ gridColumn: `span ${widget.colSpan} / span ${widget.colSpan}` }}
                                    draggable={isDesignerMode}
                                    onDragStart={(e) => isDesignerMode && handleDragStart(e, row.id, widgetIndex)}
                                    onDragOver={isDesignerMode ? handleDragOver : undefined}
                                    onDrop={isDesignerMode ? (e) => handleDropOnWidget(e, row.id, widgetIndex) : undefined}
                                >
                                    {/* Widget Header */}
                                    <div className="h-9 px-3 flex items-center justify-between bg-slate-850 border-b border-slate-800 shrink-0 select-none">
                                        <div className="flex items-center space-x-2 overflow-hidden">
                                            {isDesignerMode && <GripVertical size={14} className="text-slate-600 cursor-grab" />}
                                            {widget.type === 'chart' && (
                                                <div className={`w-2 h-2 rounded-full shrink-0 ${loading[widget.content] ? 'bg-yellow-500 animate-pulse' : results[widget.content]?.error ? 'bg-red-500' : 'bg-green-500'}`} />
                                            )}
                                            <span className="text-xs font-bold text-slate-300 truncate">{widget.title || (chartDef?.title)}</span>
                                        </div>
                                        
                                        {isDesignerMode && (
                                            <div className="flex items-center space-x-1" onMouseDown={e => e.stopPropagation()}>
                                                <button onClick={() => handleChangeWidgetWidth(row.id, widget.id, -1)} disabled={widget.colSpan <= 1} className="p-1 hover:bg-slate-700 rounded text-slate-500 disabled:opacity-30"><MoveHorizontal size={12} className="rotate-180" /></button>
                                                <span className="text-[10px] font-mono text-slate-500 w-4 text-center">{widget.colSpan}</span>
                                                <button onClick={() => handleChangeWidgetWidth(row.id, widget.id, 1)} disabled={widget.colSpan >= 12} className="p-1 hover:bg-slate-700 rounded text-slate-500 disabled:opacity-30"><MoveHorizontal size={12} /></button>
                                                <div className="w-px h-3 bg-slate-700 mx-1"></div>
                                                <button onClick={() => handleRemoveWidget(row.id, widget.id)} className="p-1 hover:bg-red-900/50 hover:text-red-400 rounded text-slate-500"><X size={12} /></button>
                                            </div>
                                        )}
                                        
                                        {!isDesignerMode && widget.type === 'chart' && (
                                            <div className="flex items-center space-x-1">
                                                <button 
                                                    onClick={() => onEditChart(widget.content)} 
                                                    className="p-1 text-slate-500 hover:text-purple-400 rounded hover:bg-slate-800"
                                                    title="Edit Query & Chart"
                                                >
                                                    <Edit size={12} />
                                                </button>
                                                <button onClick={() => refreshChart(widget.content)} className="p-1 text-slate-500 hover:text-blue-400 rounded hover:bg-slate-800">
                                                    <RefreshCw size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Widget Content */}
                                    <div className="flex-1 relative overflow-hidden" onMouseDown={e => isDesignerMode && e.stopPropagation()}>
                                        {widget.type === 'markdown' ? (
                                            <MarkdownVisualizer 
                                                content={widget.content} 
                                                onChange={(val) => handleMarkdownChange(row.id, widget.id, val)}
                                                isDesignerMode={isDesignerMode}
                                            />
                                        ) : (
                                            /* Chart Logic */
                                            <>
                                                {loading[widget.content] && !results[widget.content] ? (
                                                    <div className="absolute inset-0 flex items-center justify-center text-slate-600">
                                                        <RefreshCw className="animate-spin" />
                                                    </div>
                                                ) : results[widget.content]?.error ? (
                                                     <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 p-4 text-center">
                                                        <AlertCircle size={24} className="mb-2 opacity-50" />
                                                        <span className="text-xs font-mono">{results[widget.content].error}</span>
                                                    </div>
                                                ) : results[widget.content] && chartDef ? (
                                                    <DataVisualizer 
                                                        result={results[widget.content]} 
                                                        initialConfig={chartDef.config} 
                                                        readOnly={true} // Dashboard is mostly read-only for charts unless we open a full editor
                                                    />
                                                ) : (
                                                    <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs">
                                                        {chartDef ? 'Waiting for data...' : 'Chart definition not found'}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    
                                    {/* Chart Footer Info */}
                                    {widget.type === 'chart' && chartDef && (
                                        <div className="h-6 bg-slate-900 border-t border-slate-800 px-3 flex items-center justify-between text-[10px] text-slate-600 font-mono">
                                            <span className="truncate">{getDbName(chartDef.dbId)}</span>
                                            {results[widget.content] && <span>{results[widget.content].executionTimeMs}ms</span>}
                                        </div>
                                    )}
                                </div>
                              );
                          })}
                      </div>

                      {/* Add Widget Controls (Row Level) */}
                      {isDesignerMode && (
                          <div className="mt-2 flex justify-center opacity-0 group-hover/row:opacity-100 transition-opacity">
                              <div className="bg-slate-800 rounded-full border border-slate-700 p-1 flex space-x-1 shadow-lg transform translate-y-1/2">
                                  <button 
                                    onClick={() => handleAddWidget(row.id, 'chart')}
                                    className="px-3 py-1 text-xs rounded-full hover:bg-blue-600 hover:text-white text-slate-300 flex items-center transition-colors"
                                  >
                                      <BarChart3 size={12} className="mr-1" /> Add Chart
                                  </button>
                                  <div className="w-px bg-slate-700 my-1"></div>
                                  <button 
                                    onClick={() => handleAddWidget(row.id, 'markdown')}
                                    className="px-3 py-1 text-xs rounded-full hover:bg-purple-600 hover:text-white text-slate-300 flex items-center transition-colors"
                                  >
                                      <FileText size={12} className="mr-1" /> Add Text
                                  </button>
                              </div>
                          </div>
                      )}
                  </div>
              ))}

              {unassignedCharts.length > 0 && !isDesignerMode && (
                <div className="pt-4 mt-6 border-t-2 border-dashed border-slate-800">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Newly Pinned Charts</h3>
                  <div className="grid grid-cols-12 gap-6">
                    {unassignedCharts.map(chartDef => {
                      const result = results[chartDef.id];
                      const isLoading = loading[chartDef.id];
                      
                      return (
                        <div 
                          key={chartDef.id} 
                          className="col-span-12 md:col-span-6 lg:col-span-4 relative flex flex-col bg-slate-900 border border-slate-800 rounded-lg shadow-sm overflow-hidden min-h-[300px] transition-all"
                        >
                          <div className="h-9 px-3 flex items-center justify-between bg-slate-850 border-b border-slate-800 shrink-0 select-none">
                              <div className="flex items-center space-x-2 overflow-hidden">
                                  <div className={`w-2 h-2 rounded-full shrink-0 ${isLoading ? 'bg-yellow-500 animate-pulse' : result?.error ? 'bg-red-500' : 'bg-green-500'}`} />
                                  <span className="text-xs font-bold text-slate-300 truncate">{chartDef.title}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                  <button 
                                      onClick={() => onEditChart(chartDef.id)} 
                                      className="p-1 text-slate-500 hover:text-purple-400 rounded hover:bg-slate-800"
                                      title="Edit Query & Chart"
                                  >
                                      <Edit size={12} />
                                  </button>
                                  <button onClick={() => refreshChart(chartDef.id)} className="p-1 text-slate-500 hover:text-blue-400 rounded hover:bg-slate-800">
                                      <RefreshCw size={12} />
                                  </button>
                              </div>
                          </div>

                          <div className="flex-1 relative overflow-hidden">
                            {isLoading && !result ? (
                              <div className="absolute inset-0 flex items-center justify-center text-slate-600"><RefreshCw className="animate-spin" /></div>
                            ) : result?.error ? (
                              <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 p-4 text-center"><AlertCircle size={24} className="mb-2 opacity-50" /><span className="text-xs font-mono">{result.error}</span></div>
                            ) : result && chartDef ? (
                              <DataVisualizer result={result} initialConfig={chartDef.config} readOnly={true} />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs">
                                {chartDef ? 'Waiting for data...' : 'Chart definition not found'}
                              </div>
                            )}
                          </div>
                          
                          <div className="h-6 bg-slate-900 border-t border-slate-800 px-3 flex items-center justify-between text-[10px] text-slate-600 font-mono">
                              <span className="truncate">{getDbName(chartDef.dbId)}</span>
                              {result && <span>{result.executionTimeMs}ms</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add Row Button (Bottom) */}
              {isDesignerMode && (
                  <button 
                    onClick={handleAddRow}
                    className="w-full py-4 border-2 border-dashed border-slate-800 hover:border-slate-600 hover:bg-slate-900 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-300 transition-all"
                  >
                      <Plus size={20} className="mr-2" /> Add Layout Row
                  </button>
              )}
          </div>
      </div>
    </div>
  );
};

export default Dashboard;