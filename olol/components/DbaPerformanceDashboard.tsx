import React, { useState, useEffect } from 'react';
import { Database, QueryResult } from '../types';
import { muulService } from '../services/muulService';
import { DialectRegistry, DbaInsight } from '../services/dialects/SqlDialects';
import DataTable from './DataTable';
import { 
  Activity, AlertTriangle, CheckCircle, 
  RefreshCw, Server, Zap, HardDrive, ShieldAlert,
  Code, ChevronUp, Terminal, ExternalLink, Search, Info
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Label } from 'recharts';

interface DbaPerformanceDashboardProps {
  database: Database;
  customInsights?: Partial<Record<string, DbaInsight[]>>;
}

const HealthGauge = ({ value, title, unit = '%' }: { value: number, title: string, unit?: string }) => {
  const data = [
    { name: 'Value', value: value },
    { name: 'Remaining', value: Math.max(0, 100 - value) }
  ];
  const color = value > 90 ? '#10b981' : value > 70 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <div className="h-40 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="80%"
              startAngle={180}
              endAngle={0}
              innerRadius={60}
              outerRadius={80}
              paddingAngle={0}
              dataKey="value"
            >
              <Cell fill={color} />
              <Cell fill="#1e293b" />
              <Label 
                value={`${value.toFixed(1)}${unit}`} 
                position="centerBottom" 
                fill="#f1f5f9" 
                style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'monospace' }} 
              />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest -mt-4">{title}</span>
    </div>
  );
};

