import React from 'react';

interface AlertDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

const AlertDialog: React.FC<AlertDialogProps> = ({ isOpen, title, message, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={onClose}>
      <div className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-300" style={{ whiteSpace: 'pre-wrap' }}>{message}</p>
        </div>
        <div className="flex justify-end px-6 py-4 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-500">
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertDialog;
