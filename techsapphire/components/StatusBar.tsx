import React from 'react';
import { EditorState } from '../types';

interface StatusBarProps {
  editorState: EditorState;
  language: string | undefined;
}

const StatusBar: React.FC<StatusBarProps> = ({ editorState, language }) => {
  return (
    <div className="flex items-center justify-end px-4 py-1 text-xs bg-gray-800 border-t border-gray-700 text-gray-400">
      <div className="mr-6">
        <span>Ln {editorState.line}, Col {editorState.column}</span>
      </div>
       {editorState.selectionLength > 0 && (
        <div className="mr-6">
          <span>{editorState.selectionLength} selected</span>
        </div>
      )}
      <div className="mr-6">
        <span>{editorState.charCount} characters</span>
      </div>
      <div>
        <span>{language || 'Plain Text'}</span>
      </div>
    </div>
  );
};

export default StatusBar;