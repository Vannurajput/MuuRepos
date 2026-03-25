import React from 'react';
import { FindState } from '../types';
import Icon from './Icon';

interface FindWidgetProps {
    state: FindState;
    onStateChange: (newState: FindState) => void;
    onFindNext: () => void;
    onFindPrev: () => void;
    onReplace: () => void;
    onReplaceAll: () => void;
    onClose: () => void;
}

const OptionButton: React.FC<{label: string, active: boolean, onClick: () => void}> = ({ label, active, onClick }) => (
    <button title={label} onClick={onClick} className={`px-2 py-1 rounded text-xs ${active ? 'bg-blue-600 text-white' : 'bg-gray-600 hover:bg-gray-500'}`}>
        {label}
    </button>
)

const FindWidget: React.FC<FindWidgetProps> = ({ state, onStateChange, onFindNext, onFindPrev, onReplace, onReplaceAll, onClose }) => {
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onStateChange({ ...state, [e.target.name]: e.target.value });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                onFindPrev();
            } else {
                onFindNext();
            }
        }
    }

    return (
        <div className="absolute top-0 right-0 z-20 p-2 m-2 bg-gray-800 border border-gray-700 rounded-md shadow-lg w-96">
            <div className="grid grid-cols-2 gap-2">
                {/* Find Input */}
                <div className="col-span-2 relative">
                    <input
                        type="text"
                        name="searchTerm"
                        placeholder="Find"
                        value={state.searchTerm}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        className="w-full pl-2 pr-20 py-1 text-sm bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-1 space-x-1">
                        <OptionButton label="Aa" active={state.isCaseSensitive} onClick={() => onStateChange({...state, isCaseSensitive: !state.isCaseSensitive})} />
                        <OptionButton label="[w]" active={state.isWholeWord} onClick={() => onStateChange({...state, isWholeWord: !state.isWholeWord})} />
                        <OptionButton label=".*" active={state.isRegex} onClick={() => onStateChange({...state, isRegex: !state.isRegex})} />
                    </div>
                </div>

                {/* Replace Input */}
                 <div className="col-span-2 relative">
                    <input
                        type="text"
                        name="replaceTerm"
                        placeholder="Replace"
                        value={state.replaceTerm}
                        onChange={handleInputChange}
                        className="w-full pl-2 pr-1 py-1 text-sm bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                
                {/* Action Buttons */}
                <button onClick={onFindPrev} title="Find Previous" className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-md flex justify-center items-center">↑</button>
                <button onClick={onFindNext} title="Find Next" className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-md flex justify-center items-center">↓</button>
                <button onClick={onReplace} className="col-span-1 p-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-md">Replace</button>
                <button onClick={onReplaceAll} className="col-span-1 p-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-md">Replace All</button>

            </div>
             <button onClick={onClose} className="absolute top-1 right-1 p-1 text-gray-400 hover:text-white">
                <Icon name="close" className="w-4 h-4" />
            </button>
        </div>
    );
};

export default FindWidget;