
import React, { useState, useMemo, useEffect } from 'react';
import { QueryResult, ChartConfig } from '../types.ts';
import { 
  Table as TableIcon, LayoutTemplate, 
  PanelBottom, PanelRight, PanelLeft, AppWindow, 
  GripHorizontal, Sparkles, Wand2, Network, X, Play, RefreshCw,
  Info, AlertCircle
} from 'lucide-react';
import DataTable from './DataTable.tsx';
import DataVisualizer from './DataVisualizer.tsx';
import PlanVisualizer from './PlanVisualizer.tsx';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';

interface ResultsPaneProps {
  result: QueryResult | null;
  viewMode: 'table' | 'chart' | 'plan';
  setViewMode: (mode: 'table' | 'chart' | 'plan') => void;
  layout: 'bottom' | 'right' | 'left' | 'float';
  setLayout: (layout: 'bottom' | 'right' | 'left' | 'float') => void;
  onHeaderMouseDown?: (e: React.MouseEvent) => void;
  onPinChart?: (config: ChartConfig) => void;
  onUpdateChart?: (config: ChartConfig) => void;
  onApplyAggregation?: (dimension: string, metric: string, func: string) => void;
  initialChartConfig?: ChartConfig;
  queryText?: string;
  dbType?: string;
}

const ResultsPane: React.FC<ResultsPaneProps> = ({ 
  result, 
  viewMode, 
  setViewMode, 
  layout, 
  setLayout,
  onHeaderMouseDown,
  onPinChart,
  onUpdateChart,
  onApplyAggregation,
  initialChartConfig,
  queryText,
  dbType
}) => {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);

  // --- Logic: Execution Plan Sniffing ---
  const planInfo = useMemo(() => {
    if (!result || result.rows.length === 0 || result.columns.length === 0) return null;
    
    const firstCell = String(result.rows[0][0]);
    const colNames = result.columns.map(c => c.toUpperCase());
    
    const isPostgresPlan = colNames.some(c => c.includes('PLAN')) && 
                          (firstCell.startsWith('[') || firstCell.startsWith('{'));
    
    const isMssqlPlan = (colNames.some(c => c.includes('PLAN') || c.includes('XML')) && 
                        (firstCell.includes('<ShowPlanXML') || firstCell.includes('<RelOp'))) ||
                        (dbType === 'mssql' && firstCell.includes('<'));
    
    if (isPostgresPlan) return { data: firstCell, type: 'postgres' };
    if (isMssqlPlan) return { data: firstCell, type: 'mssql' };
    
    return null;
  }, [result, dbType]);

  // Auto-switch to 'plan' if one is found
  useEffect(() => {
    if (planInfo && viewMode === 'table' && !aiAdvice) {
      setViewMode('plan');
    }
  }, [planInfo, setViewMode]);

  // --- AI Analysis Handler (Gemini) ---
  const handleAiAnalyze = async () => {
    if (!result || !queryText) return;
    setIsAiLoading(true);
    setAiAdvice(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const sampleData = result.rows.slice(0, 5).map(row => 
        row.map(cell => (typeof cell === 'object' && cell !== null) ? JSON.stringify(cell) : cell)
      );
      
      const prompt = `Act as a world-class Senior Staff Database Administrator. Analyze this query and its results.
      
      DATABASE CONTEXT:
      Dialect: ${dbType || 'SQL'}
      Execution Time: ${result.executionTimeMs}ms
      Rows Returned: ${result.rowCount}
      
      SQL QUERY:
      ${queryText}
      
      SAMPLE RESULTS (First 5 rows):
      ${JSON.stringify(sampleData)}

      TASK:
      1. Critique the query for performance anti-patterns (e.g. SELECT *, lack of indexes, N+1).
      2. Suggest specific indexes or schema changes to improve this specific operation.
      3. Propose a refactored version of the SQL if possible.
      4. If execution time is high relative to row count, explain why.

      Format your response in professional Markdown. Use tables or code blocks where appropriate.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt
      });
      
      if (response.text) {
        setAiAdvice(response.text);
      }
    } catch (err: any) {
      console.error("AI Analysis Error:", err);
      setAiAdvice(`### ⚠️ Analysis Interrupted\n\n${err.message || "The AI Advisor encountered an error."}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 overflow-hidden relative border-t border-slate-800">
      
      {/* HEADER TOOLBAR */}
      <div 
        className={`h-10 border-b border-slate-800 flex items-center justify-between px-3 bg-slate-850 select-none shrink-0 ${layout === 'float' ? 'cursor-move' : ''}`}
        onMouseDown={layout === 'float' ? onHeaderMouseDown : undefined}
      >
        <div className="flex items-center space-x-2">
          <div className="flex bg-slate-950 p-0.5 rounded border border-slate-800">
            <button 
              onClick={() => { setViewMode('table'); setAiAdvice(null); }}
              className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${viewMode === 'table' && !aiAdvice ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <TableIcon size={12} className="mr-1.5 inline" /> Data
            </button>
            <button 
              onClick={() => { setViewMode('chart'); setAiAdvice(null); }}
              className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${viewMode === 'chart' && !aiAdvice ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <LayoutTemplate size={12} className="mr-1.5 inline" /> Viz
            </button>
            {planInfo && (
              <button 
                onClick={() => { setViewMode('plan'); setAiAdvice(null); }}
                className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${viewMode === 'plan' && !aiAdvice ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <Network size={12} className="mr-1.5 inline" /> Plan
              </button>
            )}
          </div>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {result && !result.error && (
            <button 
              onClick={handleAiAnalyze}
              disabled={isAiLoading}
              className={`px-3 py-1 text-[10px] font-bold rounded border transition-all flex items-center ${aiAdvice ? 'bg-purple-900/30 border-purple-500 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.1)]' : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-purple-500 hover:text-purple-400'}`}
            >
              {isAiLoading ? (
                <><RefreshCw size={12} className="mr-1.5 animate-spin" /> Analyzing...</>
              ) : (
                <><Sparkles size={12} className="mr-1.5" /> {aiAdvice ? 'Analysis' : 'Ask Lead DBA'}</>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center space-x-1" onMouseDown={e => e.stopPropagation()}>
          <button onClick={() => setLayout('bottom')} className={`p-1.5 rounded hover:bg-slate-800 ${layout === 'bottom' ? 'text-blue-400' : 'text-slate-600'}`} title="Dock Bottom"><PanelBottom size={14} /></button>
          <button onClick={() => setLayout('right')} className={`p-1.5 rounded hover:bg-slate-800 ${layout === 'right' ? 'text-blue-400' : 'text-slate-600'}`} title="Dock Right"><PanelRight size={14} /></button>
          <button onClick={() => setLayout('left')} className={`p-1.5 rounded hover:bg-slate-800 ${layout === 'left' ? 'text-blue-400' : 'text-slate-600'}`} title="Dock Left"><PanelLeft size={14} /></button>
          <button onClick={() => setLayout('float')} className={`p-1.5 rounded hover:bg-slate-800 ${layout === 'float' ? 'text-blue-400' : 'text-slate-600'}`} title="Float Mode"><AppWindow size={14} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative bg-slate-950">
        {!result ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-800">
            <Play size={48} className="opacity-10 mb-2" />
            <p className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase opacity-30">Execution Pending</p>
          </div>
        ) : aiAdvice ? (
          <div className="absolute inset-0 bg-slate-950 p-6 overflow-auto animate-in fade-in slide-in-from-bottom-2 duration-300 z-50">
            <div className="max-w-3xl mx-auto pb-12">
              <div className="flex items-center justify-between mb-6 pb-2 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <Wand2 size={16} className="text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-100">Senior DBA Analysis</h2>
                  </div>
                </div>
                <button onClick={() => setAiAdvice(null)} className="p-1 hover:bg-slate-800 rounded-full text-slate-500 hover:text-white transition-all"><X size={18} /></button>
              </div>
              
              <div className="prose prose-invert prose-sm max-w-none text-slate-300">
                <ReactMarkdown>{aiAdvice}</ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full w-full">
            {viewMode === 'table' && <DataTable result={result} />}
            {viewMode === 'chart' && (
              <DataVisualizer 
                result={result} 
                initialConfig={initialChartConfig}
                onPin={onPinChart} 
                onUpdate={onUpdateChart}
                onApplyAggregation={onApplyAggregation}
              />
            )}
            {viewMode === 'plan' && (
              <PlanVisualizer planData={planInfo?.data || ''} dialect={planInfo?.type} />
            )}
          </div>
        )}
      </div>

      {result && !aiAdvice && (
        <div className="h-6 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-3 shrink-0 text-[9px] font-mono text-slate-500 uppercase tracking-tighter">
          <div className="flex items-center space-x-4">
             <span>{result.rowCount.toLocaleString()} ROWS</span>
             <span>{result.executionTimeMs}MS</span>
          </div>
          <div>{dbType || 'SQL'} ENGINE</div>
        </div>
      )}
    </div>
  );
};

export default ResultsPane;
