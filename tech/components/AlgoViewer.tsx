import React, { useEffect, useRef } from 'react';

interface AlgoViewerProps {
  content: string;
  onFileLinkClick: (path: string) => void;
}

const markdownStyles = `
  <style>
    body { color: #e5e7eb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; padding: 1rem; margin: 0; }
    h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; line-height: 1.25; border-bottom: 1px solid #4b5563; padding-bottom: .3em;}
    h1 { font-size: 2em; } h2 { font-size: 1.5em; } h3 { font-size: 1.25em; }
    code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; background-color: #374151; padding: .2em .4em; margin: 0; font-size: 85%; border-radius: 3px; }
    pre { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; padding: 16px; overflow: auto; font-size: 85%; line-height: 1.45; background-color: #1f2937; border-radius: 3px; }
    pre code { background-color: transparent; padding: 0; margin: 0; border: 0; }
    a { color: #60a5fa; text-decoration: none; cursor: pointer; }
    a:hover { text-decoration: underline; }
  </style>
`;

const AlgoViewer: React.FC<AlgoViewerProps> = ({ content, onFileLinkClick }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
        contentRef.current.innerHTML = markdownStyles + window.marked.parse(content);

        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'A') {
                const href = target.getAttribute('href');
                if (href && href.startsWith('motext://open-file/')) {
                    e.preventDefault();
                    const filePath = href.replace('motext://open-file/', '');
                    onFileLinkClick(filePath);
                }
            }
        };

        const currentRef = contentRef.current;
        currentRef.addEventListener('click', handleClick);
        return () => {
            currentRef.removeEventListener('click', handleClick);
        };
    }
  }, [content, onFileLinkClick]);

  return (
    <div className="flex flex-col w-full h-full bg-gray-900">
        <div className="p-2 bg-gray-800 border-b border-gray-700 shrink-0">
            <h3 className="font-semibold text-white">Algorithm Flow Report</h3>
        </div>
        <div className="flex-1 w-full h-full p-4 overflow-auto bg-gray-800" ref={contentRef} />
    </div>
  );
};

export default AlgoViewer;
