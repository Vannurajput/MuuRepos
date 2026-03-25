import React from 'react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">MoText</h2>
          <p className="text-sm text-gray-400 mb-4">A modern, lightweight code editor.</p>
          <p className="text-xs text-gray-500">
            Created by <a href="https://muulorigin.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">muulorigin.com</a>
          </p>
        </div>
        <div className="px-6 py-4 border-t border-gray-700 text-center">
          <button onClick={onClose} className="px-4 py-2 text-white bg-gray-600 rounded-md hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AboutModal;
