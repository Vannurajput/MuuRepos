

import React, { useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  visible: boolean;
  onClose: () => void;
  onRename: () => void;
  onCloseFile: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, visible, onClose, onRename: _onRename, onCloseFile }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      style={{ top: y, left: x }}
      className="absolute z-50 w-48 py-1 bg-gray-700 border border-gray-600 rounded-md shadow-lg"
    >
      <button
        onClick={() => { onCloseFile(); onClose(); }}
        className="w-full px-4 py-2 text-sm text-left text-gray-200 hover:bg-gray-600"
      >
        Close
      </button>
    </div>
  );
};

export default ContextMenu;