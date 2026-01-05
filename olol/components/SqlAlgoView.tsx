import React, { useMemo } from 'react';
import { 
  Database, Layers, SortAsc, 
  Box, RefreshCw, Zap, Info, Hash, 
  ChevronRight, Network, GitBranch, Terminal, X
} from 'lucide-react';

interface SqlAlgoViewProps {
  sql: string;
  dbType?: string;
  onClose?: () => void;
}

interface AlgoNode {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  type: 'cte' | 'retrieve' | 'join' | 'filter' | 'group' | 'sort' | 'project' | 'union' | 'subquery';
  children?: AlgoNode[];
  cost?: string;
}

const SqlAlgoView: React.FC<SqlAlgoViewProps> = ({ sql, onClose }) => {
  const blueprint = useMemo(() => {
    if (!sql.trim()) return [];
    
    // Robust cleaning
    const cleanSql = sql
      .replace(/--.*$/gm, '') 
      .replace(/\/\*[\s\S]*?\*\//g, '') 
      .trim();
    
    const upperSql = cleanSql.toUpperCase();
    const nodes: AlgoNode[] = [];

    // --- 1. CTE Hierarchical Detection ---
    if (upperSql.includes('WITH')) {
      const cteRegex = /(?:WITH|(?:\s*,\s*))\s*(?:RECURSIVE\s+)?([\w$]+)\s+AS\s*\(([\s\S]+?)\)/gi;
      let match;
      while ((match = cteRegex.exec(cleanSql)) !== null) {
        const cteName = match[1];
        const cteContent = match[2];
        
        nodes.push({
          id: `cte-${cteName}`,
          icon: <Box size={14} className="text-orange-400" />,
          title: `CTE: ${cteName.toUpperCase()}`,
          description: "Temporary named result set initialized in memory.",
          type: 'cte',
          cost: 'Low-Medium',
          children: parseQueryBlock(cteContent)
        });
      }
    }

    // --- 2. Main Query Block Detection ---
    const mainBody = cleanSql.replace(/WITH\s+[\s\S]+?AS\s*\([\s\S]+?\)/i, '').trim();
    if (mainBody) {
       if (mainBody.toUpperCase().includes(' UNION ')) {
          const unionParts = mainBody.split(/ UNION (?:ALL )?/gi);
          nodes.push({
            id: 'union-main',
            icon: <GitBranch size={14} className="text-cyan-400" />,
            title: "SET OPERATOR (UNION)",
            description: "Concatenate multiple independent queries into a single stream.",
            type: 'union',
            cost: 'High',
            children: unionParts.flatMap((part, i) => ([
                {
                    id: `union-branch-${i}`,
                    icon: <Terminal size={12} className="text-slate-500" />,
                    title: `BRANCH ${i + 1}`,
                    description: "Independent query execution path.",
                    type: 'subquery',
                    children: parseQueryBlock(part)
                }
            ]))
          });
       } else {
          nodes.push(...parseQueryBlock(mainBody));
       }
    }

    return nodes;
  }, [sql]);

  function parseQueryBlock(block: string): AlgoNode[] {
    const steps: AlgoNode[] = [];
    const upperBlock = block.toUpperCase();

    const fromMatch = block.match(/FROM\s+["`]?([\w$]+)["`]?\s*(?:AS\s+)?([\w$]+)?/i);
    if (fromMatch) {
      steps.push({
        id: `get-${fromMatch[1]}`,
        icon: <Database size={14} className="text-blue-400" />,
        title: "DATA SCAN",
        description: `Source: [${fromMatch[1].toLowerCase()}]${fromMatch[2] ? ` (as "${fromMatch[2]}")` : ''}.`,
        type: 'retrieve'
      });
    }

    const joinMatches = Array.from(block.matchAll(/(LEFT|RIGHT|INNER|CROSS|NATURAL)?\s*JOIN\s+["`]?([\w$]+)["`]?\s*(?:AS\s+)?([\w$]+)?\s+ON/gi));
    joinMatches.forEach((m, i) => {
        steps.push({
            id: `join-${i}`,
            icon: <Layers size={14} className="text-purple-400" />,
            title: `CORRELATION (${(m[1] || 'INNER').toUpperCase()})`,
            description: `Extend with [${m[2].toLowerCase()}]${m[3] ? ` (as "${m[3]}")` : ''}.`,
            type: 'join',
            cost: 'Medium-High'
        });
    });

    if (block.match(/\(\s*SELECT[\s\S]+\)/i)) {
        steps.push({
            id: 'nested-block',
            icon: <Network size={14} className="text-pink-400" />,
            title: "NESTED EXECUTION",
            description: "Inner sub-routine required before parent completion.",
            type: 'subquery',
            cost: 'Variable'
        });
    }

    if (upperBlock.includes(' WHERE ')) {
      steps.push({
        id: 'where-filter',
        icon: <Filter size={14} className="text-red-400" />,
        title: "LOGICAL PRUNING",
        description: "Apply row-level filtering to reduce memory pressure.",
        type: 'filter'
      });
    }

    if (upperBlock.includes('GROUP BY') || upperBlock.includes(' COUNT(') || upperBlock.includes(' SUM(')) {
        steps.push({
          id: 'grouping',
          icon: <Zap size={14} className="text-yellow-400" />,
          title: "DATA AGGREGATION",
          description: "Collapse records into summary statistics.",
          type: 'group',
          cost: 'Medium'
        });
    }

    if (upperBlock.includes('ORDER BY')) {
        steps.push({
          id: 'sorting',
          icon: <SortAsc size={14} className="text-cyan-400" />,
          title: "RESULT SEQUENCING",
          description: "Sort buffers by specified keys.",
          type: 'sort'
        });
    }

    return steps;
  }

  const renderNode = (node: AlgoNode, depth: number = 0) => (
    <div key={node.id} className="relative">
      <div 
        className={`group relative pl-6 mb-3 transition-all duration-300`}
        style={{ marginLeft: depth > 0 ? '12px' : '0' }}
      >
        {depth > 0 && (
          <div className="absolute left-[-10px] top-[14px] w-[16px] h-px bg-slate-700" />
        )}
        
        {node.children && node.children.length > 0 && (
          <div className="absolute left-[7px] top-[24px] bottom-0 w-px bg-slate-800" />
        )}

        <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center z-10 group-hover:border-blue-500 transition-all shadow-lg">
            <span className="text-[7px] font-bold text-slate-500 group-hover:text-blue-400">
                {depth + 1}
            </span>
        </div>

        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 hover:border-slate-600/60 transition-all hover:bg-slate-900/60 shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center space-x-2">
              {node.icon}
              <h4 className="text-[9px] font-black text-slate-100 uppercase tracking-widest">{node.title}</h4>
            </div>
            {node.cost && (
              <span className={`text-[8px] font-mono px-1 rounded ${
                node.cost.includes('High') ? 'text-red-400 bg-red-400/10' : 'text-slate-500 bg-slate-800'
              }`}>
                {node.cost} COST
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 font-mono leading-snug">
            {node.description}
          </p>
        </div>
      </div>
      
      {node.children && (
        <div className="ml-2 border-l border-slate-800/50">
          {node.children.map(child => renderNode(child, depth + 1))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 border-l border-slate-800 animate-in slide-in-from-right-2 duration-300 overflow-hidden">
      <div className="p-3 border-b border-slate-800 bg-slate-850 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center space-x-2">
          <Network size={14} className="text-blue-400" />
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Execution Blueprint</h2>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide bg-slate-950/20">
        {blueprint.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-700 space-y-3">
            <RefreshCw size={32} className="opacity-10 animate-spin-slow" />
            <p className="text-[9px] uppercase font-bold tracking-[0.3em]">Parsing Complex Syntax...</p>
          </div>
        ) : (
          blueprint.map(node => renderNode(node))
        )}
      </div>

      <div className="p-3 bg-slate-950 border-t border-slate-800 shrink-0">
         <div className="flex items-center justify-between text-[9px] font-mono text-slate-600">
            <div className="flex items-center space-x-2">
                <Zap size={10} className="text-blue-500" />
                <span>HIERARCHICAL_PLAN v4.0</span>
            </div>
            <span>Logical Depth: {calculateMaxDepth(blueprint)}</span>
         </div>
      </div>
    </div>
  );
};

function calculateMaxDepth(nodes: AlgoNode[]): number {
    if (!nodes || nodes.length === 0) return 0;
    return 1 + Math.max(0, ...nodes.map(n => calculateMaxDepth(n.children || [])));
}

const Filter = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
);

const NetworkIcon = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="9" y="3" width="6" height="6" rx="1"></rect><rect x="9" y="15" width="6" height="6" rx="1"></rect><rect x="2" y="9" width="6" height="6" rx="1"></rect><rect x="16" y="9" width="6" height="6" rx="1"></rect><path d="M12 9v6"></path><path d="M8 12h8"></path></svg>
);

export default SqlAlgoView;