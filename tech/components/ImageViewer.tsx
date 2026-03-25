import React from 'react';
import { FileTab } from '../types';

interface ImageViewerProps {
  file: FileTab;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ file }) => {
  return (
    <div className="w-full h-full bg-gray-800 flex items-center justify-center p-4 overflow-auto">
      <img src={file.content} alt={file.name} className="max-w-full max-h-full object-contain" />
    </div>
  );
};

export default ImageViewer;
