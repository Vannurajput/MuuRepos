import React, { useState, useMemo, useRef } from 'react';
import { ProjectAnalysisReport } from '../types';
import FileAnalysisDetail from './FileAnalysisDetail';
import AlgoViewer from './AlgoViewer';
import useOnClickOutside from '../hooks/useOnClickOutside';
import Icon from './Icon';

interface AnalysisViewerProps {
    report: ProjectAnalysisReport;
    onFileLinkClick: (path: string) => void;
    onSaveReport?: (markdownContent: string) => void;
}

const TabButton: React.FC<{ active: boolean, onClick: () => void, children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${active
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
            }`}
    >
        {children}
    </button>
);

const AnalysisViewer: React.FC<AnalysisViewerProps> = ({ report, onFileLinkClick, onSaveReport }) => {
    const [activeTab, setActiveTab] = useState<string>('overview');
    const [visibleTabs, setVisibleTabs] = useState<Set<string>>(() =>
        new Set(report.fileAnalyses.map(f => f.fileName))
    );
    const [isManageMenuOpen, setManageMenuOpen] = useState(false);
    const manageMenuRef = useRef<HTMLDivElement>(null);
    useOnClickOutside(manageMenuRef, () => setManageMenuOpen(false));

    const sortedFileAnalyses = useMemo(() =>
        [...report.fileAnalyses].sort((a, b) => a.fileName.localeCompare(b.fileName)),
        [report.fileAnalyses]
    );

    const handleToggleTabVisibility = (fileName: string) => {
        setVisibleTabs(prev => {
            const newSet = new Set(prev);
            if (newSet.has(fileName)) {
                newSet.delete(fileName);
                // If the active tab is being hidden, switch to overview
                if (activeTab === fileName) {
                    setActiveTab('overview');
                }
            } else {
                newSet.add(fileName);
            }
            return newSet;
        });
    };

    const activeAnalysis = useMemo(() => {
        if (activeTab === 'overview') return null;
        return report.fileAnalyses.find(f => f.fileName === activeTab);
    }, [activeTab, report.fileAnalyses]);

    return (
        <div className="flex flex-col w-full h-full bg-gray-900">
            <div className="flex items-center border-b border-gray-700 shrink-0">
                <div className="flex-1 overflow-x-auto overflow-y-hidden">
                    <nav className="flex space-x-2 px-2">
                        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
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
                <div className="flex items-center p-2 space-x-2">
                    {onSaveReport && (
                        <button
                            onClick={() => onSaveReport(report.overviewMarkdown)}
                            className="px-3 py-1.5 text-sm text-gray-300 rounded-md hover:bg-gray-700 flex items-center"
                            title="Save this report overview as a .algo file in your project"
                        >
                            <Icon name="save" className="w-4 h-4 mr-2" />
                            Save Report
                        </button>
                    )}
                    <div ref={manageMenuRef} className="relative">
                        <button
                            onClick={() => setManageMenuOpen(v => !v)}
                            className="px-3 py-1.5 text-sm text-gray-300 rounded-md hover:bg-gray-700"
                        >
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
                </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
                {activeTab === 'overview' ? (
                    <div className="p-4">
                        <AlgoViewer content={report.overviewMarkdown} onFileLinkClick={onFileLinkClick} />
                    </div>
                ) : activeAnalysis ? (
                    <FileAnalysisDetail
                        analysis={activeAnalysis.analysisResult}
                        onFileLinkClick={onFileLinkClick}
                    />
                ) : null}
            </div>
        </div>
    );
};

export default AnalysisViewer;