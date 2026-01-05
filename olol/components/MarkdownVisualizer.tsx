import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Edit, Eye, Save } from 'lucide-react';

interface MarkdownVisualizerProps {
  content: string;
  onChange: (newContent: string) => void;
  isDesignerMode: boolean;
}

const MarkdownVisualizer: React.FC<MarkdownVisualizerProps> = ({ content, onChange, isDesignerMode }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempContent, setTempContent] = useState(content);

  const handleSave = () => {
    onChange(tempContent);
    setIsEditing(false);
  };

  const toggleEdit = () => {
    if (isEditing) {
        // Cancel logic if needed, or just save on toggle? Let's save.
        handleSave();
    } else {
        setTempContent(content);
        setIsEditing(true);
    }
  };

  // If we are not in designer mode, user can't edit via this component directly (usually)
  // But let's allow editing content even in view mode if it's a markdown block? 
  // For consistency, let's say editing is primarily a "Designer" feature, 
  // but for Markdown, quick edits are often useful. We'll stick to DesignerMode prop for permission.

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 overflow-hidden relative group">
      {(isDesignerMode || isEditing) && (
          <div className="absolute top-2 right-2 z-20 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
               <button 
                  onClick={toggleEdit}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-slate-300 shadow-sm"
                  title={isEditing ? "Preview" : "Edit Markdown"}
               >
                  {isEditing ? <Eye size={14} /> : <Edit size={14} />}
               </button>
          </div>
      )}

      {isEditing ? (
        <textarea 
            value={tempContent}
            onChange={(e) => setTempContent(e.target.value)}
            className="flex-1 w-full h-full bg-slate-950 p-4 text-slate-200 font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            placeholder="# Hello World"
        />
      ) : (
        <div className="flex-1 overflow-auto p-4 prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{content || "*No content defined*"}</ReactMarkdown>
        </div>
      )}
    </div>
  );
};

export default MarkdownVisualizer;