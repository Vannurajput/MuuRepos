
import React from 'react';
import { UISettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UISettings;
  onSettingsChange: (settings: Partial<UISettings>) => void;
  onLoadSampleData: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSettingsChange, onLoadSampleData }) => {
  if (!isOpen) return null;

  const handleMenuPositionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({
      menuPosition: e.target.value as 'top' | 'left',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Settings</h2>
        </div>
        <div className="p-6 space-y-6">
          
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-300">Menu Bar Position</label>
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="menuPosition"
                  value="left"
                  checked={settings.menuPosition === 'left'}
                  onChange={handleMenuPositionChange}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-300">Left</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="menuPosition"
                  value="top"
                  checked={settings.menuPosition === 'top'}
                  onChange={handleMenuPositionChange}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-300">Top</span>
              </label>
            </div>
          </div>
          
          <div className="border-t border-gray-700 my-4"></div>

          <div>
             <label className="block mb-2 text-sm font-medium text-gray-300">Editor Features</label>
            <div className="space-y-2">
              <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={settings.previewMode}
                    onChange={(e) => onSettingsChange({ previewMode: e.target.checked })}
                    className="mt-1 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-300">
                    Enable Preview Mode
                    <p className="text-xs text-gray-400">Open files from explorer in a single, reusable tab.</p>
                  </span>
              </label>
              <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.isAdvancedMode}
                    onChange={(e) => onSettingsChange({ isAdvancedMode: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-300">Enable Advanced Snippets</span>
              </label>
              <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.isInlineSuggestionEnabled}
                    onChange={(e) => onSettingsChange({ isInlineSuggestionEnabled: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-300">Enable Inline Suggestions</span>
              </label>
               <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.isAutoSaveEnabled}
                    onChange={(e) => onSettingsChange({ isAutoSaveEnabled: e.target.checked })}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-300">Enable Auto-Save (every 30s)</span>
              </label>
              <label className="flex items-start">
                  <input
                    type="checkbox"
                    checked={settings.isDebugModeEnabled}
                    onChange={(e) => onSettingsChange({ isDebugModeEnabled: e.target.checked })}
                    className="mt-1 w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-300">
                    Enable Debug Mode
                    <p className="text-xs text-gray-400">Logs verbose debugging information to the console.</p>
                  </span>
              </label>
            </div>
          </div>

          <div className="border-t border-gray-700 my-4"></div>

          <div>
            <label className="block mb-2 text-sm font-medium text-gray-300">Project Data</label>
            <div className="space-y-2">
              <button
                onClick={onLoadSampleData}
                className="w-full px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-md hover:bg-blue-500 transition-colors"
              >
                Load Sample Project
              </button>
              <p className="text-xs text-gray-400">
                  Creates a new project with sample files to demonstrate editor features. If a sample project already exists, you will be switched to it.
              </p>
            </div>
          </div>

        </div>
        <div className="px-6 py-4 border-t border-gray-700 text-right">
          <button onClick={onClose} className="px-4 py-2 text-white bg-gray-600 rounded-md hover:bg-gray-500">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
