
import React, { useMemo, useState, useEffect } from 'react';
import ReactFlow, { 
  Node, Edge, Background, Controls, 
  Handle, Position, MarkerType,
  useNodesState, useEdgesState,
  Panel,
  getRectOfNodes,
  getTransformForBounds
} from 'reactflow';
import { toPng, toSvg } from 'html-to-image';
import { DbSchema, SchemaLayout, TableDefinition } from '../types';
import { Key, Link, Table, Plus, Save, Trash2, Eye, EyeOff, Layout, Search, CheckSquare, Square, X, Download, Image, FileCode, FileText } from 'lucide-react';

const TableNode = ({ data }: { data: TableDefinition & { onRemove: (name: string) => void } }) => {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[200px] text-sm group">
      <div className="bg-slate-800 border-b border-slate-700 px-3 py-2 font-bold text-slate-200 flex items-center justify-between">
         <div className="flex items-center">
             <Table size={14} className="mr-2 text-blue-400" />
             {data.name}
         </div>
         <button 
            className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); data.onRemove(data.name); }}
         >
             <X size={14} />
         </button>
      </div>
      <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto scrollbar-hide">
        {data.columns.map((col) => (
          <div key={col.name} className="flex items-center justify-between group relative px-1 py-0.5 rounded hover:bg-slate-800/50">
            <Handle 
                type="target" 
                position={Position.Left} 
                id={`target-${col.name}`} 
                style={{ background: col.isForeignKey ? '#3b82f6' : '#64748b', width: 6, height: 6, left: -6 }}
            />
            <div className="flex items-center">
              {col.isPrimaryKey && <Key size={10} className="mr-1.5 text-yellow-400 fill-yellow-400/20" />}
              {col.isForeignKey && <Link size={10} className="mr-1.5 text-blue-400" />}
              <span className={`${col.isPrimaryKey ? 'text-slate-100 font-medium' : 'text-slate-400'}`}>
                {col.name}
              </span>
            </div>
            <span className="text-[10px] text-slate-600 font-mono ml-4 uppercase">{col.type}</span>
            <Handle 
                type="source" 
                position={Position.Right} 
                id={`source-${col.name}`} 
                style={{ background: col.isPrimaryKey ? '#f59e0b' : '#64748b', width: 6, height: 6, right: -6 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const nodeTypes = { tableNode: TableNode };

interface SchemaVisualizerProps {
  schema: DbSchema;
  dbName: string;
  layouts: SchemaLayout[];
  activeLayoutId: string | null;
  onLayoutCreate: (name: string, tables: string[]) => void;
  onLayoutSelect: (layoutId: string) => void;
  onLayoutUpdate: (layoutId: string, tables: string[]) => void;
  onLayoutDelete: (layoutId: string) => void;
}

const SchemaVisualizer: React.FC<SchemaVisualizerProps> = ({ 
    schema, dbName, layouts, activeLayoutId, onLayoutCreate, onLayoutSelect, onLayoutUpdate, onLayoutDelete 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const activeLayout = layouts.find(l => l.id === activeLayoutId);
  const visibleTableNames = useMemo(() => activeLayout ? new Set(activeLayout.tables) : new Set(schema.tables.map(t => t.name)), [activeLayout, schema]);

  const { initialNodes, initialEdges } = useMemo(() => {
      const nodes: Node[] = [];
      const edges: Edge[] = [];
      const PADDING = 400;
      const COL_COUNT = 3;
      const visibleTables = schema.tables.filter(t => visibleTableNames.has(t.name));

      visibleTables.forEach((tbl, index) => {
          const row = Math.floor(index / COL_COUNT);
          const col = index % COL_COUNT;
          nodes.push({
              id: tbl.name,
              type: 'tableNode',
              position: { x: col * PADDING, y: row * PADDING },
              data: { ...tbl, onRemove: (name: string) => {} }
          });

          tbl.columns.forEach(column => {
              if (column.isForeignKey && column.references && visibleTableNames.has(column.references.table)) {
                  edges.push({
                      id: `e-${tbl.name}-${column.name}`,
                      source: column.references.table,
                      sourceHandle: `source-${column.references.column}`,
                      target: tbl.name,
                      targetHandle: `target-${column.name}`,
                      animated: true,
                      style: { stroke: '#3b82f6', strokeWidth: 2 },
                      markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
                      type: 'smoothstep'
                  });
              }
          });
      });
      return { initialNodes: nodes, initialEdges: edges };
  }, [schema, visibleTableNames]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => { setNodes(initialNodes); setEdges(initialEdges); }, [initialNodes, initialEdges]);

  return (
    <div className="w-full h-full bg-slate-950 flex">
        <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-slate-900 border-r border-slate-800 transition-all flex flex-col overflow-hidden shrink-0 z-10`}>
            <div className="p-3 border-b border-slate-800 bg-slate-850">
                <div className="relative">
                  <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="text" placeholder="Filter tables..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded pl-8 pr-2 py-1.5 text-xs focus:border-blue-500 outline-none text-slate-200" />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
                {schema.tables.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase())).map(t => (
                    <div key={t.name} className="flex items-center px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-800 rounded transition-colors cursor-default">
                      <CheckSquare size={14} className="mr-2 text-blue-500" /> {t.name}
                    </div>
                ))}
            </div>
        </div>
        <div className="flex-1 h-full relative">
            <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} nodeTypes={nodeTypes} fitView className="bg-slate-950">
                <Background color="#1e293b" gap={24} size={1} />
                <Controls className="bg-slate-800 border-slate-700 fill-slate-200" />
            </ReactFlow>
        </div>
    </div>
  );
};

export default SchemaVisualizer;
