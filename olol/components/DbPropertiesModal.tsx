
import React from 'react';
import { X, Database, Info, Key, Link2, Search, Table as TableIcon, Activity } from 'lucide-react';
import { DbStats } from '../types';

interface DbPropertiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  dbName: string;
  stats: DbStats | null;
}

const DbPropertiesModal: React.FC<DbPropertiesModalProps> = ({ isOpen, onClose, dbName, stats }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/10">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Database size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Database Properties</h2>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{dbName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {!stats ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Activity className="text-blue-500 animate-spin" size={32} />
              <p className="text-xs text-slate-500 font-mono">CALCULATING TOPOLOGY...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <StatCard icon={<TableIcon size={16}/>} label="Total Tables" value={stats.tableCount} color="blue" />
              <StatCard icon={<Search size={16}/>} label="Secondary Indexes" value={stats.indexCount} color="purple" />
              <StatCard icon={<Key size={16}/>} label="Primary Keys" value={stats.pkCount} color="yellow" />
              <StatCard icon={<Link2 size={16}/>} label="Foreign Keys" value={stats.fkCount} color="green" />
              
              <div className="col-span-2 mt-4 p-4 bg-slate-950/50 rounded-xl border border-slate-800 flex items-start space-x-3">
                 <Info size={16} className="text-slate-500 mt-0.5 shrink-0" />
                 <div className="space-y-1">
                    <p className="text-[11px] text-slate-300 font-medium">Schema Complexity Score: {Math.round((stats.fkCount + stats.indexCount) / (stats.tableCount || 1) * 10) / 10}</p>
                    <p className="text-[10px] text-slate-500 leading-relaxed">This score indicates the level of normalization and indexing efficiency relative to the total entity count.</p>
                 </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-850 border-t border-slate-800 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, color }: { icon: any, label: string, value: number, color: string }) => {
  const colors: any = {
    blue: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    purple: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    yellow: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    green: 'text-green-400 bg-green-400/10 border-green-400/20',
  };

  return (
    <div className={`p-4 rounded-xl border ${colors[color]} flex flex-col space-y-2`}>
       <div className="flex items-center space-x-2">
          {icon}
          <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</span>
       </div>
       <div className="text-2xl font-mono font-bold">{value}</div>
    </div>
  );
};

export default DbPropertiesModal;
