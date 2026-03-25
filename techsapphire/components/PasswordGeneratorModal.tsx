import React, { useState, useCallback } from 'react';
import Icon from './Icon';

interface PasswordGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PasswordGeneratorModal: React.FC<PasswordGeneratorModalProps> = ({ isOpen, onClose }) => {
  const [password, setPassword] = useState('');
  const [length, setLength] = useState(16);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [copied, setCopied] = useState(false);

  const generatePassword = useCallback(() => {
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+~`|}{[]:;?><,./-=';

    let charset = lower + upper;
    if (includeNumbers) charset += numbers;
    if (includeSymbols) charset += symbols;

    let newPassword = '';
    for (let i = 0; i < length; i++) {
      newPassword += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setPassword(newPassword);
    setCopied(false);
  }, [length, includeNumbers, includeSymbols]);

  const handleCopy = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={onClose}>
      <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Password Generator</h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="relative">
            <input
              type="text"
              readOnly
              value={password}
              placeholder="Click 'Generate' to create a password"
              className="w-full px-3 py-2 pr-10 font-mono text-white bg-gray-900 border border-gray-600 rounded-md"
            />
            <button
              onClick={handleCopy}
              className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-white"
            >
              {copied ? <Icon name="check" className="w-5 h-5 text-green-400" /> : 'Copy'}
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label htmlFor="length" className="block text-sm font-medium text-gray-300">
                Password Length: {length}
              </label>
              <input
                id="length"
                type="range"
                min="8"
                max="64"
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeNumbers}
                  onChange={(e) => setIncludeNumbers(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-300">Include Numbers (0-9)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeSymbols}
                  onChange={(e) => setIncludeSymbols(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-300">Include Symbols (!@#$)</span>
              </label>
            </div>
          </div>
        </div>
        <div className="flex justify-between px-6 py-4 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-white bg-gray-600 rounded-md hover:bg-gray-500">
            Close
          </button>
          <button onClick={generatePassword} className="px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-500">
            Generate
          </button>
        </div>
      </div>
    </div>
  );
};

export default PasswordGeneratorModal;
