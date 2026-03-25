

import React, { useRef, useState } from 'react';
import useOnClickOutside from '../hooks/useOnClickOutside';
import MenuItem from './MenuItem';
import Icon from './Icon';
import { WhitespaceVisibility } from '../types';

interface AccordionProps {
    label: string;
    children: React.ReactNode;
}

const AccordionMenu: React.FC<AccordionProps> = ({ label, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div>
            <button onClick={() => setIsOpen(v => !v)} className="w-full text-left p-4 font-bold text-lg hover:bg-gray-700 flex justify-between items-center">
                <span>{label}</span>
                <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {isOpen && <div className="pl-4 border-l border-gray-600">{children}</div>}
        </div>
    )
}

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
    // File
    onNewFile: () => void;
    onOpenFile: () => void;
    onSaveFile: () => void;
    onCloseFile: () => void;
    onImportZip: () => void;
    onExportProject: () => void;
    // Edit
    onEditorCommand: (command: 'cut' | 'copy' | 'paste') => void;
    onShowFindWidget: () => void;
    // Project
    onOpenVersionHistory: () => void;
    onOpenProjectHub: () => void;
    onScanProjectFlow: () => void;
    onDeepScanProject: () => void;
    onViewLastScan: () => void;
    onViewLastDeepScan: () => void;
    onRunTests: () => void;
    // View
    isExplorerVisible: boolean;
    onToggleExplorer: () => void;
    isPreviewVisible: boolean;
    onTogglePreview: () => void;
    isAlgoVisible: boolean;
    onToggleAlgo: () => void;
    onSplitPane: () => void;
    isWordWrapEnabled: boolean;
    onToggleWordWrap: () => void;
    whitespaceVisibility: WhitespaceVisibility;
    onToggleWhitespace: () => void;
    isStatusBarVisible: boolean;
    onToggleStatusBar: () => void;
    onOpenSettings: () => void;
    // Settings
    isAdvancedMode: boolean;
    onToggleAdvancedMode: () => void;
    isInlineSuggestionEnabled: boolean;
    onToggleInlineSuggestions: () => void;
    isDebugModeEnabled: boolean;
    onToggleDebugMode: () => void;
    // Language
    onSetLanguage: () => void;
    // Format
    availableFormatters: {id: string, name: string}[];
    onFormatCode: (formatterId: string) => void;
    onChangeCase: (caseType: 'upper' | 'lower' | 'title') => void;
    // Help
    onLoadSampleData: () => void;
    onOpenAbout: () => void;
    // Disable states
    canTogglePreview: boolean;
    canDoFileActions: boolean;
    hasSelection: boolean;
    hasScanReport: boolean;
    hasDeepScanReport: boolean;
}


