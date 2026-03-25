
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Project, FileTab, SearchResult, ProjectSearchState, GitState, TestResult } from '../types';
import Icon from './Icon';
import GitPanel from './GitPanel';
import TestPanel from './TestPanel';
import { logger } from '../services/logger';

const PLACEHOLDER_FILENAME = '.placeholder';


interface FileNode {
  type: 'file';
  file: FileTab;
}
interface FolderNode {
  type: 'folder';
  name: string;
  children: { [key: string]: FileNode | FolderNode };
}
type TreeNode = FileNode | FolderNode;
type ExplorerView = 'files' | 'search' | 'source-control' | 'test';

const buildFileTree = (files: FileTab[]): FolderNode => {
  const root: FolderNode = { type: 'folder', name: 'root', children: {} };
  files.forEach(file => {
    let currentLevel = root.children;
    const pathParts = file.name.split('/');
    pathParts.forEach((part, index) => {
      if (index === pathParts.length - 1) {
        if (!part) return; // Handles trailing slashes
        currentLevel[part] = { type: 'file', file };
      } else {
        const node = currentLevel[part] as TreeNode | undefined;
        if (!node || node.type !== 'folder') {
          currentLevel[part] = { type: 'folder', name: part, children: {} };
        }
        currentLevel = (currentLevel[part] as FolderNode).children;
      }
    });
  });
  return root;
};

interface TreeNodeProps {
  name: string;
  node: TreeNode;
  level: number;
  path: string;
  activeFileId: number | null;
  dragOverPath: string | null;
  onSelectFile: (id: number) => void;
  onContextMenu: (e: React.MouseEvent, type: 'file' | 'folder', id: number | string, path: string) => void;
  onMoveItem: (sourcePath: string, destPath: string) => void;
  setDragOverPath: (path: string | null) => void;
}

