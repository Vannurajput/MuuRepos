import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DeepAnalysisReport, DeepFileAnalysis, FileTab } from '../types';
import DeepFileAnalysisDetail from './DeepFileAnalysisDetail';
import useOnClickOutside from '../hooks/useOnClickOutside';
import Icon from './Icon';
import { generateLogicFlow } from '../services/logicFlowService';

interface SearchResult {
    fileName: string;
    lineNumber: number;
    lineContent: string;
}

interface DeepAnalysisViewerProps {
  report?: DeepAnalysisReport;
  file?: FileTab;
  allFiles?: FileTab[];
  onFileLinkClick: (path: string) => void;
  onSaveReport: () => void;
}

const TabButton: React.FC<{ active: boolean, onClick: () => void, children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${
            active
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
        }`}
    >
        {children}
    </button>
);

const StatCard: React.FC<{ title: string; iconName: string; children: React.ReactNode }> = ({ title, iconName, children }) => (
    <div className="bg-gray-800 p-4 rounded-lg">
        <div className="flex items-center text-gray-400 mb-2">
            <Icon name={iconName} className="w-5 h-5 mr-3 shrink-0" />
            <h3 className="font-semibold uppercase text-xs tracking-wider">{title}</h3>
        </div>
        {children}
    </div>
);

const SymbolExplorerItem: React.FC<{
    symbol: string;
    definition: DeepAnalysisReport['symbolDefinitions'][string];
    usages: { file: string; line: number }[];
    onFileLinkClick: (path: string) => void;
}> = ({ symbol, definition, usages, onFileLinkClick }) => {
    const [isAlgoVisible, setIsAlgoVisible] = useState(false);
    const [isFlowVisible, setIsFlowVisible] = useState(false);
    const [algoFlow, setAlgoFlow] = useState<string | null>(null);
    const isFunction = definition.jsType === 'function';

    const handleToggleFlow = () => {
        if (!isFlowVisible && !algoFlow) {
            // Generate on first open
            const flow = generateLogicFlow(definition.algorithm || '');
            setAlgoFlow(flow);
        }
        setIsFlowVisible(!isFlowVisible);
    };


    return (
        <div className="p-3 bg-gray-800 rounded-lg border border-gray-700/50">
            <div className="flex items-center justify-between">
                <p className="font-mono text-blue-400 font-semibold break-all">{symbol}</p>
                <div className="flex items-center space-x-2">
                    {isFunction && (
                        <button
                            onClick={handleToggleFlow}
                            className="px-2 py-1 text-xs text-gray-300 bg-gray-700 rounded hover:bg-gray-600"
                        >
                            {isFlowVisible ? 'Hide Flow' : 'Show Flow'}
                        </button>
                    )}
                    {definition.algorithm && (
                        <button
                            onClick={() => setIsAlgoVisible(!isAlgoVisible)}
                            className="px-2 py-1 text-xs text-gray-300 bg-gray-700 rounded hover:bg-gray-600"
                        >
                            {isAlgoVisible ? 'Hide Algo' : 'Show Algo'}
                        </button>
                    )}
                </div>
            </div>
            {isFlowVisible && (
                 <pre className="mt-2 p-2 bg-gray-900/70 rounded-md overflow-x-auto text-xs text-gray-300 whitespace-pre-wrap">
                    <code>{algoFlow}</code>
                </pre>
            )}
            {isAlgoVisible && (
                 <pre className="mt-2 p-2 bg-gray-900/70 rounded-md overflow-x-auto text-xs text-gray-300">
                    <code>{definition.algorithm}</code>
                </pre>
            )}
            <div className="pl-4 mt-2 text-sm space-y-2">
                <div className="flex items-start">
                    <strong className="text-gray-400 w-20 shrink-0">Defined:</strong> 
                    <a onClick={() => onFileLinkClick(definition.file)} className="text-purple-400 hover:underline cursor-pointer font-mono">{definition.file} <span className="text-gray-500">(line {definition.line})</span></a>
                </div>
                <div className="flex items-start">
                    <strong className="text-gray-400 w-20 shrink-0">Used In ({usages.length}):</strong>
                    {usages.length > 0 ? (
                    <ul className="list-disc pl-5">
                        {usages.map((usage, i) => (
                            <li key={i}>
                                <a onClick={() => onFileLinkClick(usage.file)} className="text-green-400 hover:underline cursor-pointer font-mono">{usage.file} <span className="text-gray-500">(line {usage.line})</span></a>
                            </li>
                        ))}
                    </ul>
                    ) : (
                    <span className="text-gray-500 italic">Not used elsewhere</span>
                    )}
                </div>
            </div>
        </div>
    );
};


const ProjectOverview: React.FC<{ report: DeepAnalysisReport, onFileLinkClick: (path: string) => void }> = ({ report, onFileLinkClick }) => {
    const { summary, symbolDefinitions, symbolUsage } = report;
    const [filter, setFilter] = useState('');

    const filteredSymbols = useMemo(() => {
        const lowerFilter = filter.toLowerCase();
        return Object.keys(symbolDefinitions)
            .filter(symbol => symbol.toLowerCase().includes(lowerFilter))
            .sort();
    }, [symbolDefinitions, filter]);

    return (
        <div className="p-4 md:p-6">
            <header className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-4">Project Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StatCard title="File Breakdown" iconName="folderOpen">
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            <div className="contents"><dt className="text-gray-400">Total</dt><dd className="text-white font-semibold">{summary.totalFiles}</dd></div>
                            <div className="contents"><dt className="text-gray-400">JS/TS</dt><dd className="text-white font-semibold">{summary.jsFiles}</dd></div>
                            <div className="contents"><dt className="text-gray-400">CSS</dt><dd className="text-white font-semibold">{summary.cssFiles}</dd></div>
                            <div className="contents"><dt className="text-gray-400">HTML/XML</dt><dd className="text-white font-semibold">{summary.htmlFiles}</dd></div>
                            <div className="contents"><dt className="text-gray-400">Other</dt><dd className="text-white font-semibold">{summary.otherFiles}</dd></div>
                        </dl>
                    </StatCard>
                    <StatCard title="Analysis Insights" iconName="info-circle">
                         <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            <div className="contents"><dt className="text-gray-400">Symbols Defined</dt><dd className="text-white font-semibold">{Object.keys(symbolDefinitions).length}</dd></div>
                            <div className="contents"><dt className="text-gray-400">Cross-File Refs</dt><dd className="text-white font-semibold">{summary.totalCrossReferences}</dd></div>
                         </dl>
                    </StatCard>
                </div>
            </header>
            <section>
                <h2 className="text-xl font-semibold text-white mb-3">Symbol Explorer</h2>
                <input
                    type="text"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    placeholder="Filter defined symbols..."
                    className="w-full mb-4 px-3 py-2 text-white bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="space-y-2">
                    {filteredSymbols.map(symbol => (
                        <SymbolExplorerItem
                            key={symbol}
                            symbol={symbol}
                            definition={symbolDefinitions[symbol]}
                            usages={symbolUsage[symbol] || []}
                            onFileLinkClick={onFileLinkClick}
                        />
                    ))}
                </div>
            </section>
        </div>
    );
};

const SearchResultsView: React.FC<{ 
    results: SearchResult[], 
    term: string, 
    onFileLinkClick: (path: string) => void 
}> = ({ results, term, onFileLinkClick }) => {
    const highlight = (text: string, term: string) => {
        if (!term) return <>{text}</>;
        const parts = text.split(new RegExp(`(${term})`, 'gi'));
        return <>{parts.map((part, i) => part.toLowerCase() === term.toLowerCase() ? <mark key={i} className="bg-yellow-500 text-black px-0.5 rounded">{part}</mark> : part)}</>;
    };

    if (results.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                No results found for "{term}"
            </div>
        );
    }

    return (
        <div className="p-4">
            <h2 className="text-xl font-semibold text-white mb-4">
                Found {results.length} results for <span className="text-yellow-400">"{term}"</span>
            </h2>
            <div className="space-y-3">
                {results.map((result, i) => (
                    <div key={`${result.fileName}-${result.lineNumber}-${i}`} className="bg-gray-800/70 p-3 rounded-lg">
                        <a onClick={() => onFileLinkClick(result.fileName)} className="text-purple-400 hover:underline cursor-pointer text-sm font-semibold">{result.fileName}</a>
                        <div className="font-mono text-xs text-gray-400 mt-1">Line {result.lineNumber}</div>
                        <pre className="mt-1 bg-gray-900 p-2 rounded overflow-x-auto"><code className="text-sm whitespace-pre-wrap">{highlight(result.lineContent, term)}</code></pre>
                    </div>
                ))}
            </div>
        </div>
    );
};


const DeepAnalysisViewer: React.FC<DeepAnalysisViewerProps> = ({ report: initialReport, file, allFiles, onFileLinkClick, onSaveReport }) => {
  const [activeTab, setActiveTab] = useState<string>('project-overview');
  const [visibleTabs, setVisibleTabs] = useState<Set<string>>(new Set());
  const [isManageMenuOpen, setManageMenuOpen] = useState(false);
  const manageMenuRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(manageMenuRef, () => setManageMenuOpen(false));

  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const report = useMemo(() => {
    if (initialReport) return initialReport;
    if (file) {
      try { return JSON.parse(file.content) as DeepAnalysisReport; } 
      catch { return null; }
    }
    return null;
  }, [initialReport, file]);

  useEffect(() => {
    if (report) {
        setVisibleTabs(new Set(report.fileAnalyses.map(f => f.fileName)))
    }
  }, [report]);

  useEffect(() => {
    if (!allFiles) return;

    if (!searchTerm.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
    }

    setIsSearching(true);
    const handler = setTimeout(() => {
        const results: SearchResult[] = [];
        const term = searchTerm.trim();
        if (term.length < 2) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        const lowerCaseTerm = term.toLowerCase();

        for (const file of allFiles) {
            if (file.isBinary || file.name.endsWith('.placeholder')) continue;
            const lines = file.content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.toLowerCase().includes(lowerCaseTerm)) {
                    results.push({
                        fileName: file.name,
                        lineNumber: i + 1,
                        lineContent: line.trim(),
                    });
                }
            }
        }
        setSearchResults(results);
        setIsSearching(false);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm, allFiles]);


  const sortedFileAnalyses = useMemo(() =>
    report ? [...report.fileAnalyses].sort((a, b) => a.fileName.localeCompare(b.fileName)) : [],
    [report]
  );

  const handleToggleTabVisibility = (fileName: string) => {
    setVisibleTabs(prev => {
        const newSet = new Set(prev);
        if (newSet.has(fileName)) {
            newSet.delete(fileName);
            if(activeTab === fileName) setActiveTab('project-overview');
        } else {
            newSet.add(fileName);
        }
        return newSet;
    });
  };

  const activeAnalysis: DeepFileAnalysis | undefined | null = useMemo(() => {
    if (activeTab === 'project-overview' || !report) return null;
    return report.fileAnalyses.find(f => f.fileName === activeTab);
  }, [activeTab, report]);

  if (!report) {
      return (
          <div className="flex items-center justify-center h-full text-gray-500">
              Error: Could not load or parse the deep analysis report.
          </div>
      );
  }

  return (
    <div className="flex flex-col w-full h-full bg-gray-900">
        <div className="flex items-center border-b border-gray-700 shrink-0 pr-2">
            {allFiles && (
                <div className="relative p-2 flex-shrink-0">
                    <input
                        type="search"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search project content..."
                        className="w-48 pl-8 pr-2 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                        {isSearching ? <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div> : <Icon name="search" className="w-4 h-4 text-gray-500" />}
                    </div>
                </div>
            )}
            
            {!searchTerm && (
                <div className="flex-1 overflow-x-auto overflow-y-hidden">
                    <nav className="flex space-x-2 px-2">
                        <TabButton active={activeTab === 'project-overview'} onClick={() => setActiveTab('project-overview')}>
                            Project Overview
                        </TabButton>
                        {sortedFileAnalyses.filter(f => visibleTabs.has(f.fileName)).map(fileAnalysis => (
                            <TabButton 
                                key={fileAnalysis.fileName}
                                active={activeTab === fileAnalysis.fileName}
                                onClick={() => setActiveTab(fileAnalysis.fileName)}
                            >
                                {fileAnalysis.fileName.split('/').pop()}
                            </TabButton>
                        ))}
                    </nav>
                </div>
            )}
            {searchTerm && <div className="flex-1"></div>}

            <div className="flex items-center space-x-2">
                {allFiles && ( // Only show save button on live report
                    <button
                        onClick={onSaveReport}
                        className="px-3 py-1.5 text-sm text-gray-300 rounded-md hover:bg-gray-700 flex items-center"
                        title="Save this report as a .algod file in your project"
                    >
                        <Icon name="save" className="w-4 h-4 mr-2" />
                        Save Report
                    </button>
                )}
                {!searchTerm && (
                     <div ref={manageMenuRef} className="relative">
                        <button onClick={() => setManageMenuOpen(v => !v)} className="px-3 py-1.5 text-sm text-gray-300 rounded-md hover:bg-gray-700">
                            Manage Tabs
                        </button>
                        {isManageMenuOpen && (
                             <div className="absolute right-0 mt-2 w-64 max-h-80 overflow-y-auto z-10 bg-gray-700 border border-gray-600 rounded-md shadow-lg">
                                 <ul className="py-1">
                                    {sortedFileAnalyses.map(f => (
                                        <li key={f.fileName}>
                                            <label className="flex items-center w-full px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-600 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={visibleTabs.has(f.fileName)}
                                                    onChange={() => handleToggleTabVisibility(f.fileName)}
                                                    className="w-4 h-4 mr-3 text-blue-500 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                                                />
                                                <span className="truncate">{f.fileName}</span>
                                            </label>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto bg-gray-800/20">
            {searchTerm ? (
                <SearchResultsView results={searchResults} term={searchTerm} onFileLinkClick={onFileLinkClick} />
            ) : activeTab === 'project-overview' ? (
                <ProjectOverview report={report} onFileLinkClick={onFileLinkClick} />
            ) : activeAnalysis ? (
                <DeepFileAnalysisDetail analysis={activeAnalysis} onFileLinkClick={onFileLinkClick} />
            ) : null}
      </div>
    </div>
  );
};

export default DeepAnalysisViewer;
