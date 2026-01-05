
import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Square, Columns, Wand2, Search } from 'lucide-react';
import { TableDefinition } from '../types';

interface ProjectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selections: Record<string, string[]>) => void;
  activeTables: TableDefinition[];
  initialSelections: Record<string, string[]>;
}

const ProjectionModal: React.FC<ProjectionModalProps> = ({ 
  isOpen, onClose, onConfirm, activeTables, initialSelections 
}) => {
  const [selections, setSelections] = useState<Record<string, Set<string>>>({});
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      const next: Record<string, Set<string>> = {};
      activeTables.forEach(t => {
        next[t.name] = new Set(initialSelections[t.name] || []);
      });
      setSelections(next);
    }
  }, [isOpen, activeTables, initialSelections]);

  if (!isOpen) return null;

  const toggleColumn = (tableName: string, colName: string) => {
    setSelections(prev => {
      const nextSet = new Set(prev[tableName] || []);
      if (nextSet.has(colName)) nextSet.delete(colName);
      else nextSet.add(colName);
      return { ...prev, [tableName]: nextSet };
    });
  };

  const handleApply = () => {
    const final: Record<string, string[]> = {};
    // Fix: Explicitly cast Object.entries to ensure 'set' is correctly inferred as Set<string> instead of unknown.
    (Object.entries(selections) as [string, Set<string>][]).forEach(([table, set]) => {
      final[table] = Array.from(set);
    });
    onConfirm(final);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
        <div className="px-6 py-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Wand2 className="text-blue-400" size={20} />
            <h2 className="text-lg font-bold text-white">Projection Builder</h2>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
              <input 
                type="text" 
                placeholder="Filter columns..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
              />
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeTables.map(table => (
            <div key={table.name} className="space-y-3 bg-slate-950/30 p-4 rounded-xl border border-slate-800/50">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center">
                  <Columns size={12} className="mr-2" /> {table.name}
                </h3>
              </div>
              <div className="space-y-1">
                {table.columns
                  .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map(col => (
                  <div 
                    key={col.name}
                    onClick={() => toggleColumn(table.name, col.name)}
                    className={`flex items-center p-2 rounded-lg border cursor-pointer transition-all ${
                      selections[table.name]?.has(col.name) 
                      ? 'bg-blue-600/10 border-blue-500/50 text-blue-100' 
                      : 'bg-slate-950/50 border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400'
                    }`}
                  >
                    {selections[table.name]?.has(col.name) ? <CheckSquare size={14} className="mr-2 text-blue-400" /> : <Square size={14} className="mr-2" />}
                    <span className="text-xs truncate">{col.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-slate-850 border-t border-slate-800 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 text-xs text-slate-400 hover:text-white">Cancel</button>
          <button 
            onClick={handleApply}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-900/20"
          >
            Update Query SELECT
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectionModal;