const TreeNodeComponent: React.FC<TreeNodeProps> = ({ name, node, level, path, activeFileId, dragOverPath, onSelectFile, onContextMenu, onMoveItem, setDragOverPath }) => {
  const [isOpen, setIsOpen] = useState(true);

  const handleContextMenu = (e: React.MouseEvent) => {
    const targetId = node.type === 'file' ? node.file.id : path;
    onContextMenu(e, node.type, targetId, path);
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', path);
    e.dataTransfer.effectAllowed = 'move';
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverPath(path);
    e.dataTransfer.dropEffect = 'move';
  }

  const handleDragLeave = () => {
    setDragOverPath(null);
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sourcePath = e.dataTransfer.getData('text/plain');
    setDragOverPath(null);

    if (!sourcePath) return;
    if (sourcePath === path) return; // Can't drop on self
    if (path.startsWith(sourcePath + '/')) return; // Can't drop into its own child

    onMoveItem(sourcePath, path);
  }

  if (node.type === 'file') {
    if (name === PLACEHOLDER_FILENAME) return null; // Don't render placeholder files
    const isImage = node.file.mimeType?.startsWith('image/');
    const iconName = isImage ? 'image' : 'file';

    return (
      <li draggable onDragStart={handleDragStart} onContextMenu={handleContextMenu}>
        <button
          onClick={() => onSelectFile(node.file.id)}
          style={{ paddingLeft: `${level * 1}rem` }}
          className={`w-full text-left px-4 py-1.5 text-sm flex items-center ${node.file.id === activeFileId
              ? 'bg-gray-700 text-white'
              : 'text-gray-300 hover:bg-gray-700/50'
            }`}
        >
          <Icon name={iconName} className="w-4 h-4 mr-2 shrink-0" />
          <span className="truncate">{name}</span>
        </button>
      </li>
    );
  }

  // It's a folder
  const isDropTarget = dragOverPath === path;
  const sortedChildren = Object.entries(node.children).sort(([aName, aNode]: [string, TreeNode], [bName, bNode]: [string, TreeNode]) => {
    if (aName === PLACEHOLDER_FILENAME) return 1;
    if (bName === PLACEHOLDER_FILENAME) return -1;
    if (aNode.type === 'folder' && bNode.type === 'file') return -1;
    if (aNode.type === 'file' && bNode.type === 'folder') return 1;
    return aName.localeCompare(bName);
  });

  return (
    <li draggable onDragStart={handleDragStart} onContextMenu={handleContextMenu} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className={`rounded ${isDropTarget ? 'bg-blue-600/30' : ''}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{ paddingLeft: `${level * 1}rem` }}
        className="w-full text-left px-4 py-1.5 text-sm flex items-center text-gray-300 hover:bg-gray-700/50"
      >
        <Icon name={isOpen ? 'folderOpen' : 'folder'} className="w-4 h-4 mr-2 shrink-0" />
        <span className="truncate font-semibold">{name}</span>
      </button>
      {isOpen && (
        <ul>
          {sortedChildren.map(([childName, childNode]) => (
            <TreeNodeComponent
              key={childName}
              name={childName}
              node={childNode}
              level={level + 1}
              path={`${path}/${childName}`}
              activeFileId={activeFileId}
              dragOverPath={dragOverPath}
              onSelectFile={onSelectFile}
              onContextMenu={onContextMenu}
              onMoveItem={onMoveItem}
              setDragOverPath={setDragOverPath}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

const Highlight: React.FC<{ text: string, term: string }> = ({ text, term }) => {
  if (!term) return <>{text}</>;
  const parts = text.split(new RegExp(`(${term})`, 'gi'));
  return <>{parts.map((part, i) => part.toLowerCase() === term.toLowerCase() ? <mark key={i} className="bg-yellow-500 text-black px-0.5 rounded">{part}</mark> : part)}</>;
}

const SearchResultsView: React.FC<{ searchState: ProjectSearchState, onResultClick: (fileName: string, lineNumber: number) => void }> = ({ searchState, onResultClick }) => {
  const { results, query, isSearching } = searchState;

  const groupedResults = useMemo(() => {
    return results.reduce((acc, result) => {
      if (!acc[result.fileName]) acc[result.fileName] = [];
      acc[result.fileName].push(result);
      return acc;
    }, {} as { [fileName: string]: SearchResult[] });
  }, [results]);

  const [openFiles, setOpenFiles] = useState(() => new Set(Object.keys(groupedResults)));

  useEffect(() => {
    setOpenFiles(new Set(Object.keys(groupedResults)));
  }, [groupedResults]);

  const toggleFile = (fileName: string) => {
    setOpenFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileName)) next.delete(fileName);
      else next.add(fileName);
      return next;
    });
  }

  if (isSearching) {
    return <div className="p-4 text-gray-400 text-center">Searching...</div>;
  }

  if (results.length === 0) {
    return <div className="p-4 text-gray-400 text-center">No results for "{query}"</div>
  }

  return (
    <div className="p-2 text-sm">
      <p className="text-gray-400 mb-2 px-2">{results.length} results in {Object.keys(groupedResults).length} files</p>
      {Object.entries(groupedResults).map(([fileName, fileResults]: [string, SearchResult[]]) => (
        <div key={fileName} className="mb-1">
          <button onClick={() => toggleFile(fileName)} className="w-full flex items-center text-left p-2 rounded hover:bg-gray-700/50">
            <Icon name="chevron-down" className={`w-4 h-4 mr-2 transform transition-transform ${openFiles.has(fileName) ? '' : '-rotate-90'}`} />
            <span className="truncate font-semibold text-gray-200">{fileName}</span>
            <span className="ml-auto text-xs bg-gray-600 text-gray-300 rounded-full px-2 py-0.5">{fileResults.length}</span>
          </button>
          {openFiles.has(fileName) && (
            <ul className="pl-6 border-l border-gray-700 ml-2">
              {fileResults.map(result => (
                <li key={result.lineNumber}>
                  <button onClick={() => onResultClick(result.fileName, result.lineNumber)} className="w-full text-left p-2 rounded hover:bg-blue-600/20 flex">
                    <span className="text-gray-500 mr-2 shrink-0 w-10 text-right">{result.lineNumber}:</span>
                    <code className="text-gray-300 truncate"><Highlight text={result.lineContent} term={query} /></code>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

const OptionButton: React.FC<{ label: string, title: string, active: boolean, onClick: () => void }> = ({ label, title, active, onClick }) => (
  <button title={title} onClick={onClick} className={`px-2 py-1 rounded text-xs ${active ? 'bg-blue-600 text-white' : 'bg-gray-600 hover:bg-gray-500'}`}>
    {label}
  </button>
)

interface ProjectExplorerProps {
  projects: Project[];
  currentProject: Project | undefined;
  files: FileTab[];
  activeFileId: number | null;
  searchState: ProjectSearchState;
  gitState: GitState;
  testState: { results: TestResult | null, isTesting: boolean };
  onRunTests: () => void;
  onSearch: (options: Omit<ProjectSearchState, 'results' | 'isActive' | 'isSearching'>) => void;
  onClearSearch: () => void;
  onSearchResultClick: (fileName: string, lineNumber: number) => void;
  onSelectProject: (id: number) => void;
  onCreateProject: () => void;
  onSelectFile: (id: number) => void;
  onNewItem: (type: 'file' | 'folder', basePath?: string) => void;
  onContextMenu: (e: React.MouseEvent, type: 'file' | 'folder', id: number | string, path: string) => void;
  onMoveItem: (sourcePath: string, destPath: string) => void;
  onFileDrop: (files: FileList) => void;
  onOpenProjectHub: () => void;
  onUploadClick: () => void;
  onGitCommit: (message: string) => void;
  onGitPush: () => void;
  onGitPull: () => void;
  onGitRefresh: () => void;
}

const ProjectExplorer: React.FC<ProjectExplorerProps> = (props) => {
  const { files, activeFileId, onSelectFile, onContextMenu, onMoveItem, searchState, gitState, testState, onRunTests, onSearch, onClearSearch, onSearchResultClick, onFileDrop, onUploadClick } = props;
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [isDraggingOverRoot, setIsDraggingOverRoot] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileTree = useMemo(() => buildFileTree(files), [files]);

  const [activeView, setActiveView] = useState<ExplorerView>('files');
  const [isAdvancedSearchVisible, setAdvancedSearchVisible] = useState(false);
  const [localSearch, setLocalSearch] = useState({ query: '', include: '', exclude: '', isCaseSensitive: false, isWholeWord: false });
  const dragCounter = useRef(0);

  useEffect(() => {
    if (searchState.isActive) {
      setActiveView('search');
    } else if (activeView === 'search' && !searchState.query) {
      setActiveView('files');
    }
  }, [searchState.isActive, searchState.query, activeView]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearch(s => ({ ...s, [e.target.name]: e.target.value }));
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch({ ...localSearch, query: (e.target as HTMLInputElement).value });
    }
    if (e.key === 'Escape') {
      onClearSearch();
    }
  }

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const sourcePath = e.dataTransfer.getData('text/plain');
    if (sourcePath && sourcePath.includes('/')) onMoveItem(sourcePath, '');
    setDragOverPath(null); setIsDraggingOverRoot(false);
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (dragOverPath === null && e.dataTransfer.types.includes('text/plain')) {
      e.dataTransfer.dropEffect = 'move';
      setIsDraggingOverRoot(true);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      logger.debug(`Drag Enter: dragCounter=${dragCounter.current}, items=${e.dataTransfer.items.length}. Setting isDragOver=true.`);
      setIsDragOver(true);
    } else {
      logger.debug(`Drag Enter: dragCounter=${dragCounter.current}, no items. Not setting isDragOver.`);
    }
  };

  const handleGlobalDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    logger.debug(`Drag Leave: dragCounter=${dragCounter.current}.`);
    if (dragCounter.current === 0) {
      logger.debug('Drag counter is 0, setting isDragOver=false.');
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    logger.debug(`Drop event fired. dragCounter=${dragCounter.current}. Resetting state.`);
    setIsDragOver(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      logger.debug(`Drop detected with ${e.dataTransfer.files.length} files. Calling onFileDrop.`);
      onFileDrop(e.dataTransfer.files);
    } else {
      logger.debug('Drop detected but no files found in dataTransfer.');
    }
  };

  const renderContent = () => {
    switch (activeView) {
      case 'search':
        return <SearchResultsView searchState={searchState} onResultClick={onSearchResultClick} />;
      case 'source-control':
        return <GitPanel
          status={gitState.status}
          isProcessing={gitState.processingAction !== 'none'}
          onCommit={props.onGitCommit}
          onPush={props.onGitPush}
          onPull={props.onGitPull}
          onRefresh={props.onGitRefresh}
        />;
      case 'test':
        return <TestPanel results={testState.results} isTesting={testState.isTesting} onRunTests={onRunTests} />;
      case 'files':
      default:
        return (
          <ul onDrop={handleRootDrop} onDragOver={handleRootDragOver} onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOverRoot(false); }} className={`h-full transition-colors ${isDraggingOverRoot ? 'bg-blue-600/20' : ''}`}>
            {Object.entries(fileTree.children)
              .sort(([aName, aNode]: [string, TreeNode], [bName, bNode]: [string, TreeNode]) => {
                if (aNode.type === 'folder' && bNode.type === 'file') return -1;
                if (aNode.type === 'file' && bNode.type === 'folder') return 1;
                return aName.localeCompare(bName);
              })
              .map(([name, node]) => (
                <TreeNodeComponent
                  key={name} name={name} node={node} level={0} path={name}
                  activeFileId={activeFileId} dragOverPath={dragOverPath}
                  onSelectFile={onSelectFile} onContextMenu={onContextMenu}
                  onMoveItem={onMoveItem} setDragOverPath={setDragOverPath}
                />
              ))}
          </ul>
        );
    }
  }

  return (
    <aside
      className="relative w-72 bg-gray-800 border-r border-gray-700 flex flex-col shrink-0 h-full"
      onDragEnter={handleDragEnter}
      onDragOver={handleGlobalDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="p-2 border-b border-gray-700">
        <select value={props.currentProject?.id || ''} onChange={(e) => props.onSelectProject(Number(e.target.value))} className="w-full p-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none">
          {props.projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
        <button onClick={props.onCreateProject} className="w-full mt-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-500">
          New Project
        </button>
      </div>

      <div className="flex items-center justify-between p-2 border-b border-gray-700">
        <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase truncate">
          {props.currentProject?.name || 'Explorer'}
        </h3>
        <div className="flex items-center space-x-2">
          <button onClick={() => setActiveView('files')} title="Explorer" className={`p-1 rounded ${activeView === 'files' ? 'bg-gray-700' : ''}`}><Icon name="folder" className={`w-5 h-5 ${activeView === 'files' ? 'text-white' : 'text-gray-400 hover:text-white'}`} /></button>
          <button onClick={() => setActiveView('search')} title="Search" className={`p-1 rounded ${activeView === 'search' ? 'bg-gray-700' : ''}`}><Icon name="search" className={`w-5 h-5 ${activeView === 'search' ? 'text-white' : 'text-gray-400 hover:text-white'}`} /></button>
          <button onClick={() => setActiveView('source-control')} title="Source Control" className={`p-1 rounded ${activeView === 'source-control' ? 'bg-gray-700' : ''}`}><Icon name="git-branch" className={`w-5 h-5 ${activeView === 'source-control' ? 'text-white' : 'text-gray-400 hover:text-white'}`} /></button>
          <button onClick={() => setActiveView('test')} title="Test" className={`p-1 rounded ${activeView === 'test' ? 'bg-gray-700' : ''}`}><Icon name="beaker" className={`w-5 h-5 ${activeView === 'test' ? 'text-white' : 'text-gray-400 hover:text-white'}`} /></button>
          <button onClick={props.onOpenProjectHub} title="Project Hub" className="p-1"><Icon name="archive" className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>
      </div>

      {activeView === 'files' && (
        <div className="flex items-center justify-end p-2 border-b border-gray-700 space-x-2">
          <button onClick={onUploadClick} title="Upload Files" className="text-gray-400 hover:text-white"><Icon name="cloud-arrow-up" className="w-5 h-5" /></button>
          <button onClick={() => props.onNewItem('folder')} title="New Folder" className="text-gray-400 hover:text-white"><Icon name="folder-plus" className="w-5 h-5" /></button>
          <button onClick={() => props.onNewItem('file')} title="New File" className="text-gray-400 hover:text-white"><Icon name="file-plus" className="w-5 h-5" /></button>
        </div>
      )}

      {activeView === 'search' && (
        <div className="p-2 border-b border-gray-700">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><Icon name="search" className="w-4 h-4 text-gray-400" /></div>
            <input type="search" name="query" value={localSearch.query} onChange={handleSearchChange} onKeyDown={handleSearchKeyDown} placeholder="Search" className="w-full py-1.5 pl-9 pr-8 text-sm text-white bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <button onClick={() => setAdvancedSearchVisible(v => !v)} className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-white">
              <Icon name={isAdvancedSearchVisible ? 'chevron-up' : 'chevron-down'} className="w-4 h-4" />
            </button>
          </div>
          {isAdvancedSearchVisible && (
            <div className="mt-2 p-2 bg-gray-900/50 rounded-md space-y-2">
              <input type="text" name="include" value={localSearch.include} onChange={handleSearchChange} placeholder="files to include (e.g. *.js)" className="w-full px-2 py-1 text-xs text-white bg-gray-700 border-gray-600 rounded-md" />
              <input type="text" name="exclude" value={localSearch.exclude} onChange={handleSearchChange} placeholder="files to exclude (e.g. node_modules)" className="w-full px-2 py-1 text-xs text-white bg-gray-700 border-gray-600 rounded-md" />
              <div className="flex items-center justify-end space-x-2">
                <OptionButton title="Match Case" label="Aa" active={localSearch.isCaseSensitive} onClick={() => setLocalSearch(s => ({ ...s, isCaseSensitive: !s.isCaseSensitive }))} />
                <OptionButton title="Match Whole Word" label="[w]" active={localSearch.isWholeWord} onClick={() => setLocalSearch(s => ({ ...s, isWholeWord: !s.isWholeWord }))} />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {renderContent()}
      </div>

      {isDragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-gray-900/80 pointer-events-none border-2 border-dashed border-blue-400 rounded-lg m-2">
          <div className="text-center text-white">
            <Icon name="cloud-arrow-up" className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p className="font-semibold">Drop files to upload</p>
          </div>
        </div>
      )}
    </aside>
  );
};

export default ProjectExplorer;
