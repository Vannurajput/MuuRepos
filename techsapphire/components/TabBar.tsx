import React, { useRef, useEffect } from 'react';
import { FileTab } from '../types';
import Icon from './Icon';

interface TabBarProps {
  files: FileTab[];
  activeFileId: number | null;
  onSelectFile: (id: number) => void;
  onCloseFile: (id: number) => void;
  onNewFile: () => void;
  onContextMenu: (e: React.MouseEvent, fileId: number) => void;
  onPreviewClick?: () => void;
  isAnalysisVisible: boolean;
  isDeepAnalysisVisible: boolean;
  activeView: 'editor' | 'analysis' | 'deepAnalysis';
  onSelectAnalysis: () => void;
  onSelectDeepAnalysis: () => void;
}

const getBasename = (path: string) => path.split('/').pop() || '';

const TabBar: React.FC<TabBarProps> = ({ files, activeFileId, onSelectFile, onCloseFile, onNewFile: _onNewFile, onContextMenu, onPreviewClick, isAnalysisVisible, isDeepAnalysisVisible, activeView, onSelectAnalysis, onSelectDeepAnalysis }) => {
  const activeTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeFileId, activeView]);

  return (
    <div className="flex items-center bg-gray-800 border-b border-gray-700 shrink-0">
      <div className="flex-1 overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        {isAnalysisVisible && (
          <button
            ref={activeView === 'analysis' ? activeTabRef : null}
            onClick={onSelectAnalysis}
            className={`inline-flex items-center px-4 py-2 text-sm border-r border-gray-700 hover:bg-gray-700 focus:outline-none ${activeView === 'analysis' ? 'bg-gray-900 text-white font-semibold' : 'text-yellow-400'
              }`}
          >
            Analysis Report
          </button>
        )}
        {isDeepAnalysisVisible && (
          <button
            ref={activeView === 'deepAnalysis' ? activeTabRef : null}
            onClick={onSelectDeepAnalysis}
            className={`inline-flex items-center px-4 py-2 text-sm border-r border-gray-700 hover:bg-gray-700 focus:outline-none ${activeView === 'deepAnalysis' ? 'bg-gray-900 text-white font-semibold' : 'text-purple-400'
              }`}
          >
            Deep Analysis
          </button>
        )}
        {files.map(file => (
          <button
            key={file.id}
            ref={file.id === activeFileId && activeView === 'editor' ? activeTabRef : null}
            onClick={() => onSelectFile(file.id)}
            onContextMenu={(e) => onContextMenu(e, file.id)}
            className={`inline-flex items-center px-4 py-2 text-sm border-r border-gray-700 hover:bg-gray-700 focus:outline-none ${activeFileId === file.id && activeView === 'editor' ? 'bg-gray-900 text-white' : 'text-gray-400'
              }`}
          >
            <div className="flex items-center">
              <span className="max-w-xs truncate">{getBasename(file.name)}</span>
              {file.isDirty && (
                <div className="w-2 h-2 ml-2 rounded-full bg-blue-400 shrink-0" title="Unsaved changes"></div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseFile(file.id);
              }}
              className="ml-3 p-0.5 rounded-full hover:bg-gray-600"
            >
              <Icon name="close" className="w-3 h-3" />
            </button>
          </button>
        ))}
      </div>
      {onPreviewClick && (
        <button
          onClick={onPreviewClick}
          className="px-4 py-2 text-sm text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none"
        >
          Preview
        </button>
      )}
    </div>
  );
};

export default TabBar;