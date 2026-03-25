import React, { useState } from 'react';
import { GitFileStatus } from '../types';
import Icon from './Icon';

interface GitPanelProps {
  status: GitFileStatus[];
  isProcessing: boolean;
  onCommit: (message: string) => void;
  onPush: () => void;
  onPull: () => void;
  onRefresh: () => void;
}

const statusColors: { [key: string]: string } = {
    added: 'text-green-400',
    modified: 'text-yellow-400',
    deleted: 'text-red-400',
};

const GitPanel: React.FC<GitPanelProps> = ({ status, isProcessing, onCommit, onPush, onPull, onRefresh }) => {
    const [commitMessage, setCommitMessage] = useState('');

    const handleCommit = () => {
        if (!commitMessage.trim() || isProcessing) return;
        onCommit(commitMessage.trim());
        setCommitMessage('');
    };

    return (
        <div className="flex flex-col h-full text-sm">
            <div className="flex items-center justify-between p-2 border-b border-gray-700">
                <h4 className="font-bold">Source Control</h4>
                <div className="flex items-center space-x-2">
                    <button onClick={onPull} disabled={isProcessing} title="Pull" className="p-1 text-gray-300 hover:text-white disabled:text-gray-600"><Icon name="cloud-arrow-down" className="w-5 h-5"/></button>
                    <button onClick={onPush} disabled={isProcessing} title="Push" className="p-1 text-gray-300 hover:text-white disabled:text-gray-600"><Icon name="cloud-arrow-up" className="w-5 h-5"/></button>
                    <button onClick={onRefresh} disabled={isProcessing} title="Refresh" className={`p-1 text-gray-300 hover:text-white disabled:text-gray-600 ${isProcessing ? 'animate-spin' : ''}`}><Icon name="refresh" className="w-5 h-5"/></button>
                </div>
            </div>
            <div className="p-2 border-b border-gray-700">
                <textarea
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="Commit message..."
                    rows={3}
                    className="w-full p-2 text-white bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={isProcessing}
                />
                <button
                    onClick={handleCommit}
                    disabled={!commitMessage.trim() || isProcessing}
                    className="w-full mt-2 px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    {isProcessing ? 'Processing...' : 'Commit'}
                </button>
            </div>
            <div className="flex-1 overflow-y-auto">
                <h5 className="p-2 text-xs font-bold tracking-wider text-gray-400 uppercase">Changes ({status.length})</h5>
                {status.length > 0 ? (
                    <ul>
                        {status.map(({ filepath, status: fileStatus }) => (
                             <li key={filepath} className="flex items-center justify-between px-3 py-1.5 hover:bg-gray-700/50">
                                <span className="truncate">{filepath}</span>
                                <span className={`font-semibold ${statusColors[fileStatus] || 'text-gray-400'}`}>{fileStatus.toUpperCase()}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="px-3 py-4 text-gray-500">No changes detected.</p>
                )}
            </div>
        </div>
    );
};

export default GitPanel;