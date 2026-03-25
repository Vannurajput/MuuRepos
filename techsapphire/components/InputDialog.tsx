import React, { useState, useEffect, useRef } from 'react';

interface InputDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  initialValue?: string;
  onClose: () => void;
  onSubmit: (value: string) => void;
}

const InputDialog: React.FC<InputDialogProps> = ({ isOpen, title, message, initialValue = '', onClose, onSubmit }) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      // Short timeout to allow the element to be in the DOM and visible before focusing
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onKeyDown={handleKeyDown} onClick={onClose}>
      <div className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">{title}</h2>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-300">{message}</p>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-3 py-2 text-white bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end px-6 py-4 space-x-2 border-t border-gray-700">
            <button type="button" onClick={onClose} className="px-4 py-2 text-white bg-gray-600 rounded-md hover:bg-gray-500">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-500">
              OK
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InputDialog;
