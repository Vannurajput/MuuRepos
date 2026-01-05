import React, { useState } from 'react';
import { AppSettings } from '../types';
import { DialectRegistry } from '../services/dialects/SqlDialects';
import { X, Type, Palette, Clock, ShieldCheck, AlertCircle } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'dba'>('general');
  const [jsonValue, setJsonValue] = useState(JSON.stringify(settings.customInsights || {}, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleChange = (key: keyof AppSettings, value: any) => {
    onSave({ ...settings, [key]: value });
  };

  const handleJsonChange = (val: string) => {
    setJsonValue(val);
    try {
      JSON.parse(val);
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message);
    }
  };

  const saveDbaConfig = () => {
    try {
      const parsed = JSON.parse(jsonValue);
      onSave({ ...settings, customInsights: parsed });
      setJsonError(null);
      alert("DBA Insights updated successfully!");
    } catch (e: any) {
      setJsonError(e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        <div className="h-14 bg-slate-850 border-b border-slate-800 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-bold text-slate-200">Settings</h2>
            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
                <button 
                  onClick={() => setActiveTab('general')}
                  className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'general' ? 'bg-slate-700 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  General
                </button>
                <button 
                  onClick={() => setActiveTab('dba')}
                  className={`px-3 py-1 text-xs rounded transition-colors ${activeTab === 'dba' ? 'bg-slate-700 text-purple-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  DBA Config
                </button>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'general' ? (
            <div className="space-y-6">
              {/* Editor Font Size */}
              <div className="space-y-3">
                  <div className="flex items-center text-slate-300 font-medium">
                      <Type size={18} className="mr-2 text-blue-400" /> Editor Font Size
                  </div>
                  <div className="flex items-center space-x-4 bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <input 
                          type="range" 
                          min="10" 
                          max="24" 
                          step="1" 
                          value={settings.editorFontSize}
                          onChange={(e) => handleChange('editorFontSize', Number(e.target.value))}
                          className="flex-1 accent-blue-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="w-8 text-right font-mono text-slate-400">{settings.editorFontSize}px</span>
                  </div>
              </div>

              {/* Theme Accent */}
              <div className="space-y-3">
                  <div className="flex items-center text-slate-300 font-medium">
                      <Palette size={18} className="mr-2 text-purple-400" /> UI Accent Color
                  </div>
                  <div className="flex space-x-3">
                      {['blue', 'purple', 'green', 'orange'].map((color) => (
                          <button
                              key={color}
                              onClick={() => handleChange('themeAccent', color)}
                              className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all ${
                                  settings.themeAccent === color ? 'border-white scale-110' : 'border-transparent opacity-70 hover:opacity-100'
                              }`}
                              style={{ backgroundColor: color === 'blue' ? '#3b82f6' : color === 'purple' ? '#8b5cf6' : color === 'green' ? '#10b981' : '#f97316' }}
                          />
                      ))}
                  </div>
              </div>

              {/* Dashboard Refresh */}
              <div className="space-y-3">
                  <div className="flex items-center text-slate-300 font-medium">
                      <Clock size={18} className="mr-2 text-green-400" /> Dashboard Auto-Refresh
                  </div>
                  <select 
                      value={settings.refreshRate}
                      onChange={(e) => handleChange('refreshRate', Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                      <option value={0}>Disabled (Manual)</option>
                      <option value={30}>Every 30 Seconds</option>
                      <option value={60}>Every 1 Minute</option>
                      <option value={300}>Every 5 Minutes</option>
                  </select>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col space-y-4 min-h-[400px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center text-slate-300 font-medium">
                    <ShieldCheck size={18} className="mr-2 text-purple-400" /> Custom DBA Insights (JSON)
                </div>
                <button 
                  onClick={() => handleJsonChange(JSON.stringify(DialectRegistry, null, 2))}
                  className="text-[10px] text-slate-500 hover:text-blue-400 underline underline-offset-4"
                >
                  Reset to Defaults
                </button>
              </div>
              <p className="text-xs text-slate-500">Modify the diagnostic queries for each dialect. Format: <code>{`{ "postgres": [...DbaInsights], ... }`}</code></p>
              
              <div className="flex-1 relative">
                <textarea 
                  value={jsonValue}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  className="w-full h-full min-h-[300px] bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-300 focus:ring-1 focus:ring-purple-500 outline-none resize-none"
                  spellCheck={false}
                />
                {jsonError && (
                  <div className="absolute bottom-2 left-2 right-2 bg-red-900/80 border border-red-500 p-2 rounded flex items-center text-[10px] text-white">
                    <AlertCircle size={12} className="mr-2 shrink-0" />
                    <span className="truncate">{jsonError}</span>
                  </div>
                )}
              </div>

              <button 
                onClick={saveDbaConfig}
                disabled={!!jsonError}
                className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium rounded-lg shadow-lg transition-colors text-sm"
              >
                Apply DBA Configuration
              </button>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-850 border-t border-slate-800 flex justify-end">
            <button 
                onClick={onClose}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg shadow-lg transition-colors text-sm"
            >
                Close Settings
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;