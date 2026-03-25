import React, { useState } from 'react';
import { DeepFileAnalysis } from '../types';
import { generateLogicFlow } from '../services/logicFlowService';

interface AccordionSectionProps {
    title: string;
    count: number;
    children: React.ReactNode;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({ title, count, children }) => {
    const [isOpen, setIsOpen] = useState(true);
    if (count === 0) return null;

    return (
        <div className="mb-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-2 bg-gray-700/50 rounded-md text-lg font-bold text-gray-200 mb-2 hover:bg-gray-700"
            >
                <span>{title} ({count})</span>
                <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {isOpen && <div className="pl-2">{children}</div>}
        </div>
    );
};

const DefinitionItem: React.FC<{ definition: DeepFileAnalysis['definitions'][0] }> = ({ definition }) => {
    const [isAlgoVisible, setIsAlgoVisible] = useState(false);
    const [isFlowVisible, setIsFlowVisible] = useState(false);
    const [algoFlow, setAlgoFlow] = useState<string | null>(null);
    const isFunction = definition.type === 'function';

    const handleToggleFlow = () => {
        if (!isFlowVisible && !algoFlow) {
            // Generate on first open
            const flow = generateLogicFlow(definition.algorithm || '');
            setAlgoFlow(flow);
        }
        setIsFlowVisible(!isFlowVisible);
    };

    return (
        <li className="p-1.5 bg-gray-800/50 rounded">
            <div className="flex items-center justify-between font-mono">
                <code>
                    <span className="text-gray-400">L{definition.line}:</span> <span className="text-purple-400">{definition.type}</span> <span className="text-cyan-400">{definition.symbol}</span>
                </code>
                <div className="flex items-center space-x-2">
                     {isFunction && (
                        <button
                            onClick={handleToggleFlow}
                            className="px-2 py-0.5 text-xs text-gray-300 bg-gray-700 rounded hover:bg-gray-600"
                        >
                            {isFlowVisible ? 'Hide Flow' : 'Show Flow'}
                        </button>
                    )}
                    {definition.algorithm && (
                        <button
                            onClick={() => setIsAlgoVisible(!isAlgoVisible)}
                            className="px-2 py-0.5 text-xs text-gray-300 bg-gray-700 rounded hover:bg-gray-600"
                        >
                            {isAlgoVisible ? 'Hide Algo' : 'Show Algo'}
                        </button>
                    )}
                </div>
            </div>
             {isFlowVisible && (
                 <pre className="mt-2 p-2 bg-gray-900/70 rounded-md overflow-x-auto text-xs text-gray-300 whitespace-pre-wrap">
                    <code>{algoFlow}</code>
                </pre>
            )}
            {isAlgoVisible && (
                 <pre className="mt-2 p-2 bg-gray-900/70 rounded-md overflow-x-auto text-xs text-gray-300">
                    <code>{definition.algorithm}</code>
                </pre>
            )}
        </li>
    );
};

const DeepFileAnalysisDetail: React.FC<{ analysis: DeepFileAnalysis; onFileLinkClick: (path: string) => void; }> = ({ analysis, onFileLinkClick }) => {
    return (
        <div className="p-4 text-gray-300">
            <h3 className="text-xl font-bold text-white mb-4 break-all">{analysis.fileName}</h3>
            
            <AccordionSection title="Defined Symbols" count={analysis.definitions.length}>
                <ul className="space-y-1">
                    {analysis.definitions.map((def, i) => (
                        <DefinitionItem key={`${def.symbol}-${i}`} definition={def} />
                    ))}
                </ul>
            </AccordionSection>
            
            <AccordionSection title="External Usages" count={analysis.usages.length}>
                 <ul className="space-y-1 font-mono">
                    {analysis.usages.map((use, i) => (
                        <li key={`${use.symbol}-${i}`} className="p-1.5 bg-gray-800/50 rounded">
                            <code>
                                <span className="text-gray-400">L{use.line}:</span> Uses <span className="text-blue-400">{use.symbol}</span> from <a onClick={() => onFileLinkClick(use.targetFile)} className="text-green-400 hover:underline cursor-pointer">{use.targetFile}</a>
                            </code>
                        </li>
                    ))}
                </ul>
            </AccordionSection>
        </div>
    );
};

export default DeepFileAnalysisDetail;
