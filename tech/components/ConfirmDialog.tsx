import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ isOpen, title, message, onClose, onConfirm }) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={onClose}>
      <div className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-300">{message}</p>
        </div>
        <div className="flex justify-end px-6 py-4 space-x-2 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-white bg-gray-600 rounded-md hover:bg-gray-500">
            Cancel
          </button>
          <button onClick={handleConfirm} className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-500">
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
