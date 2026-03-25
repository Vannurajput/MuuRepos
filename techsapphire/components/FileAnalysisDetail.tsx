import React, { useEffect, useRef, useState } from 'react';
import { AnalysisResult, CodeSummary } from '../types';

interface AccordionSectionProps {
    title: string;
    count: number;
    children: React.ReactNode;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({ title, count, children }) => {
    const [isOpen, setIsOpen] = useState(true);
    if (count === 0) return null;

    return (
        <div className="mb-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-2 bg-gray-700/50 rounded-md text-lg font-bold text-gray-200 mb-2 hover:bg-gray-700"
            >
                <span>{title} ({count})</span>
                <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {isOpen && <div className="pl-2">{children}</div>}
        </div>
    );
};

const Summary: React.FC<{ summary: CodeSummary | null }> = ({ summary }) => {
    if (!summary) return null;
    return (
        <div className="mb-6 p-3 bg-gray-900/50 rounded-md">
            <h4 className="text-lg font-bold text-gray-200 mb-2">File Summary</h4>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <div className="contents"><dt className="text-gray-400">Total Lines</dt><dd className="text-white">{summary.totalLines}</dd></div>
                <div className="contents"><dt className="text-gray-400">Character Count</dt><dd className="text-white">{summary.charCount}</dd></div>
                <div className="contents"><dt className="text-gray-400">Comment Lines</dt><dd className="text-white">{summary.commentLineCount}</dd></div>
                {summary.importCount !== undefined && <div className="contents"><dt className="text-gray-400">Imports</dt><dd className="text-white">{summary.importCount}</dd></div>}
            </dl>
        </div>
    );
};

const CodeListItem: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <li className="p-1.5 bg-gray-800/50 rounded">
        <code className="text-sm">{children}</code>
    </li>
);

const FileAnalysisDetail: React.FC<{ analysis: AnalysisResult; onFileLinkClick: (path: string) => void; }> = ({ analysis, onFileLinkClick }) => {
    const referencesRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        const currentRef = referencesRef.current;
        if (!currentRef) return;
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'A') {
                const href = target.getAttribute('href');
                if (href && href.startsWith('motext://open-file/')) {
                    e.preventDefault();
                    onFileLinkClick(href.replace('motext://open-file/', ''));
                }
            }
        };
        currentRef.addEventListener('click', handleClick);
        return () => { currentRef.removeEventListener('click', handleClick); };
    }, [analysis.references, onFileLinkClick]);

    const referencesHtml = analysis.references.map(ref => `<li>${ref}</li>`).join('');

    return (
        <div className="p-4 text-gray-300">
            <Summary summary={analysis.summary} />

            <AccordionSection title="References" count={analysis.references.length}>
                <ul className="list-disc pl-5 space-y-1 text-blue-400" ref={referencesRef} dangerouslySetInnerHTML={{ __html: referencesHtml }} />
            </AccordionSection>

            <AccordionSection title="Functions & Methods" count={analysis.functions?.length || 0}>
                <ul className="space-y-1 font-mono">
                    {analysis.functions?.map(f => (
                        <CodeListItem key={f.name}><span className="text-purple-400">{f.name}</span>(<span className="text-yellow-400">{f.params}</span>)</CodeListItem>
                    ))}
                </ul>
            </AccordionSection>

            <AccordionSection title="Classes & Variables" count={analysis.variables?.length || 0}>
                <ul className="space-y-1 font-mono">
                    {analysis.variables?.map(v => (
                        <CodeListItem key={v.name}><span className="text-gray-400">{v.type}</span> <span className="text-cyan-400">{v.name}</span></CodeListItem>
                    ))}
                </ul>
            </AccordionSection>

            <AccordionSection title="DOM Interactions" count={analysis.domSelectors?.length || 0}>
                <ul className="space-y-1 font-mono">
                    {analysis.domSelectors?.map((s, i) => (
                        <CodeListItem key={`${s.selector}-${i}`}><span className="text-yellow-400">{s.method}</span>("<span className="text-green-400">{s.selector}</span>")</CodeListItem>
                    ))}
                </ul>
            </AccordionSection>

            <AccordionSection title="CSS Selectors" count={analysis.cssSelectors?.length || 0}>
                <ul className="space-y-1 font-mono">
                    {analysis.cssSelectors?.map((s, i) => (
                        <CodeListItem key={`${s.name}-${i}`}>
                            <span className="text-gray-400">{s.type === 'animation' ? '@keyframes' : s.type}:</span> <span className="text-green-400">{s.name}</span>
                        </CodeListItem>
                    ))}
                </ul>
            </AccordionSection>

            <AccordionSection title="Key HTML Elements" count={analysis.htmlElements?.length || 0}>
                <ul className="space-y-1 font-mono">
                    {analysis.htmlElements?.map((el, i) => (
                        <CodeListItem key={`${el.tag}-${i}`}>
                            <span className="text-red-400">&lt;{el.tag}</span>
                            {el.id && <span> id="<span className="text-green-400">{el.id}</span>"</span>}
                            {el.classes && <span> class="<span className="text-green-400">{el.classes.join(' ')}</span>"</span>}
                            <span className="text-red-400">&gt;</span>
                        </CodeListItem>
                    ))}
                </ul>
            </AccordionSection>

        </div>
    );
};

export default FileAnalysisDetail;