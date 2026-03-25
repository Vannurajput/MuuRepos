import React from 'react';
import { FileTab } from '../types';

interface BinaryFileViewerProps {
  file: FileTab;
}

const BinaryFileViewer: React.FC<BinaryFileViewerProps> = ({ file }) => {
  return (
    <div className="w-full h-full bg-gray-800 flex flex-col items-center justify-center text-gray-400">
      <h2 className="text-xl font-bold mb-2">Binary File</h2>
      <p>Preview is not available for this file type.</p>
      <p className="text-sm mt-4">MIME Type: {file.mimeType || 'unknown'}</p>
    </div>
  );
};

export default BinaryFileViewer;
