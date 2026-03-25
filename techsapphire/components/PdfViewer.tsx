import React from 'react';
import { FileTab } from '../types';

interface PdfViewerProps {
  file: FileTab;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ file }) => {
  return (
    <div className="w-full h-full bg-gray-800 flex flex-col items-center justify-center">
      <embed
        src={file.content}
        type="application/pdf"
        className="w-full h-full"
      />
    </div>
  );
};

export default PdfViewer;
