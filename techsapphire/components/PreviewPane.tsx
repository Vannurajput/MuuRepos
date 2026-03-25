import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import Icon from './Icon';

interface PreviewPanelProps {
    content: string;
    language: string;
    onRefresh: () => void;
}

// Configure DOMPurify to allow safe SVG elements
const DOMPURIFY_CONFIG = {
    USE_PROFILES: { svg: true, html: true },
    ADD_TAGS: ['use'], // Allow SVG <use> elements
    ADD_ATTR: ['xlink:href', 'href', 'target'], // Allow common attributes
};

const PreviewPanel: React.FC<PreviewPanelProps> = ({ content, language, onRefresh }) => {
    const markdownStyles = `
    <style>
      body { color: #e5e7eb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; padding: 1rem; margin: 0; }
      h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; line-height: 1.25; border-bottom: 1px solid #4b5563; padding-bottom: .3em;}
      h1 { font-size: 2em; } h2 { font-size: 1.5em; } h3 { font-size: 1.25em; }
      code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; background-color: #374151; padding: .2em .4em; margin: 0; font-size: 85%; border-radius: 3px; }
      pre { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; padding: 16px; overflow: auto; font-size: 85%; line-height: 1.45; background-color: #1f2937; border-radius: 3px; }
      pre code { background-color: transparent; padding: 0; margin: 0; border: 0; }
      blockquote { border-left: .25em solid #4b5563; padding: 0 1em; color: #9ca3af; }
      table { border-collapse: collapse; }
      td, th { border: 1px solid #4b5563; padding: 6px 13px; }
      a { color: #60a5fa; text-decoration: none; }
      a:hover { text-decoration: underline; }
    </style>
  `;

    const isSvgDataUrl = language === 'svg' && content.startsWith('data:image/svg+xml');

    // Memoize sanitized content to avoid re-sanitizing on every render
    const sanitizedContent = useMemo(() => {
        if (language === 'svg' && !isSvgDataUrl) {
            return DOMPurify.sanitize(content, DOMPURIFY_CONFIG);
        }
        if (language === 'markdown' && window.marked) {
            const rawHtml = window.marked.parse(content);
            return DOMPurify.sanitize(rawHtml, DOMPURIFY_CONFIG);
        }
        // For HTML, sanitize directly
        return DOMPurify.sanitize(content, DOMPURIFY_CONFIG);
    }, [content, language, isSvgDataUrl]);

    return (
        <div className="flex flex-col w-full h-full bg-gray-900 border-l border-gray-700">
            <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700 shrink-0">
                <h3 className="font-semibold text-white">Preview</h3>
                <button
                    onClick={onRefresh}
                    title="Refresh Preview"
                    className="p-1 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white"
                >
                    <Icon name="refresh" className="w-4 h-4" />
                </button>
            </div>
            <div className="flex-1 w-full h-full overflow-auto bg-gray-800">
                {isSvgDataUrl ? (
                    <div className="p-4 flex items-center justify-center h-full">
                        <img src={content} alt="SVG Preview" className="max-w-full max-h-full" />
                    </div>
                ) : language === 'svg' ? (
                    <div className="p-4" dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
                ) : (
                    <iframe
                        srcDoc={
                            language === 'markdown'
                                ? markdownStyles + `<body style="background-color:#1f2937;">` + sanitizedContent + `</body>`
                                : `<body style="background-color:white;">` + sanitizedContent + `</body>`
                        }
                        title="Preview"
                        className="w-full h-full border-0"
                        sandbox="allow-scripts"
                    />
                )}
            </div>
        </div>
    );
};

export default PreviewPanel;