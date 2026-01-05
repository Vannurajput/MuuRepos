import React, { useMemo } from 'react';
import ReactFlow, { 
  Node, Edge, Background, Controls, 
  MarkerType, Position 
} from 'reactflow';
import { Network, Database, Layers, Filter, Zap, Info } from 'lucide-react';

interface PlanVisualizerProps {
  planData: string; // JSON string or XML string
  dialect?: string;
}

const PlanVisualizer: React.FC<PlanVisualizerProps> = ({ planData, dialect }) => {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    
    try {
      if (planData.trim().startsWith('[') || planData.trim().startsWith('{')) {
        // --- Postgres JSON Parsing ---
        const raw = JSON.parse(planData);
        const plan = Array.isArray(raw) ? raw[0].Plan : raw.Plan;
        
        let idCounter = 0;
        const traverse = (p: any, x: number, y: number, parentId?: string): number => {
          const currentId = `n-${idCounter++}`;
          const nodeType = p['Node Type'];
          
          nodes.push({
            id: currentId,
            position: { x, y },
            data: { 
              label: (
                <div className="p-2 min-w-[150px] bg-slate-900 border border-slate-700 rounded text-slate-100 text-[10px] font-mono shadow-xl">
                  <div className="flex items-center space-x-2 border-b border-slate-800 pb-1 mb-1">
                    <Zap size={12} className="text-yellow-400" />
                    <span className="font-bold uppercase tracking-tight">{nodeType}</span>
                  </div>
                  <div className="space-y-0.5">
                    {p['Relation Name'] && <div className="text-blue-400">Src: {p['Relation Name']}</div>}
                    <div>Cost: {p['Total Cost'] || p['Startup Cost']}</div>
                    <div>Rows: {p['Plan Rows']}</div>
                    {p['Actual Rows'] !== undefined && <div className="text-green-400">Actual: {p['Actual Rows']}</div>}
                  </div>
                </div>
              )
            },
            type: 'default',
          });

          if (parentId) {
            edges.push({
              id: `e-${parentId}-${currentId}`,
              source: currentId,
              target: parentId,
              animated: true,
              style: { stroke: '#475569' },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
            });
          }

          if (p.Plans) {
            let totalWidth = (p.Plans.length - 1) * 200;
            let currentX = x - totalWidth / 2;
            p.Plans.forEach((child: any) => {
              traverse(child, currentX, y + 150, currentId);
              currentX += 200;
            });
          }
          return idCounter;
        };

        if (plan) traverse(plan, 400, 50);
      } else if (planData.trim().startsWith('<')) {
        // --- SQL Server XML Parsing (Simplified Tree) ---
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(planData, "text/xml");
        const relOps = Array.from(xmlDoc.getElementsByTagName('RelOp'));
        
        relOps.forEach((op, i) => {
          const nodeType = op.getAttribute('PhysicalOp') || op.getAttribute('LogicalOp') || 'Operator';
          const estimatedCost = op.getAttribute('EstimatedTotalSubtreeCost');
          const id = `ms-${i}`;
          
          nodes.push({
            id,
            position: { x: 400, y: i * 120 },
            data: {
                label: (
                  <div className="p-2 min-w-[150px] bg-slate-900 border border-slate-700 rounded text-slate-100 text-[10px] font-mono shadow-xl">
                    <div className="flex items-center space-x-2 border-b border-slate-800 pb-1 mb-1">
                      <Layers size={12} className="text-blue-400" />
                      <span className="font-bold uppercase">{nodeType}</span>
                    </div>
                    <div>Est. Cost: {estimatedCost}</div>
                  </div>
                )
            }
          });
          
          if (i > 0) {
            edges.push({
              id: `mse-${i-1}-${i}`,
              source: `ms-${i}`,
              target: `ms-${i-1}`,
              animated: true,
              style: { stroke: '#475569' },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
            });
          }
        });
      }
    } catch (e) {
      console.error("Plan Visualizer failed", e);
    }

    return { nodes, edges };
  }, [planData]);

  if (nodes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
        <Network size={48} className="opacity-20" />
        <p className="text-xs uppercase font-bold tracking-widest">Unable to parse execution plan graph</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-slate-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        className="bg-slate-950"
      >
        <Background color="#1e293b" gap={20} />
        <Controls className="bg-slate-800 border-slate-700 fill-slate-200" />
      </ReactFlow>
    </div>
  );
};

export default PlanVisualizer;