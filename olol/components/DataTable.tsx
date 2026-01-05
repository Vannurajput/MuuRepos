import React, { useState, useMemo } from 'react';
import { QueryResult } from '../types';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Zap } from 'lucide-react';

interface DataTableProps {
  result: QueryResult;
  onAction?: (actionName: string, rowData: any) => void;
}

const DataTable: React.FC<DataTableProps> = ({ result, onAction }) => {
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset page when result changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [result.timestamp]);

  const totalPages = Math.ceil(result.rows.length / pageSize);
  
  const currentRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return result.rows.slice(start, start + pageSize);
  }, [result.rows, currentPage, pageSize]);

  if (result.error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-red-400">
        <div className="text-4xl mb-4">⚠️</div>
        <h3 className="text-xl font-bold mb-2">Execution Error</h3>
        <p className="font-mono bg-red-950/30 p-4 rounded border border-red-900/50 max-w-2xl whitespace-pre-wrap">
          {result.error}
        </p>
      </div>
    );
  }

  if (result.rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <p className="text-lg">Query executed successfully. No data returned.</p>
        <p className="text-sm mt-2 font-mono text-slate-600">{result.rowCount} rows affected.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Controls */}
      <div className="flex items-center justify-between p-2 bg-slate-850 border-b border-slate-800 shrink-0">
        <div className="text-xs text-slate-400 font-mono">
          {result.rows.length} rows • {result.executionTimeMs}ms
        </div>
        <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm">
                <span className="text-slate-400">Rows:</span>
                <select 
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                >
                    <option value={10}>10</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={1000}>1000</option>
                </select>
            </div>
            <div className="flex items-center space-x-1">
                <button 
                    onClick={() => setCurrentPage(1)} 
                    disabled={currentPage === 1}
                    className="p-1 hover:bg-slate-700 rounded disabled:opacity-30"
                >
                    <ChevronsLeft size={16} />
                </button>
                <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                    disabled={currentPage === 1}
                    className="p-1 hover:bg-slate-700 rounded disabled:opacity-30"
                >
                    <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-mono w-16 text-center text-slate-400">
                    {currentPage} / {totalPages}
                </span>
                <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                    disabled={currentPage === totalPages}
                    className="p-1 hover:bg-slate-700 rounded disabled:opacity-30"
                >
                    <ChevronRight size={16} />
                </button>
                <button 
                    onClick={() => setCurrentPage(totalPages)} 
                    disabled={currentPage === totalPages}
                    className="p-1 hover:bg-slate-700 rounded disabled:opacity-30"
                >
                    <ChevronsRight size={16} />
                </button>
            </div>
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="bg-slate-800 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="p-2 border-b border-slate-700 text-xs font-semibold text-slate-500 w-12 text-center">#</th>
              {result.columns.map((col, idx) => (
                <th key={idx} className="p-3 border-b border-slate-700 text-xs font-bold text-slate-300 font-mono whitespace-nowrap min-w-[100px] uppercase tracking-wider">
                  {col.startsWith('ACTION_') ? col.replace('ACTION_', '') : col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {currentRows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-blue-900/10 transition-colors group">
                <td className="p-2 text-xs text-slate-600 text-center font-mono border-r border-slate-800/50">
                   {(currentPage - 1) * pageSize + rowIndex + 1}
                </td>
                {row.map((cell: any, cellIndex: number) => {
                    const colName = result.columns[cellIndex];
                    
                    // Action Button Logic
                    if (typeof cell === 'string' && cell === 'ACTION_INVESTIGATE') {
                        return (
                          <td key={cellIndex} className="p-2 px-3 border-r border-slate-800/50 whitespace-nowrap">
                            <button 
                              onClick={() => onAction?.('INVESTIGATE', row)}
                              className="flex items-center px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase rounded shadow-sm shadow-blue-900/50 transition-all active:scale-95"
                            >
                              <Search size={10} className="mr-1.5" /> Investigate
                            </button>
                          </td>
                        );
                    }

                    let displayValue = cell;
                    if (typeof cell === 'object' && cell !== null) {
                        displayValue = JSON.stringify(cell);
                    }
                    if (cell === null) displayValue = <span className="text-slate-600 italic">NULL</span>;
                    if (typeof cell === 'boolean') displayValue = cell ? 'TRUE' : 'FALSE';

                    return (
                        <td key={cellIndex} className="p-2 px-3 text-slate-300 whitespace-nowrap overflow-hidden text-ellipsis max-w-lg border-r border-slate-800/50 font-mono text-[11px]">
                          {displayValue}
                        </td>
                    );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;