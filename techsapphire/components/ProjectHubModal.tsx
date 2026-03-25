
import React, { useState } from 'react';
import { ProjectHistoryEvent, ProjectSnapshot } from '../types';
import Icon from './Icon';

interface ProjectHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: ProjectHistoryEvent[];
  snapshots: ProjectSnapshot[];
  onCreateSnapshot: (name: string) => void;
  onDeleteSnapshot: (id: number) => void;
  onRestoreSnapshot: (id: number) => void;
  onScanProjectFlow: () => void;
  onDeepScanProject: () => void;
}

const TabButton: React.FC<{ active: boolean, onClick: () => void, children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium border-b-2 ${active
        ? 'border-blue-500 text-white'
        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
      }`}
  >
    {children}
  </button>
);

const ProjectHubModal: React.FC<ProjectHubModalProps> = ({ isOpen, onClose, history, snapshots, onCreateSnapshot, onDeleteSnapshot, onRestoreSnapshot, onScanProjectFlow, onDeepScanProject }) => {
  const [activeTab, setActiveTab] = useState<'history' | 'snapshots'>('history');
  const [snapshotName, setSnapshotName] = useState('');

  if (!isOpen) return null;

  const handleCreateSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    if (snapshotName.trim()) {
      onCreateSnapshot(snapshotName.trim());
      setSnapshotName('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={onClose}>
      <div className="flex flex-col w-11/12 max-w-3xl h-5/6 bg-gray-800 border border-gray-700 rounded-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
          <h2 className="text-xl font-semibold text-white">Project Hub</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => { onScanProjectFlow(); onClose(); }}
              className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md hover:bg-indigo-500"
              title="Analyze project files to generate a high-level algorithm flow."
            >
              Scan Project Flow
            </button>
            <button
              onClick={() => { onDeepScanProject(); onClose(); }}
              className="px-4 py-2 text-sm text-white bg-purple-600 rounded-md hover:bg-purple-500"
              title="Perform a deep scan for cross-file references."
            >
              Deep Scan
            </button>
            <button onClick={onClose} className="p-1 text-white rounded-full hover:bg-gray-700"><Icon name="close" /></button>
          </div>
        </div>

        <div className="border-b border-gray-700 shrink-0">
          <nav className="flex space-x-2 px-4">
            <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')}>History</TabButton>
            <TabButton active={activeTab === 'snapshots'} onClick={() => setActiveTab('snapshots')}>Snapshots</TabButton>
          </nav>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {activeTab === 'history' && (
            <div className="p-4">
              {history.length > 0 ? (
                <ul className="space-y-3">
                  {history.map(event => (
                    <li key={event.timestamp} className="flex items-start text-sm">
                      <span className="w-40 text-gray-400 shrink-0">{new Date(event.timestamp).toLocaleString()}</span>
                      <span className="text-gray-200">{event.details}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400 text-center mt-8">No project history recorded yet.</p>
              )}
            </div>
          )}
          {activeTab === 'snapshots' && (
            <div className="p-4">
              <form onSubmit={handleCreateSnapshot} className="flex items-center space-x-2 p-2 mb-4 bg-gray-900 rounded-md">
                <input
                  type="text"
                  value={snapshotName}
                  onChange={e => setSnapshotName(e.target.value)}
                  placeholder="New snapshot name..."
                  className="flex-1 px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="submit" className="px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-500 disabled:bg-gray-500" disabled={!snapshotName.trim()}>
                  Create Snapshot
                </button>
              </form>
              {snapshots.length > 0 ? (
                <ul className="space-y-2">
                  {snapshots.map(snapshot => (
                    <li key={snapshot.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-md">
                      <div>
                        <p className="font-semibold text-white">{snapshot.name}</p>
                        <p className="text-xs text-gray-400">{new Date(snapshot.id).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button onClick={() => onRestoreSnapshot(snapshot.id)} className="px-3 py-1 text-sm text-white bg-green-600 rounded hover:bg-green-500">Restore</button>
                        <button onClick={() => onDeleteSnapshot(snapshot.id)} className="px-3 py-1 text-sm text-white bg-red-600 rounded hover:bg-red-500">Delete</button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400 text-center mt-8">No snapshots created yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectHubModal;
