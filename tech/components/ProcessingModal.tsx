
import React from 'react';

interface ProcessingModalProps {
  isOpen: boolean;
  processed: number;
  total: number;
  scanType: 'shallow' | 'deep';
}

const ProcessingModal: React.FC<ProcessingModalProps> = ({ isOpen, processed, total, scanType }) => {
  if (!isOpen) return null;

  const progressPercent = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="w-full max-w-sm p-6 bg-gray-800 border border-gray-700 rounded-lg shadow-xl">
        <h2 className="text-xl font-semibold text-center text-white">
            {scanType === 'deep' ? 'Performing Deep Scan...' : 'Analyzing Project...'}
        </h2>
        <p className="mt-2 text-sm text-center text-gray-400">
          This may take a moment for large projects.
        </p>
        <div className="mt-4">
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <p className="mt-2 text-xs text-right text-gray-400">
            {scanType === 'shallow' ? `${processed} / ${total} files analyzed` : 'Processing...'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProcessingModal;
