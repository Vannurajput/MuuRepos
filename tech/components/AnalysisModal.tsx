
import React from 'react';
import { ProjectAnalysisReport } from '../types';
import AnalysisViewer from './AnalysisViewer';
import Icon from './Icon';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ProjectAnalysisReport | null;
  onFileLinkClick: (path: string) => void;
}

const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose, report, onFileLinkClick }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={onClose}>
      <div
        className="flex flex-col w-11/12 max-w-6xl h-5/6 bg-gray-800 border border-gray-700 rounded-lg shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
          <h2 className="text-xl font-semibold text-white">Project Analysis Report</h2>
          <button onClick={onClose} className="p-1 text-white rounded-full hover:bg-gray-700">
            <Icon name="close" />
          </button>
        </div>
        
        <div className="flex-1 min-h-0">
          {report ? (
            <AnalysisViewer report={report} onFileLinkClick={onFileLinkClick} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              No analysis report available. Run a scan from the Project menu.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisModal;
