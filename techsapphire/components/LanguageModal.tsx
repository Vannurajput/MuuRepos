import React, { useState, useEffect } from 'react';
import { getSupportedLanguages, getCommonLanguages } from '../src/languages';
import { LanguageSupport } from '../types';

interface LanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLanguage: (languageId: string) => void;
  activeLanguageId?: string;
}

const LanguageModal: React.FC<LanguageModalProps> = ({ isOpen, onClose, onSelectLanguage, activeLanguageId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [allLanguages, setAllLanguages] = useState<LanguageSupport[]>([]);
  const commonLanguages = getCommonLanguages();

  useEffect(() => {
    if (isOpen) {
      setAllLanguages(getSupportedLanguages());
      setSearchTerm('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelect = (langId: string) => {
    onSelectLanguage(langId);
    onClose();
  };

  const filteredLanguages = allLanguages.filter(lang =>
    lang.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lang.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lang.aliases?.some(alias => alias.toLowerCase().includes(searchTerm.toLowerCase()))
  ).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div 
        className="flex flex-col w-full max-w-lg max-h-[80vh] bg-gray-800 border border-gray-700 rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-center text-white mb-4">Change Language</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
            {commonLanguages.map(lang => (
              <button
                key={lang.id}
                onClick={() => handleSelect(lang.id)}
                className={`p-2 text-sm text-white rounded-md transition-colors ${
                    lang.id === activeLanguageId 
                    ? 'bg-blue-700 font-semibold' 
                    : 'bg-gray-700 hover:bg-blue-600'
                }`}
              >
                {lang.name}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-b border-gray-700">
          <input
            type="text"
            placeholder="Or search for a language..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 text-white bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredLanguages.map(lang => (
            <button
              key={lang.id}
              onClick={() => handleSelect(lang.id)}
              className={`w-full px-4 py-2 text-left text-gray-300 ${
                  lang.id === activeLanguageId
                  ? 'bg-blue-600'
                  : 'hover:bg-gray-700'
              }`}
            >
              {lang.name}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-gray-700">
            <button onClick={onClose} className="w-full px-4 py-2 text-white bg-gray-600 rounded-md hover:bg-gray-500">
                Cancel
            </button>
        </div>
      </div>
    </div>
  );
};

export default LanguageModal;