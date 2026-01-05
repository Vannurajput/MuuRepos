import React, { useMemo, useState, useEffect } from 'react';
import { QueryResult, ChartConfig, ChartType } from '../types';
import { 
  ResponsiveContainer
} from 'recharts';
import { 
  Pin, Save, Layers, Sigma, ArrowRight, RefreshCw
} from 'lucide-react';
import { VisualizationRegistry } from './visualizations/VisualizationRegistry';
import { CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';


interface DataVisualizerProps {
  result: QueryResult;
  initialConfig?: ChartConfig;
  onPin?: (config: ChartConfig) => void;
  onSave?: (config: ChartConfig) => void;
  onUpdate?: (config: ChartConfig) => void; // New prop for updating
  onApplyAggregation?: (dimension: string, metric: string, func: string) => void;
  readOnly?: boolean; 
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1'];

const DataVisualizer: React.FC<DataVisualizerProps> = ({ result, initialConfig, onPin, onSave, onUpdate, onApplyAggregation, readOnly = false }) => {
  const [chartType, setChartType] = useState<ChartType>(initialConfig?.type || 'bar');
  const [xAxisKey, setXAxisKey] = useState<string>(initialConfig?.xAxisKey || '');
  const [dataKeys, setDataKeys] = useState<string[]>(initialConfig?.dataKeys || []);
  const [isStacked, setIsStacked] = useState<boolean>(!!initialConfig?.stackId);

  // Aggregation State
  const [aggDimension, setAggDimension] = useState<string>('');
  const [aggMetric, setAggMetric] = useState<string>('');
  const [aggFunc, setAggFunc] = useState<string>('COUNT');
  const [showAggPanel, setShowAggPanel] = useState(false);

  // Sync with props
  useEffect(() => {
    if (initialConfig) {
      setChartType(initialConfig.type);
      setXAxisKey(initialConfig.xAxisKey);
      setDataKeys(initialConfig.dataKeys);
      setIsStacked(!!initialConfig.stackId);
    }
  }, [initialConfig]);

  // Memoize data processing to avoid recalculation on every render
  const { numericColumns, stringColumns, formattedData } = useMemo(() => {
    if (!result || !result.rows.length) {
      return { numericColumns: [], stringColumns: [], formattedData: [] };
    }

    const cols = result.columns;
    const numCols: string[] = [];
    const strCols: string[] = [];

    // Analyze first row for types
    const sampleRow = result.rows[0];
    cols.forEach((col, idx) => {
      const val = sampleRow[idx];
      if (typeof val === 'number') numCols.push(col);
      else strCols.push(col);
    });

    // Transform array of arrays to array of objects
    const data = result.rows.map(row => {
      const obj: any = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });

    return { numericColumns: numCols, stringColumns: strCols, formattedData: data };
  }, [result]);

  // Intelligent Defaults
  useEffect(() => {
    if (initialConfig || formattedData.length === 0) return;

    if (!xAxisKey) {
       // Prefer string column for X axis, otherwise first column
       const defaultX = stringColumns.length > 0 ? stringColumns[0] : result.columns[0];
       setXAxisKey(defaultX);
       setAggDimension(defaultX);
    }
    if (dataKeys.length === 0 && numericColumns.length > 0) {
       setDataKeys([numericColumns[0]]);
       setAggMetric(numericColumns[0]);
    } else if (result.columns.length > 0) {
       setAggMetric(result.columns[0]);
    }
  }, [formattedData, initialConfig]);

  if (result.error) return <div className="h-full flex items-center justify-center text-red-400 p-4">{result.error}</div>;
  if (result.rows.length === 0) return <div className="h-full flex items-center justify-center text-slate-500">No data to visualize</div>;

  // --- Handlers ---

  const handleDataKeyToggle = (key: string) => {
    setDataKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleAggregationSubmit = () => {
    if (onApplyAggregation && aggDimension && aggMetric && aggFunc) {
      onApplyAggregation(aggDimension, aggMetric, aggFunc);
    }
  };

  const currentConfig: ChartConfig = {
    type: chartType,
    xAxisKey,
    dataKeys,
    stackId: isStacked ? 'a' : undefined
  };

  // --- Render Chart Content ---
  const renderChart = () => {
    const vizDef = VisualizationRegistry[chartType];
    if (!vizDef) {
      return <div className="flex items-center justify-center h-full text-slate-500">Unknown chart type: {chartType}</div>;
    }

    const VizComponent = vizDef.render;
    
    const commonAxisProps = {
      stroke: "#94a3b8",
      fontSize: 12,
      tickFormatter: (val: any) => `${val}`.length > 10 ? `${val}`.substring(0, 10) + '..' : val
    };

    const commonProps = {
      colors: COLORS,
      grid: <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />,
      xAxis: <XAxis dataKey={xAxisKey} {...commonAxisProps} />,
      yAxis: <YAxis {...commonAxisProps} />,
      tooltip: <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9', borderRadius: '8px' }} itemStyle={{ color: '#e2e8f0' }} />,
      legend: <Legend />
    };

    return <VizComponent data={formattedData} config={currentConfig} commonProps={commonProps} isReadOnly={readOnly} />;
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      
      {/* Config Panel - Only visible when not readOnly */}
      {!readOnly && (
        <div className="p-3 border-b border-slate-800 bg-slate-850 flex flex-col space-y-2">
          
          <div className="flex flex-wrap items-center justify-between gap-4">
            
            {/* 1. Chart Type Selector */}
            <div className="flex space-x-1 bg-slate-800 p-1 rounded-lg">
               {Object.entries(VisualizationRegistry).map(([type, { name, icon: Icon }]) => (
                   <button 
                    key={type}
                    onClick={() => setChartType(type as ChartType)}
                    className={`p-2 rounded transition-colors ${chartType === type ? 'bg-slate-700 text-blue-400 shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
                    title={name}
                   >
                       <Icon size={18} />
                   </button>
               ))}
            </div>

            {/* 2. Series Configuration */}
            <div className="flex flex-1 items-center space-x-4 min-w-[200px]">
                {/* X Axis */}
                <div className="flex flex-col">
                    <label className="text-[10px] text-slate-500 font-bold uppercase mb-0.5">X Axis</label>
                    <select 
                        value={xAxisKey} 
                        onChange={e => setXAxisKey(e.target.value)}
                        className="bg-slate-800 text-xs text-slate-200 border border-slate-700 rounded px-2 py-1.5 focus:border-blue-500 outline-none w-32"
                    >
                        {result.columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                {/* Y Axis / Series (Multi-Select UI) */}
                <div className="flex flex-col flex-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase mb-0.5 flex items-center justify-between">
                        <span>Series / Values</span>
                        {(chartType === 'bar' || chartType === 'area') && (
                            <button 
                                onClick={() => setIsStacked(!isStacked)}
                                className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] border ${isStacked ? 'bg-blue-900/30 border-blue-600 text-blue-300' : 'border-slate-700 text-slate-500'}`}
                            >
                                <Layers size={10} /> <span>Stack</span>
                            </button>
                        )}
                    </label>
                    <div className="flex flex-wrap gap-2 max-h-[60px] overflow-y-auto no-scrollbar items-center">
                        {numericColumns.length > 0 ? numericColumns.map(col => (
                            <button
                                key={col}
                                onClick={() => handleDataKeyToggle(col)}
                                className={`flex items-center text-xs px-2 py-1 rounded-full border transition-all ${
                                    dataKeys.includes(col) 
                                    ? 'bg-blue-600 border-blue-500 text-white shadow-sm' 
                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                                }`}
                            >
                                {col}
                            </button>
                        )) : <span className="text-xs text-slate-600 italic">No numeric columns found</span>}
                    </div>
                </div>
            </div>

            {/* 3. Action Buttons */}
            <div className="flex items-center space-x-2 border-l border-slate-800 pl-4">
                 <button
                    onClick={() => setShowAggPanel(!showAggPanel)}
                    className={`flex items-center px-3 py-1.5 rounded border transition-all text-xs ${showAggPanel ? 'bg-purple-900/30 border-purple-500 text-purple-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}`}
                    title="SQL Aggregation"
                 >
                     <Sigma size={14} className="mr-2" /> Summarize
                 </button>
                 
                 {onUpdate ? (
                     <button 
                        onClick={() => onUpdate(currentConfig)}
                        className="flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs rounded border border-green-500 shadow transition-all animate-in fade-in"
                     >
                        <RefreshCw size={14} className="mr-2" /> Update Chart
                     </button>
                 ) : onPin && (
                   <button 
                     onClick={() => onPin(currentConfig)}
                     className="flex items-center px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 transition-all hover:border-blue-500 hover:text-blue-400"
                   >
                     <Pin size={14} className="mr-2" /> Pin
                   </button>
                 )}
                 {onSave && (
                    <button 
                      onClick={() => onSave(currentConfig)}
                      className="flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded shadow transition-all"
                    >
                      <Save size={14} className="mr-2" /> Save
                    </button>
                 )}
            </div>
          </div>

          {/* Aggregation Panel (Expandable) */}
          {showAggPanel && (
              <div className="flex items-center bg-slate-900/50 border border-slate-800 p-2 rounded-lg space-x-3 text-xs animate-in slide-in-from-top-2 duration-200">
                  <div className="flex flex-col">
                      <label className="text-[9px] uppercase text-slate-500 font-bold mb-0.5">Dimension (Group By)</label>
                      <select 
                        value={aggDimension}
                        onChange={(e) => setAggDimension(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 outline-none focus:border-purple-500 text-slate-300 w-32"
                      >
                          {result.columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                  </div>
                  <div className="flex flex-col">
                      <label className="text-[9px] uppercase text-slate-500 font-bold mb-0.5">Measure (Value)</label>
                      <select 
                        value={aggMetric}
                        onChange={(e) => setAggMetric(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 outline-none focus:border-purple-500 text-slate-300 w-32"
                      >
                           {result.columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                  </div>
                  <div className="flex flex-col">
                      <label className="text-[9px] uppercase text-slate-500 font-bold mb-0.5">Function</label>
                      <select 
                        value={aggFunc}
                        onChange={(e) => setAggFunc(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 outline-none focus:border-purple-500 text-slate-300 w-24"
                      >
                          {['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                  </div>
                  <div className="flex flex-col justify-end h-full pt-4">
                      <button 
                        onClick={handleAggregationSubmit}
                        className="flex items-center px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded shadow-sm hover:shadow-purple-500/20 transition-all"
                      >
                          <ArrowRight size={12} className="mr-1" /> Run Query
                      </button>
                  </div>
              </div>
          )}
        </div>
      )}

      {/* Render Area */}
      <div className="flex-1 min-h-0 p-2">
        <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DataVisualizer;