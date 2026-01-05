
import React, { useState, useEffect } from 'react';
import { DialectRegistry, DbDialect, DbaInsight } from '../services/dialects/SqlDialects';
import { dbaHistoryService } from '../services/dbaHistoryService';
import { DbaHistoryRecord, DbSchema } from '../types';
import { muulService } from '../services/muulService';
import { dbaAdvisorService, AdvisorResult } from '../services/dbaAdvisorService';
import { 
  Gauge, ShieldAlert, Zap, HardDrive, Search, 
  Activity, Split, TrendingUp, Cpu, History, 
  Database as DbIcon, Server, Camera, Trash2, ChevronRight,
  LayoutGrid, DatabaseBackup, Wrench, Lock, Stethoscope, CheckCircle, AlertTriangle, AlertOctagon
} from 'lucide-react';

interface DbaPanelProps {
  dialect: DbDialect;
  dbId: string;
  dbName: string;
  onSelectInsight: (insight: DbaInsight) => void;
  onViewHistory: (record: DbaHistoryRecord) => void;
  onLaunchDashboard: () => void; 
  customInsights?: Partial<Record<string, DbaInsight[]>>;
  activeSchema?: DbSchema; // Passed for instant schema audit
}

const DbaPanel: React.FC<DbaPanelProps> = ({ dialect, dbId, dbName, onSelectInsight, onViewHistory, onLaunchDashboard, customInsights, activeSchema }) => {
  const [activeView, setActiveView] = useState<'insights' | 'history' | 'advisor'>('insights');
  const [context, setContext] = useState<'server' | 'database'>('database');
  const [history, setHistory] = useState<DbaHistoryRecord[]>([]);
  
  // Advisor State
  const [advisorResults, setAdvisorResults] = useState<AdvisorResult[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);

  useEffect(() => {
    if (activeView === 'history') {
      setHistory(dbaHistoryService.getHistory(dbId));
    }
    if (activeView === 'advisor') {
      runAudit();
    }
  }, [dbId, activeView]);

  const runAudit = async () => {
    setIsAuditing(true);
    setAdvisorResults([]);
    try {
       // 1. Audit Schema (Instant)
       let results: AdvisorResult[] = [];
       if (activeSchema) {
          results = [...results, ...dbaAdvisorService.auditSchema(activeSchema)];
       }

       // 2. Audit Config (Async fetch)
       const dialectDef = DialectRegistry[dialect];
       if (dialectDef) {
          // Identify the config query by ID convention 'ms-config' or 'pg-settings'
          const configInsight = dialectDef.insights.find(i => i.id === 'ms-config' || i.id === 'pg-settings');
          if (configInsight) {
             try {
                const res = await muulService.executeQuery(dbId, configInsight.query, 'audit-config');
                const configIssues = dbaAdvisorService.auditConfiguration(dialect, res.rows.map((r, i) => {
                   // Map rows to object based on columns
                   const obj: any = {};
                   res.columns.forEach((c, idx) => obj[c] = r[idx]);
                   return obj;
                }));
                results = [...results, ...configIssues];
             } catch (e) {
                console.error("Config audit failed", e);
             }
          }
       }
       setAdvisorResults(results);
    } finally {
       setIsAuditing(false);
    }
  };

  const getInsights = (): DbaInsight[] => {
    const registryInsights = DialectRegistry[dialect]?.insights || [];
    const custom = (customInsights as Record<string, DbaInsight[]> | undefined)?.[dialect];
    return custom ? custom : registryInsights;
  };

  const insights = getInsights().filter(i => i.context === context);
  const categories = Array.from(new Set(insights.map(i => i.category))) as string[];

  const getIcon = (category: string) => {
    switch (category) {
      case 'Performance': return <Zap size={14} className="text-yellow-500" />;
      case 'Storage': return <HardDrive size={14} className="text-blue-500" />;
      case 'Indexes': return <Search size={14} className="text-purple-500" />;
      case 'Fragmentation': return <Split size={14} className="text-red-500" />;
      case 'Expensive Queries': return <TrendingUp size={14} className="text-amber-500" />;
      case 'System': return <Cpu size={14} className="text-cyan-500" />;
      case 'Backups': return <DatabaseBackup size={14} className="text-green-500" />;
      case 'Maintenance': return <Wrench size={14} className="text-slate-400" />;
      case 'Locks': return <Lock size={14} className="text-orange-500" />;
      default: return <Activity size={14} className="text-slate-500" />;
    }
  };

  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dbaHistoryService.deleteRecord(id);
    setHistory(prev => prev.filter(r => r.id !== id));
  };

  const renderAdvisorResult = (r: AdvisorResult) => {
     let color = 'text-green-500 border-green-500/30 bg-green-500/5';
     let Icon = CheckCircle;
     if (r.severity === 'Critical') { color = 'text-red-500 border-red-500/30 bg-red-500/10'; Icon = AlertOctagon; }
     if (r.severity === 'Warning') { color = 'text-amber-500 border-amber-500/30 bg-amber-500/10'; Icon = AlertTriangle; }

     return (
        <div key={r.id} className={`p-3 rounded border ${color} mb-2`}>
           <div className="flex items-center justify-between mb-1">
              <div className="flex items-center font-bold text-xs">
                 <Icon size={14} className="mr-2" /> {r.title}
              </div>
              <span className="text-[9px] uppercase tracking-wider font-mono opacity-70">{r.category}</span>
           </div>
           <p className="text-[11px] opacity-90 leading-snug">{r.message}</p>
           {r.recommendation && (
              <div className="mt-2 text-[10px] font-mono bg-black/20 p-1.5 rounded flex items-start">
                 <Wrench size={10} className="mr-1.5 mt-0.5 opacity-70" /> {r.recommendation}
              </div>
           )}
        </div>
     );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 animate-in slide-in-from-left-2 duration-200 border-r border-slate-800 shrink-0 overflow-hidden">
      <div className="p-4 border-b border-slate-800 bg-slate-850">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center text-blue-400">
            <ShieldAlert size={18} className="mr-2" />
            <h2 className="font-bold text-sm uppercase tracking-wider">DBA Studio</h2>
          </div>
          <div className="flex bg-slate-900 p-0.5 rounded border border-slate-700">
            <button 
              onClick={() => setActiveView('insights')}
              className={`p-1 rounded transition-colors ${activeView === 'insights' ? 'bg-slate-700 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
              title="Diagnostic Insights"
            >
              <Zap size={14} />
            </button>
            <button 
              onClick={() => setActiveView('advisor')}
              className={`p-1 rounded transition-colors ${activeView === 'advisor' ? 'bg-slate-700 text-green-400' : 'text-slate-500 hover:text-slate-300'}`}
              title="Health Advisor"
            >
              <Stethoscope size={14} />
            </button>
            <button 
              onClick={() => setActiveView('history')}
              className={`p-1 rounded transition-colors ${activeView === 'history' ? 'bg-slate-700 text-purple-400' : 'text-slate-500 hover:text-slate-300'}`}
              title="Snapshot History"
            >
              <History size={14} />
            </button>
          </div>
        </div>

        <button 
          onClick={onLaunchDashboard}
          className="w-full mb-3 flex items-center justify-center p-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold uppercase transition-all shadow-lg shadow-blue-900/20"
        >
          <LayoutGrid size={14} className="mr-2" /> Performance Dashboard
        </button>

        {activeView === 'insights' && (
          <div className="flex p-0.5 bg-slate-900 rounded-lg border border-slate-800">
             <button 
               onClick={() => setContext('database')}
               className={`flex-1 flex items-center justify-center py-1.5 text-[10px] font-bold uppercase rounded ${context === 'database' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-800'}`}
             >
               <DbIcon size={12} className="mr-1.5" /> Database
             </button>
             <button 
               onClick={() => setContext('server')}
               className={`flex-1 flex items-center justify-center py-1.5 text-[10px] font-bold uppercase rounded ${context === 'server' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-800'}`}
             >
               <Server size={12} className="mr-1.5" /> Server
             </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
        {activeView === 'insights' ? (
          <div className="space-y-4">
            {categories.map(cat => (
              <div key={cat} className="space-y-1">
                <h3 className="px-2 py-1 text-[10px] font-bold text-slate-600 uppercase tracking-widest flex items-center bg-slate-800/20 rounded">
                   {getIcon(cat)} <span className="ml-2">{cat}</span>
                </h3>
                <div className="space-y-0.5">
                  {insights.filter(i => i.category === cat).map(i => (
                    <button
                      key={i.id}
                      onClick={() => onSelectInsight(i)}
                      className="w-full text-left p-2 rounded hover:bg-slate-800 transition-all group flex flex-col border border-transparent hover:border-slate-700"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300 group-hover:text-blue-400">{i.title}</span>
                        {i.impact === 'High' && <span className="w-1.5 h-1.5 rounded-full bg-red-500" title="High Impact" />}
                      </div>
                      <span className="text-[10px] text-slate-500 line-clamp-2 leading-tight mt-0.5">{i.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : activeView === 'advisor' ? (
          <div className="space-y-3 px-1">
             <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center justify-between">
                <span>Health Scorecard</span>
                <button onClick={runAudit} className="hover:text-white"><Stethoscope size={12} /></button>
             </div>
             {isAuditing ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-500 space-y-2">
                   <Activity className="animate-spin text-green-500" />
                   <span className="text-xs">Running Heuristic Scan...</span>
                </div>
             ) : advisorResults.length > 0 ? (
                advisorResults.map(renderAdvisorResult)
             ) : (
                <div className="text-center py-10 text-slate-600 text-xs">
                   No specific recommendations found.
                </div>
             )}
          </div>
        ) : (
          <div className="space-y-2">
            {history.length > 0 ? (
              history.map(record => (
                <div 
                  key={record.id}
                  onClick={() => onViewHistory(record)}
                  className="w-full p-2.5 rounded bg-slate-800/40 hover:bg-slate-800 border border-slate-700/50 hover:border-blue-500/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-blue-400 uppercase">{record.insightTitle}</span>
                    <button 
                      onClick={(e) => handleDeleteHistory(record.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="flex items-center text-[10px] text-slate-500">
                    <Activity size={10} className="mr-1" />
                    <span>{new Date(record.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-600 text-center px-4">
                 <Camera size={40} className="mb-2 opacity-10" />
                 <p className="text-xs font-medium">No snapshots taken yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="p-3 bg-slate-950 border-t border-slate-800">
        <div className="flex items-center p-2 rounded bg-blue-900/10 border border-blue-500/20">
          <Activity size={12} className="text-blue-400 mr-2 shrink-0" />
          <span className="text-[10px] text-blue-300 leading-tight">Connected: <span className="text-white font-mono">{dbName}</span></span>
        </div>
      </div>
    </div>
  );
};

export default DbaPanel;
