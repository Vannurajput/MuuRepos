
import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Square, Link2, Columns, Settings2, Play, Table as TableIcon } from 'lucide-react';
import { TableDefinition } from '../types';

export interface PendingJoin {
  newTable: TableDefinition;
  existingTable: string;
  joinCondition: string;
  isLogical?: boolean;
  isHeuristic?: boolean;
}

interface JoinBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (batch: { tableName: string, existingTable: string, columns: string[], joinSql: string }[]) => void;
  pendingJoins: PendingJoin[];
}

const JoinBuilderModal: React.FC<JoinBuilderModalProps> = ({ 
  isOpen, onClose, onConfirm, pendingJoins 
}) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [selections, setSelections] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    if (isOpen && pendingJoins.length > 0) {
      const initial: Record<string, Set<string>> = {};
      pendingJoins.forEach(pj => {
        // Default to selecting non-key columns mostly, or all columns for small tables
        initial[pj.newTable.name] = new Set(pj.newTable.columns.map(c => c.name));
      });
      setSelections(initial);
      setActiveIdx(0);
    }
  }, [isOpen, pendingJoins]);

  if (!isOpen || pendingJoins.length === 0) return null;

  const currentJoin = pendingJoins[activeIdx];
  const currentSelected = selections[currentJoin.newTable.name] || new Set();

  const toggleColumn = (name: string) => {
    const next = new Set(currentSelected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelections(prev => ({ ...prev, [currentJoin.newTable.name]: next }));
  };

  const toggleAll = () => {
    if (currentSelected.size === currentJoin.newTable.columns.length) {
      setSelections(prev => ({ ...prev, [currentJoin.newTable.name]: new Set() }));
    } else {
      setSelections(prev => ({ ...prev, [currentJoin.newTable.name]: new Set(currentJoin.newTable.columns.map(c => c.name)) }));
    }
  };

  const handleFinish = () => {
    const batchResults = pendingJoins.map(pj => ({
      tableName: pj.newTable.name,
      existingTable: pj.existingTable,
      columns: Array.from(selections[pj.newTable.name] || []),
      joinSql: pj.joinCondition
    }));
    onConfirm(batchResults);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh] ring-1 ring-white/10">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Link2 size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {pendingJoins.length > 1 ? `Join Orchestrator (${activeIdx + 1}/${pendingJoins.length})` : 'Join Configuration'}
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs for Batch */}
        {pendingJoins.length > 1 && (
          <div className="flex bg-slate-900 border-b border-slate-800 overflow-x-auto no-scrollbar p-1">
            {pendingJoins.map((pj, i) => (
              <button
                key={pj.newTable.name}
                onClick={() => setActiveIdx(i)}
                className={`flex items-center px-4 py-2 text-xs font-bold uppercase tracking-tight rounded mr-1 transition-all whitespace-nowrap ${
                  activeIdx === i ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'text-slate-500 hover:bg-slate-800'
                }`}
              >
                <TableIcon size={12} className="mr-2" /> {pj.newTable.name}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
              <Settings2 size={12} className="mr-2" /> 
              {currentJoin.isLogical
                ? 'Logical Relationship'
                : currentJoin.isHeuristic
                ? 'Heuristic Match (Name Based)'
                : 'Verified Foreign Key'}
            </label>
            <div className={`p-3 bg-slate-950 rounded-lg border font-mono text-sm shadow-inner ${
                currentJoin.isLogical ? 'border-purple-800 text-purple-400' :
                currentJoin.isHeuristic ? 'border-yellow-800 text-yellow-400' : 'border-slate-800 text-blue-400'
            }`}>
              JOIN "{currentJoin.newTable.name}" ON {currentJoin.joinCondition}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                <Columns size={12} className="mr-2" /> Select Columns for Output
              </label>
              <button onClick={toggleAll} className="text-[10px] text-blue-500 hover:text-blue-400 font-bold uppercase tracking-tight">
                {currentSelected.size === currentJoin.newTable.columns.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {currentJoin.newTable.columns.map(col => (
                <div 
                  key={col.name}
                  onClick={() => toggleColumn(col.name)}
                  className={`flex items-center p-2 rounded-lg border cursor-pointer transition-all ${
                    currentSelected.has(col.name) 
                    ? 'bg-blue-600/10 border-blue-500/50 text-blue-100' 
                    : 'bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-700'
                  }`}
                >
                  <div className={`mr-3 ${currentSelected.has(col.name) ? 'text-blue-400' : 'text-slate-700'}`}>
                    {currentSelected.has(col.name) ? <CheckSquare size={16} /> : <Square size={16} />}
                  </div>
                  <div className="flex flex-col truncate">
                    <span className="text-xs font-medium truncate">{col.name}</span>
                    <span className="text-[9px] font-mono opacity-50 uppercase">{col.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-850 border-t border-slate-800 flex items-center justify-between">
          <div className="flex space-x-2">
             {activeIdx > 0 && (
               <button onClick={() => setActiveIdx(activeIdx - 1)} className="px-4 py-2 text-xs text-slate-400 hover:text-white">Previous</button>
             )}
          </div>
          <div className="flex space-x-3">
            <button onClick={onClose} className="px-4 py-2 text-xs text-slate-400 hover:text-white">Cancel</button>
            {activeIdx < pendingJoins.length - 1 ? (
              <button onClick={() => setActiveIdx(activeIdx + 1)} className="px-6 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg">Next Table</button>
            ) : (
              <button onClick={handleFinish} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-lg flex items-center">
                <Play size={14} className="mr-2 fill-current" /> Inject Join
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinBuilderModal;
