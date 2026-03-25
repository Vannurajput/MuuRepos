
import React, { useState } from 'react';
import { TestResult, TestSuiteResult } from '../types';
import Icon from './Icon';

interface TestPanelProps {
    results: TestResult | null;
    isTesting: boolean;
    onRunTests: () => void;
}

const SuiteResult: React.FC<{ suite: TestSuiteResult }> = ({ suite }) => {
    const [isOpen, setIsOpen] = useState(!suite.passed);


    return (
        <div className="mb-2">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-2 text-left bg-gray-700/50 hover:bg-gray-700 rounded-md">
                <div className="flex items-center">
                    <Icon name={suite.passed ? 'check' : 'close'} className={`w-4 h-4 mr-2 ${suite.passed ? 'text-green-400' : 'text-red-400'}`} />
                    <span className="font-semibold truncate">{suite.suiteName}</span>
                    <span className="ml-2 text-xs text-gray-400 truncate">{suite.fileName}</span>
                </div>
                <Icon name="chevron-down" className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="pl-4 pt-2 border-l-2 border-gray-700 ml-2">
                    {suite.error && (
                        <div className="p-2 mb-2 text-sm text-red-300 bg-red-900/50 rounded">
                            <strong>Error in suite:</strong> {suite.error}
                        </div>
                    )}
                    <ul className="space-y-1">
                        {suite.tests.map(test => (
                            <li key={test.name} className="flex items-start text-sm">
                                <Icon name={test.passed ? 'check' : 'close'} className={`w-4 h-4 mr-2 mt-0.5 shrink-0 ${test.passed ? 'text-green-400' : 'text-red-400'}`} />
                                <div className="flex-1">
                                    <span className={test.passed ? 'text-gray-300' : 'text-white'}>{test.name}</span>
                                    {test.error && (
                                        <pre className="mt-1 p-2 text-xs text-red-200 bg-black/30 rounded-md whitespace-pre-wrap font-mono">{test.error}</pre>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

const TestPanel: React.FC<TestPanelProps> = ({ results, isTesting, onRunTests }) => {
    return (
        <div className="flex flex-col h-full text-sm">
            <div className="p-2 border-b border-gray-700">
                <button
                    onClick={onRunTests}
                    disabled={isTesting}
                    className="w-full px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    {isTesting ? 'Running...' : 'Run All Tests'}
                </button>
            </div>
            <div className="flex-1 p-2 overflow-y-auto">
                {!results && !isTesting && <p className="text-center text-gray-500 mt-4">Click "Run All Tests" to start.</p>}
                {isTesting && (
                    <div className="flex items-center justify-center h-full">
                        <div className="w-6 h-6 border-4 border-gray-500 border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                )}
                {results && (
                    <div>
                        <div className="mb-4 p-2 text-center rounded-md bg-gray-800">
                            <h4 className="font-bold">Test Run Summary</h4>
                            <div className="flex justify-center space-x-4 mt-2 text-xs">
                                <span className="text-green-400">Passed: {results.stats.passed}</span>
                                <span className={results.stats.failed > 0 ? 'text-red-400' : 'text-gray-400'}>Failed: {results.stats.failed}</span>
                                <span>Total: {results.stats.total}</span>
                            </div>
                        </div>
                        {results.suites.map((suite, index) => (
                            <SuiteResult key={suite.suiteName + index} suite={suite} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TestPanel;
