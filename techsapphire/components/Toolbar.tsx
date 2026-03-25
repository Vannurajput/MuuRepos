import React from 'react';
import Icon from './Icon';

interface ToolbarProps {
    onSave: () => void;
    onNewFile: () => void;
    onSplitPane: () => void;
}

const ToolButton: React.FC<{onClick: () => void, iconName: string, children: React.ReactNode}> = ({ onClick, iconName, children }) => (
    <button 
        onClick={onClick}
        className="flex items-center px-3 py-1 text-sm text-gray-300 rounded-md hover:bg-gray-700"
    >
        <Icon name={iconName} className="w-4 h-4 mr-2" />
        {children}
    </button>
);

const Toolbar: React.FC<ToolbarProps> = ({ onSave, onNewFile, onSplitPane }) => {
    return (
        <div className="flex items-center px-2 py-1 bg-gray-800 border-b border-gray-700 space-x-2 shrink-0">
            <ToolButton onClick={onSave} iconName="save">Save Version</ToolButton>
            <ToolButton onClick={onNewFile} iconName="plus">New File</ToolButton>
            <ToolButton onClick={onSplitPane} iconName="split">Split Pane</ToolButton>
        </div>
    );
};

export default Toolbar;