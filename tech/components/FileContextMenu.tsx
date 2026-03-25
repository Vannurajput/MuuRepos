import React, { useEffect, useRef } from 'react';
import Icon from './Icon';

interface MenuItemProps {
    onClick: () => void;
    icon: string;
    label: string;
    disabled?: boolean;
}
const MenuItem: React.FC<MenuItemProps> = ({ onClick, icon, label, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="w-full px-3 py-2 text-sm text-left text-gray-200 hover:bg-gray-600 flex items-center disabled:text-gray-500 disabled:cursor-not-allowed"
    >
        <Icon name={icon} className="w-4 h-4 mr-3" />
        <span>{label}</span>
    </button>
);


interface FileContextMenuProps {
  x: number;
  y: number;
  visible: boolean;
  targetType: 'file' | 'folder';
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDeleteFile: () => void;
  onDeleteFolder: () => void;
  onShowProperties: () => void;
}

const FileContextMenu: React.FC<FileContextMenuProps> = (props) => {
  const {
    x, y, visible, targetType, onClose,
    onNewFile, onNewFolder, onRename, onDeleteFile, onDeleteFolder, onShowProperties,
  } = props;
  
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (visible) {
      document.addEventListener('mousedown', handleClickOutside, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{ top: y, left: x }}
      className="absolute z-50 w-56 py-1 bg-gray-700 border border-gray-600 rounded-md shadow-lg"
      onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
    >
      {targetType === 'folder' && (
        <>
          <MenuItem onClick={() => handleAction(onNewFile)} icon="file-plus" label="New File..." />
          <MenuItem onClick={() => handleAction(onNewFolder)} icon="folder-plus" label="New Folder..." />
          <div className="h-px my-1 bg-gray-600" role="separator"></div>
        </>
      )}
      <MenuItem onClick={() => handleAction(onRename)} icon="pencil" label="Rename..." />
      <MenuItem 
        onClick={() => handleAction(targetType === 'file' ? onDeleteFile : onDeleteFolder)} 
        icon="trash" 
        label="Delete" 
      />
      <div className="h-px my-1 bg-gray-600" role="separator"></div>
      <MenuItem onClick={() => handleAction(onShowProperties)} icon="info-circle" label="Properties" />
    </div>
  );
};

export default FileContextMenu;