const MobileMenu: React.FC<MobileMenuProps> = (props) => {
  const menuRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(menuRef, props.onClose);

  const createHandler = (handler: (...args: any[]) => void, ...args: any[]) => () => {
    handler(...args);
    props.onClose();
  };

  if (!props.isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden">
      <div
        ref={menuRef}
        className="fixed top-0 left-0 w-64 h-full bg-gray-800 shadow-xl transform transition-transform duration-300 ease-in-out"
        style={{ transform: props.isOpen ? 'translateX(0)' : 'translateX(-100%)' }}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
            <h2 className="text-xl font-bold">Menu</h2>
            <button onClick={props.onClose}><Icon name="close" /></button>
        </div>

        <div className="overflow-y-auto pb-10">
            <AccordionMenu label="File">
                <MenuItem onClick={createHandler(props.onNewFile)}>New File</MenuItem>
                <MenuItem onClick={createHandler(props.onOpenFile)}>Open File...</MenuItem>
                <MenuItem onClick={createHandler(props.onImportZip)}>Import from ZIP...</MenuItem>
                <MenuItem type="separator" />
                <MenuItem onClick={createHandler(props.onSaveFile)} disabled={!props.canDoFileActions}>Save Version</MenuItem>
                <MenuItem onClick={createHandler(props.onExportProject)}>Download Project as ZIP</MenuItem>
                <MenuItem onClick={createHandler(props.onOpenVersionHistory)} disabled={!props.canDoFileActions}>Version History</MenuItem>
                <MenuItem type="separator" />
                <MenuItem onClick={createHandler(props.onCloseFile)} disabled={!props.canDoFileActions}>Close File</MenuItem>
            </AccordionMenu>
            <AccordionMenu label="Edit">
                <MenuItem onClick={createHandler(props.onEditorCommand, 'cut')}>Cut</MenuItem>
                <MenuItem onClick={createHandler(props.onEditorCommand, 'copy')}>Copy</MenuItem>
                <MenuItem onClick={createHandler(props.onEditorCommand, 'paste')}>Paste</MenuItem>
                <MenuItem type="separator" />
                <MenuItem onClick={createHandler(props.onShowFindWidget)}>Find...</MenuItem>
            </AccordionMenu>
             <AccordionMenu label="Project">
                <MenuItem onClick={createHandler(props.onOpenProjectHub)} disabled={!props.canDoFileActions}>Project Hub</MenuItem>
                <MenuItem onClick={createHandler(props.onScanProjectFlow)} disabled={!props.canDoFileActions}>Scan Project Flow</MenuItem>
                <MenuItem onClick={createHandler(props.onDeepScanProject)} disabled={!props.canDoFileActions}>Deep Scan Project</MenuItem>
                <MenuItem onClick={createHandler(props.onRunTests)} disabled={!props.canDoFileActions}>Run All Tests</MenuItem>
                <MenuItem type="separator" />
                <MenuItem onClick={createHandler(props.onViewLastScan)} disabled={!props.hasScanReport}>View Last Scan</MenuItem>
                <MenuItem onClick={createHandler(props.onViewLastDeepScan)} disabled={!props.hasDeepScanReport}>View Last Deepscan</MenuItem>
            </AccordionMenu>
            <AccordionMenu label="View">
                <MenuItem type="checkbox" checked={props.isExplorerVisible} onClick={props.onToggleExplorer}>Project Explorer</MenuItem>
                <MenuItem type="checkbox" checked={props.isPreviewVisible} onClick={props.onTogglePreview} disabled={!props.canTogglePreview}>Toggle Preview Panel</MenuItem>
                <MenuItem type="checkbox" checked={props.isAlgoVisible} onClick={props.onToggleAlgo} disabled={!props.canDoFileActions}>Toggle Algo Panel</MenuItem>
                <MenuItem type="separator" />
                <MenuItem onClick={createHandler(props.onSplitPane)}>Split Pane</MenuItem>
                <MenuItem type="separator" />
                <MenuItem type="checkbox" checked={props.isWordWrapEnabled} onClick={props.onToggleWordWrap}>Word Wrap</MenuItem>
                <MenuItem type="checkbox" checked={props.whitespaceVisibility === 'all'} onClick={props.onToggleWhitespace}>Show Invisibles</MenuItem>
                <MenuItem type="checkbox" checked={props.isStatusBarVisible} onClick={props.onToggleStatusBar}>Status Bar</MenuItem>
            </AccordionMenu>
            <AccordionMenu label="Settings">
                <MenuItem type="checkbox" checked={props.isAdvancedMode} onClick={props.onToggleAdvancedMode}>Advanced Snippets</MenuItem>
                <MenuItem type="checkbox" checked={props.isInlineSuggestionEnabled} onClick={props.onToggleInlineSuggestions}>Inline Suggestions</MenuItem>
                <MenuItem type="checkbox" checked={props.isDebugModeEnabled} onClick={props.onToggleDebugMode}>Debug Mode</MenuItem>
                <MenuItem type="separator" />
                <MenuItem onClick={createHandler(props.onOpenSettings)}>All Settings...</MenuItem>
            </AccordionMenu>
            <AccordionMenu label="Language">
                <MenuItem onClick={createHandler(props.onSetLanguage)} disabled={!props.canDoFileActions}>Change Language...</MenuItem>
            </AccordionMenu>
            <AccordionMenu label="Format">
                {props.availableFormatters.some(f => f.id === 'prettier') && <MenuItem onClick={createHandler(props.onFormatCode, 'prettier')} disabled={!props.canDoFileActions}>Format Document</MenuItem>}
                {props.availableFormatters.some(f => f.id === 'prettier_selection') && <MenuItem onClick={createHandler(props.onFormatCode, 'prettier_selection')} disabled={!props.hasSelection}>Format Selection</MenuItem>}
                <MenuItem onClick={createHandler(props.onFormatCode, 'reindent')} disabled={!props.canDoFileActions}>Re-indent Lines</MenuItem>
                <div className="ml-[-1rem]"> {/* Outdent to align with parent */}
                    <AccordionMenu label="Change Case">
                        <MenuItem onClick={createHandler(props.onChangeCase, 'upper')} disabled={!props.hasSelection}>UPPERCASE</MenuItem>
                        <MenuItem onClick={createHandler(props.onChangeCase, 'lower')} disabled={!props.hasSelection}>lowercase</MenuItem>
                        <MenuItem onClick={createHandler(props.onChangeCase, 'title')} disabled={!props.hasSelection}>Title Case</MenuItem>
                    </AccordionMenu>
                </div>
                <MenuItem onClick={createHandler(props.onFormatCode, 'compress')} disabled={!props.canDoFileActions}>Compress Empty Lines</MenuItem>
            </AccordionMenu>
            <AccordionMenu label="Extensions">
                {/* Placeholder for extensions in mobile */}
                <MenuItem disabled>Unavailable on Mobile</MenuItem>
            </AccordionMenu>
             <AccordionMenu label="Help">
                <MenuItem onClick={createHandler(props.onLoadSampleData)}>Load Sample Project</MenuItem>
                <MenuItem type="separator" />
                <MenuItem onClick={createHandler(props.onOpenAbout)}>About MoText</MenuItem>
            </AccordionMenu>
        </div>
      </div>
    </div>
  );
};

export default MobileMenu;
