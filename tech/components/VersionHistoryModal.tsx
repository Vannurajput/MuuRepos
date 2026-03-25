import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Version } from '../types';
import Icon from './Icon';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  versions: Version[];
  onRestore: (content: string) => void;
  currentContent: string;
  language: string;
}

const getMonacoLang = (lang: string) => {
    const mapping: {[key: string]: string} = {
        javascript: 'javascript', typescript: 'typescript', html: 'html', css: 'css', python: 'python', csharp: 'csharp',
        java: 'java', c: 'c', cpp: 'cpp', ruby: 'ruby', php: 'php', go: 'go', rust: 'rust', sql: 'sql',
        markdown: 'markdown', shell: 'shell', svg: 'xml', json: 'json', xml: 'xml',
    };
    return mapping[lang.toLowerCase()] || 'plaintext';
}

const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({ isOpen, onClose, versions, onRestore, currentContent, language }) => {
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | 'current'>('current');
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const diffEditorRef = useRef<any>(null); // IStandaloneDiffEditor
  const originalModelRef = useRef<any>(null);
  const modifiedModelRef = useRef<any>(null);

  const displayVersions = useMemo(() => [
    { timestamp: 'current' as const, content: currentContent },
    ...versions
  ], [versions, currentContent]);

  useEffect(() => {
    if (isOpen) {
      setSelectedTimestamp('current');
    }
  }, [isOpen]);
  
  const { oldValue, newValue, selectedContent } = useMemo(() => {
    const selectedIndex = displayVersions.findIndex(v => v.timestamp === selectedTimestamp);
    if (selectedIndex === -1) return { oldValue: '', newValue: '', selectedContent: ''};

    const selectedContent = displayVersions[selectedIndex].content;
    const newValue = selectedContent;
    const oldValue = displayVersions[selectedIndex + 1]?.content ?? ''; // The one before it in time
    return { oldValue, newValue, selectedContent };
  }, [selectedTimestamp, displayVersions]);
  
  useEffect(() => {
    if (isOpen && editorContainerRef.current && window.monaco) {
        if (!diffEditorRef.current) {
            diffEditorRef.current = window.monaco.editor.createDiffEditor(editorContainerRef.current, {
                originalEditable: false,
                readOnly: true,
                theme: 'vs-dark',
                enableSplitViewResizing: true,
                automaticLayout: true,
            });
        }
    }
    return () => {
        if (diffEditorRef.current) {
            diffEditorRef.current.dispose();
            diffEditorRef.current = null;
            originalModelRef.current?.dispose();
            modifiedModelRef.current?.dispose();
        }
    };
  }, [isOpen]);

  useEffect(() => {
    if (diffEditorRef.current && window.monaco) {
        const monacoLang = getMonacoLang(language);
        originalModelRef.current = window.monaco.editor.createModel(oldValue, monacoLang);
        modifiedModelRef.current = window.monaco.editor.createModel(newValue, monacoLang);
        
        diffEditorRef.current.setModel({
            original: originalModelRef.current,
            modified: modifiedModelRef.current,
        });

        return () => {
            originalModelRef.current?.dispose();
            modifiedModelRef.current?.dispose();
        }
    }
  }, [oldValue, newValue, language, isOpen]);


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={onClose}>
      <div
        className="flex flex-col w-11/12 max-w-6xl h-5/6 bg-gray-800 border border-gray-700 rounded-lg shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
          <h2 className="text-xl font-semibold text-white">Version History</h2>
          <div className="flex items-center space-x-4">
            <button
                onClick={() => onRestore(selectedContent)}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed"
                disabled={selectedTimestamp === 'current'}
                title={selectedTimestamp === 'current' ? 'Cannot restore current unsaved content' : 'Restore this version to the editor'}
            >
              Restore this version
            </button>
            <button onClick={onClose} className="p-1 text-white rounded-full hover:bg-gray-700"><Icon name="close" /></button>
          </div>
        </div>
        
        <div className="flex flex-1 min-h-0">
          <div className="w-64 p-2 overflow-y-auto border-r border-gray-700 shrink-0">
            <ul className="space-y-1">
              {displayVersions.map(version => (
                <li key={version.timestamp}>
                  <button
                    onClick={() => setSelectedTimestamp(version.timestamp)}
                    className={`w-full px-2 py-2 text-sm text-left rounded-md transition-colors ${
                        selectedTimestamp === version.timestamp 
                        ? 'bg-blue-600 text-white font-semibold' 
                        : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {version.timestamp === 'current' 
                        ? 'Current (Unsaved)' 
                        : new Date(version.timestamp).toLocaleString()}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex-1 overflow-auto bg-gray-900" ref={editorContainerRef}>
            {!window.monaco && <div className="flex items-center justify-center h-full text-gray-400">Loading Diff Viewer...</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VersionHistoryModal;