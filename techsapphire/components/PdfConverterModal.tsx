import React, { useState, useEffect } from 'react';
import { FileTab } from '../types';

interface PdfConverterModalProps {
  file: FileTab | null;
  onClose: () => void;
}

const PdfConverterModal: React.FC<PdfConverterModalProps> = ({ file, onClose }) => {
  const [password, setPassword] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  
  useEffect(() => {
    if (file) {
      setPassword('');
      setIsConverting(false);
    }
  }, [file]);

  if (!file) return null;

  const handleConvert = async () => {
    setIsConverting(true);
    // In a real implementation, you would use a library like pdf-lib here.
    // For now, we'll just simulate the conversion.
    console.log(`Simulating PDF conversion for ${file.name} with password: ${password}`);
    
    // Simulate a delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    alert(`PDF conversion for '${file.name}' is a placeholder feature.`);
    setIsConverting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={onClose}>
      <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Convert to PDF</h2>
        </div>
        <div className="p-6 space-y-6">
          <p className="text-sm text-gray-300">
            You are converting <span className="font-semibold text-white">{file.name}</span> to a password-protected PDF.
          </p>
          <div>
            <label htmlFor="pdf-password" className="block mb-2 text-sm font-medium text-gray-300">
              Set PDF Password (Optional)
            </label>
            <input
              id="pdf-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank for no encryption"
              className="w-full px-3 py-2 text-white bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex justify-between px-6 py-4 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-white bg-gray-600 rounded-md hover:bg-gray-500" disabled={isConverting}>
            Cancel
          </button>
          <button onClick={handleConvert} className="px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-500 disabled:bg-gray-500" disabled={isConverting}>
            {isConverting ? 'Converting...' : 'Convert & Download'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PdfConverterModal;
