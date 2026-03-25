import React, { useState, useEffect } from 'react';
import { FileTab } from '../types';
import { generateAlgoYAML } from '../services/logicFlowService';

interface AlgoPanelProps {
  file: FileTab;
  allFiles: FileTab[];
  onFileLinkClick: (path: string) => void;
}

const AlgoPanel: React.FC<AlgoPanelProps> = ({ file }) => {
  const [algoYaml, setAlgoYaml] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    if (file) {
        const yamlOutput = generateAlgoYAML(file);
        setAlgoYaml(yamlOutput);
    } else {
        setAlgoYaml('');
    }
    setIsLoading(false);
  }, [file]);

  return (
    <div className="flex flex-col w-full h-full bg-gray-900 border-l border-gray-700">
      <div className="p-2 bg-gray-800 border-b border-gray-700 shrink-0">
        <h3 className="font-semibold text-white">Document Breakdown</h3>
      </div>
      <div className="flex-1 w-full h-full p-4 overflow-auto text-gray-300">
        {isLoading ? (
          <p>Analyzing...</p>
        ) : (
            <pre className="p-3 bg-gray-800/50 rounded-md overflow-x-auto text-sm text-gray-300 whitespace-pre-wrap">
                <code>{algoYaml}</code>
            </pre>
        )}
      </div>
    </div>
  );
};

export default AlgoPanel;