const DbaPerformanceDashboard: React.FC<DbaPerformanceDashboardProps> = ({ database, customInsights }) => {
  const [results, setResults] = useState<Record<string, QueryResult>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSql, setShowSql] = useState<Record<string, boolean>>({});

  const getInsights = () => {
    const registryInsights = DialectRegistry[database.type]?.insights || [];
    const custom = customInsights?.[database.type];
    return custom ? custom : registryInsights;
  };

  const dashboardInsights = getInsights();

  const refreshAll = async () => {
    setIsRefreshing(true);
    const newResults: Record<string, QueryResult> = { ...results };
    const newLoading: Record<string, boolean> = {};

    dashboardInsights.forEach(i => newLoading[i.id] = true);
    setLoading(newLoading);

    await Promise.all(dashboardInsights.map(async (insight) => {
      try {
        const res = await muulService.executeQuery(database.id, insight.query, `dba-dash-${insight.id}`);
        newResults[insight.id] = res;
      } catch (e) {
        console.error(`DBA Dash Error [${insight.title}]:`, e);
      } finally {
        setLoading(prev => ({ ...prev, [insight.id]: false }));
      }
    }));

    setResults(newResults);
    setIsRefreshing(false);
  };

  useEffect(() => {
    refreshAll();
  }, [database.id]);

  const toggleSql = (id: string) => {
    setShowSql(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAction = async (action: string, rowData: any) => {
    if (action === 'INVESTIGATE') {
      const resource = rowData[3]; // Resource index for blockers
      let investigationQuery = '';
      
      if (database.type === 'mssql') {
          // Attempt to parse OBJECT_ID from wait_resource
          investigationQuery = `-- Investigation of locked resource: ${resource}\nSELECT OBJECT_NAME(PARSENAME('${resource}', 3)) AS [TableName];`;
      } else {
          investigationQuery = `-- Investigation of PG PID: ${rowData[0]}\nSELECT * FROM pg_locks WHERE pid = ${rowData[0]};`;
      }
      
      alert(`Investigation initialized for resource: ${resource}\nLaunching Diagnostic Bridge...`);
      // In a real app, this would open a new tab with the generated investigation query
    }
  };

  const renderWidget = (insight: DbaInsight) => {
    const result = results[insight.id];
    const isLoading = loading[insight.id];
    const isShowingSql = showSql[insight.id];

    // Check if result is a single numeric KPI
    const isKPI = result && 
                  result.rowCount === 1 && 
                  result.columns.length === 1 && 
                  typeof result.rows[0][0] === 'number';

    return (
      <div key={insight.id} className="bg-slate-900 border border-slate-800 rounded shadow-2xl flex flex-col transition-all hover:border-slate-600">
        <div className="px-3 py-1.5 bg-slate-850 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <Terminal size={12} className="text-slate-500" />
            <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">{insight.title}</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button 
                onClick={() => toggleSql(insight.id)} 
                className={`text-[9px] px-1.5 py-0.5 rounded font-mono transition-all ${isShowingSql ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300 bg-slate-800 border border-slate-700'}`}
            >
                SQL
            </button>
            {isLoading && <RefreshCw size={10} className="animate-spin text-blue-400" />}
          </div>
        </div>
        
        <div className="flex-1 min-h-[260px] relative flex flex-col bg-slate-950/20">
          {isShowingSql && (
              <div className="absolute inset-0 z-30 bg-slate-950/98 p-3 overflow-auto border-b border-slate-800 animate-in slide-in-from-top duration-150">
                  <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800/50">
                    <span className="text-[9px] font-mono text-blue-400 uppercase tracking-widest">Diagnostic Logic</span>
                    <button onClick={() => toggleSql(insight.id)} className="text-slate-500 hover:text-white"><ChevronUp size={12}/></button>
                  </div>
                  <pre className="text-[10px] font-mono text-slate-400 whitespace-pre-wrap break-all leading-normal bg-slate-900/50 p-2 rounded border border-slate-800/50 shadow-inner">
                      {insight.query}
                  </pre>
                  <p className="mt-2 text-[9px] text-slate-500 italic leading-snug">{insight.description}</p>
              </div>
          )}

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {!result ? (
                <div className="flex-1 flex items-center justify-center text-slate-700 text-[9px] font-mono uppercase tracking-[0.2em] animate-pulse">
                   Querying Infrastructure...
                </div>
            ) : result.error ? (
                <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                   <AlertTriangle size={24} className="text-red-900 mb-2" />
                   <p className="text-[9px] text-red-500/80 font-mono break-all bg-red-900/5 p-2 rounded border border-red-500/10">{result.error}</p>
                </div>
            ) : (
                <div className="flex-1 overflow-auto flex flex-col">
                  {isKPI ? (
                    <HealthGauge value={result.rows[0][0]} title={result.columns[0]} />
                  ) : (
                    <div className="flex-1 text-[10px] overflow-auto scrollbar-hide">
                        <div className="transform origin-top-left scale-[0.92] w-[108.7%] h-[108.7%]">
                           <DataTable result={result} onAction={handleAction} />
                        </div>
                    </div>
                  )}
                </div>
            )}
          </div>
        </div>

        <div className="px-2 py-1 bg-slate-950 border-t border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-2">
             <span className="text-[8px] font-mono text-slate-600 uppercase tracking-tighter">{insight.category}</span>
          </div>
          {result && (
            <div className="flex items-center space-x-2 text-[8px] font-mono text-slate-500">
               <span>Rows: {result.rowCount}</span>
               <span className="w-1 h-1 rounded-full bg-slate-800" />
               <span>{result.executionTimeMs}ms</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 overflow-hidden animate-in fade-in duration-300">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 shrink-0">
         <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
               <Activity size={18} className="text-blue-500" />
               <h2 className="text-xs font-black text-slate-200 uppercase tracking-[0.2em]">Diagnostic Command Center</h2>
            </div>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center space-x-4 text-[10px] font-mono">
               <span className="text-slate-500 uppercase">Engine: <span className="text-blue-400 font-bold">{database.type}</span></span>
               <span className="text-slate-500 uppercase">Status: <span className="text-green-500 font-bold">Auditing</span></span>
            </div>
         </div>
         <button 
           onClick={refreshAll}
           disabled={isRefreshing}
           className="flex items-center px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[10px] font-bold rounded shadow-lg shadow-blue-900/20 transition-all active:scale-95"
         >
           <RefreshCw size={12} className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`} /> Full Diagnostic Sweep
         </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin bg-slate-950">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 pb-12">
          {dashboardInsights.map(renderWidget)}
        </div>
      </div>

      <footer className="h-8 bg-slate-900 border-t border-slate-800 px-6 flex items-center justify-between text-[9px] font-mono text-slate-600 shrink-0">
         <div className="flex items-center">
            <ShieldAlert size={10} className="text-blue-500 mr-2" />
            <span>Infrastructure Health Monitoring: <span className="text-slate-400">{database.name}</span></span>
         </div>
         <div className="flex items-center space-x-4">
            <span className="animate-pulse flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2" /> Live Connection</span>
            <span className="text-slate-700">|</span>
            <span>HUD_SYS_VER: 5.0.0_STABLE</span>
         </div>
      </footer>
    </div>
  );
};

export default DbaPerformanceDashboard;