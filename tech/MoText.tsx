import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FileTab, EditorState, ContextMenuState, UISettings, Project, FindState, WhitespaceVisibility, Version, EditorPane, FileContextMenuState, ProjectHistoryEvent, ProjectSnapshot, ProjectAnalysisReport, DeepAnalysisReport, ProjectSearchState, SearchResult, GitConfig, GitState, TestResult } from './types';
import * as formattingService from './services/formattingService';
import * as projectAnalysisService from './services/projectAnalysisService';
import { createSearchWorker } from './services/projectSearchService';
import { createTestWorker } from './services/testRunnerService';
import * as extensionService from './extensions/extensionService';
import { ExtensionContext } from './extensions/types';
import { getLanguageSupport, getCommonLanguages } from './src/languages';
import MonacoEditor, { EditorRef } from './components/MonacoEditor';
import TabBar from './components/TabBar';
import StatusBar from './components/StatusBar';
import ContextMenu from './components/ContextMenu';
import LanguageModal from './components/LanguageModal';
import MenuBar from './components/MenuBar';
import Menu from './components/Menu';
import MenuItem from './components/MenuItem';
import Icon from './components/Icon';
import MobileMenu from './components/MobileMenu';
import SettingsModal from './components/SettingsModal';
import PreviewPanel from './components/PreviewPane';
import ProjectExplorer from './components/ProjectExplorer';
import Toolbar from './components/Toolbar';
import AboutModal from './components/AboutModal';
import FindWidget from './components/FindWidget';
import DraggableResizer from './components/DraggableResizer';
import AlgoPanel from './components/AlgoPanel';
import VersionHistoryModal from './components/VersionHistoryModal';
import { SAMPLE_PROJECT_DATA } from './services/sampleData';
import ImageViewer from './components/ImageViewer';
import BinaryFileViewer from './components/BinaryFileViewer';
import InputDialog from './components/InputDialog';
import FileContextMenu from './components/FileContextMenu';
import PropertiesModal from './components/PropertiesModal';
import ProjectHubModal from './components/ProjectHubModal';
import PasswordGeneratorModal from './components/PasswordGeneratorModal';
import PdfConverterModal from './components/PdfConverterModal';
import PdfViewer from './components/PdfViewer';
import * as fflate from 'fflate';
import { logger, setDebugMode } from './services/logger';
import ProcessingModal from './components/ProcessingModal';
import AnalysisViewer from './components/AnalysisViewer';
import AlgoViewer from './components/AlgoViewer';
import DeepAnalysisViewer from './components/DeepAnalysisViewer';
import DataViewer from './components/DataViewer';
import AlertDialog from './components/AlertDialog';
import ConfirmDialog from './components/ConfirmDialog';

const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? '⌘' : 'Ctrl';
const TEXT_EXTENSIONS = ['txt', 'md', 'js', 'jsx', 'ts', 'tsx', 'html', 'htm', 'css', 'scss', 'json', 'xml', 'svg', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rb', 'php', 'rs', 'sh', 'ps1', 'bat', 'sql', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'log', 'placeholder', 'algo', 'algod'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico'];
const PDF_EXTENSIONS = ['pdf'];
const DATA_EXTENSIONS = ['sqlite', 'db', 'duckdb', 'parquet'];
const PLACEHOLDER_FILENAME = '.placeholder';


interface InputDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  initialValue: string;
  onSubmit: (value: string) => void;
}

interface AlertDialogState {
  isOpen: boolean;
  title: string;
  message: string;
}

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

interface PropertiesModalState {
    isOpen: boolean;
    targetPath: string | null;
}

interface ScanStatus {
  isScanning: boolean;
  scanType: 'shallow' | 'deep';
  processed: number;
  total: number;
}

export interface MoTextState {
    projects: Project[];
    files: FileTab[];
    activeProjectId: number | null;
    openFileIds: number[];
    history: ProjectHistoryEvent[];
    snapshots: ProjectSnapshot[];
    uiSettings: UISettings;
}

interface MoTextProps {
    initialData?: MoTextState;
    onSave?: (data: MoTextState) => void;
}

const MoText: React.FC<MoTextProps> = ({ initialData, onSave }) => {
  // Project State
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);

  // File & Editor State
  const [files, setFiles] = useState<FileTab[]>([]);
  const [openFileIds, setOpenFileIds] = useState<number[]>([]);
  const [panes, setPanes] = useState<EditorPane[]>([{ id: Date.now(), fileId: null }]);
  const [activePaneId, setActivePaneId] = useState<number | null>(panes[0].id);
  const [editorState, setEditorState] = useState<EditorState>({ line: 1, column: 1, charCount: 0, selectionLength: 0 });
  const [availableFormatters, setAvailableFormatters] = useState<{id: string, name: string}[]>([]);
  const editorRefs = useRef<{[key: number]: EditorRef | null}>({});
  const [pendingNavigation, setPendingNavigation] = useState<{ fileId: number; line: number } | null>(null);
  
  // UI State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ x: 0, y: 0, fileId: 0, visible: false });
  const [fileContextMenu, setFileContextMenu] = useState<FileContextMenuState>({ x: 0, y: 0, targetId: 0, targetType: 'file', path: '', visible: false });
  const [isLanguageModalOpen, setLanguageModalOpen] = useState(false);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isAboutModalOpen, setAboutModalOpen] = useState(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isExplorerVisible, setExplorerVisible] = useState(true);
  const [findState, setFindState] = useState<FindState>({ isVisible: false, searchTerm: '', replaceTerm: '', isCaseSensitive: false, isWholeWord: false, isRegex: false, lastResultIndex: null });
  const [sidePanel, setSidePanel] = useState<{ mode: 'none' | 'preview' | 'algo', width: number }>({ mode: 'none', width: 400 });
  const [inputDialogState, setInputDialogState] = useState<InputDialogState>({ isOpen: false, title: '', message: '', initialValue: '', onSubmit: () => {} });
  const [alertDialog, setAlertDialog] = useState<AlertDialogState>({ isOpen: false, title: '', message: '' });
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [propertiesModalState, setPropertiesModalState] = useState<PropertiesModalState>({ isOpen: false, targetPath: null });
  const [scanStatus, setScanStatus] = useState<ScanStatus>({ isScanning: false, scanType: 'shallow', processed: 0, total: 0 });
  const [projectSearch, setProjectSearch] = useState<ProjectSearchState>({ isActive: false, query: '', results: [], include: '', exclude: '', isCaseSensitive: false, isWholeWord: false, isSearching: false });
  
  const [uiSettings, setUiSettings] = useState<UISettings>({ menuPosition: 'top', isAdvancedMode: false, isInlineSuggestionEnabled: true, isAutoSaveEnabled: false, previewMode: false, isDebugModeEnabled: true });
  const [isWordWrapEnabled, setWordWrapEnabled] = useState(true);
  const [isStatusBarVisible, setStatusBarVisible] = useState(true);
  const [whitespaceVisibility, setWhitespaceVisibility] = useState<WhitespaceVisibility>('none');

  const [isVersionHistoryModalOpen, setVersionHistoryModalOpen] = useState(false);
  const [fileVersions, setFileVersions] = useState<Version[]>([]);
  const [debouncedPreviewContent, setDebouncedPreviewContent] = useState('');
  
  // Analysis View State
  const [analysisReport, setAnalysisReport] = useState<ProjectAnalysisReport | null>(null);
  const [deepAnalysisReport, setDeepAnalysisReport] = useState<DeepAnalysisReport | null>(null);
  const [activeView, setActiveView] = useState<'editor' | 'analysis' | 'deepAnalysis'>('editor');

  // Test State
  const [testResults, setTestResults] = useState<TestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const testWorkerRef = useRef<Worker | null>(null);

  // Project Hub State
  const [isProjectHubModalOpen, setProjectHubModalOpen] = useState(false);
  const [projectHistory, setProjectHistory] = useState<ProjectHistoryEvent[]>([]);
  const [projectSnapshots, setProjectSnapshots] = useState<ProjectSnapshot[]>([]);

  // Extension Modals State
  const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
  const [pdfTargetFile, setPdfTargetFile] = useState<FileTab | null>(null);
  
  // Git State (Placeholder)
  const [gitState, setGitState] = useState<GitState>({ status: [], processingAction: 'none', processingMessage: null });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const searchWorkerRef = useRef<Worker | null>(null);

  const showAlert = useCallback((title: string, message: string) => {
    setAlertDialog({ isOpen: true, title, message });
  }, []);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm });
  }, []);
  
  const currentProject = useMemo(() => projects.find(p => p.id === currentProjectId), [projects, currentProjectId]);
  const filesForCurrentProject = useMemo(() => files.filter(f => f.projectId === currentProjectId), [files, currentProjectId]);
  const openTabsForCurrentProject = useMemo(() => openFileIds
    .map(id => files.find(f => f.id === id))
    .filter((f): f is FileTab => f !== undefined && f.projectId === currentProjectId), [openFileIds, files, currentProjectId]);

  const activePane = panes.find(p => p.id === activePaneId);
  const activeFile = files.find(f => f.id === activePane?.fileId);

  // Stable no-op function to prevent re-renders in inactive Monaco editors
  const noOpStateChange = useCallback(() => {}, []);
  
  // --- State Saving ---
  const saveState = useCallback(() => {
    if (onSave) {
        onSave({
            projects,
            files,
            activeProjectId: currentProjectId,
            openFileIds,
            history: projectHistory,
            snapshots: projectSnapshots,
            uiSettings,
        });
        logger.debug('onSave callback triggered.');
    }
  }, [onSave, projects, files, currentProjectId, openFileIds, projectHistory, projectSnapshots, uiSettings]);

  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(saveState, 1000);
  }, [saveState]);


  // Initialize and terminate search worker
  useEffect(() => {
    searchWorkerRef.current = createSearchWorker();
    searchWorkerRef.current.onmessage = (event: MessageEvent<{ results: SearchResult[] }>) => {
        setProjectSearch(s => ({ ...s, results: event.data.results, isSearching: false }));
    };
    testWorkerRef.current = createTestWorker();
    testWorkerRef.current.onmessage = (event: MessageEvent<TestResult>) => {
        setTestResults(event.data);
        setIsTesting(false);
    };
    return () => {
        searchWorkerRef.current?.terminate();
        testWorkerRef.current?.terminate();
    }
  }, []);
  
  const addProject = useCallback(async (name: string): Promise<Project> => {
    logger.debug(`Adding new project with name: "${name}"`);
    const newProject = { id: Date.now(), name };
    setProjects(prev => [...prev, newProject]);
    logger.debug(`Project added successfully:`, newProject);
    return newProject;
  }, []);

  const handleCreateProject = useCallback(async (name: string, isInitialSetup = false) => {
    logger.debug(`Handling create project action for name: "${name}"`);
    const newProject = await addProject(name);
    logger.debug(`New project created with ID: ${newProject.id}. Setting as current.`);
    setCurrentProjectId(newProject.id);
    if (!isInitialSetup) {
        saveState();
    }
  }, [addProject, saveState]);
  
  const openCreateProjectDialog = () => {
    logger.debug('Opening create project dialog');
    setInputDialogState({
      isOpen: true,
      title: 'New Project',
      message: 'Enter a name for the new project:',
      initialValue: 'New Project',
      onSubmit: (name) => {
        handleCreateProject(name);
        closeInputDialog();
      },
    });
  };

  // Initial data load from props
  useEffect(() => {
    logger.debug('MoText component mounting, loading initial data from props...');
    if (initialData && initialData.projects && initialData.projects.length > 0) {
        setProjects(initialData.projects);
        setCurrentProjectId(initialData.activeProjectId ?? initialData.projects[0].id);
        setFiles(initialData.files ?? []);
        setOpenFileIds(initialData.openFileIds ?? []);
        setUiSettings(prev => ({ ...prev, ...(initialData.uiSettings ?? {}) }));
        setProjectHistory(initialData.history ?? []);
        setProjectSnapshots(initialData.snapshots ?? []);

        const initialOpenFileIds = initialData.openFileIds ?? [];
        let fileToOpenId: number | null = null;

        if (initialOpenFileIds.length > 0) {
            fileToOpenId = initialOpenFileIds[0];
        } else if (initialData.files && initialData.files.length > 0) {
            fileToOpenId = initialData.files[0].id;
            setOpenFileIds([fileToOpenId]);
        }

        if (fileToOpenId) {
            const newPane = { id: Date.now(), fileId: fileToOpenId };
            setPanes([newPane]);
            setActivePaneId(newPane.id);
        }
    } else {
        logger.debug('No valid initial data, creating default project.');
        const defaultProjectId = Date.now();
        const defaultProject = { id: defaultProjectId, name: "Default Project" };
        const welcomeFileId = defaultProjectId + 1;
        const welcomeFile: FileTab = {
          id: welcomeFileId,
          projectId: defaultProjectId,
          name: 'welcome.md',
          content: '# Welcome to MoText!\\n\\nThis is a reusable component.',
          language: 'markdown',
          isBinary: false,
          mimeType: 'text/plain',
          createdAt: welcomeFileId,
          modifiedAt: welcomeFileId,
        };
        setProjects([defaultProject]);
        setCurrentProjectId(defaultProjectId);
        setFiles([welcomeFile]);
        setOpenFileIds([welcomeFileId]);
        const newPane = { id: Date.now(), fileId: welcomeFileId };
        setPanes([newPane]);
        setActivePaneId(newPane.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once

  // Sync logger with UI settings
  useEffect(() => {
    setDebugMode(uiSettings.isDebugModeEnabled);
  }, [uiSettings.isDebugModeEnabled]);
  
  const logHistoryEvent = useCallback((type: ProjectHistoryEvent['type'], details: string) => {
    if (!currentProjectId) return;
    logger.debug(`Logging history event: ${type} - ${details}`);
    const event: ProjectHistoryEvent = { timestamp: Date.now(), type, details };
    setProjectHistory(prev => [event, ...prev].sort((a,b) => b.timestamp - a.timestamp));
  }, [currentProjectId]);

  // Auto-Save Effect
  useEffect(() => {
    if (!uiSettings.isAutoSaveEnabled) return;
    logger.debug(`Auto-save enabled.`);
    const intervalId = setInterval(saveState, 30000); // 30 seconds
    return () => {
      logger.debug('Disabling auto-save.');
      clearInterval(intervalId);
    }
  }, [uiSettings.isAutoSaveEnabled, saveState]);

  const languageSupport = activeFile ? getLanguageSupport(activeFile.language) : null;

  useEffect(() => {
      if (activeFile) {
          setAvailableFormatters(formattingService.getAvailableFormatters(activeFile.language));
      } else {
          setAvailableFormatters([]);
      }
      if (sidePanel.mode === 'preview' && !languageSupport?.isVisual) {
          logger.debug('Closing preview panel because current language is not visual.');
          setSidePanel(s => ({ ...s, mode: 'none' }));
      }
  }, [activeFile, languageSupport, sidePanel.mode]);

  // Debounce effect for preview content
  useEffect(() => {
    if (!activeFile || sidePanel.mode !== 'preview') {
      return;
    }

    const handler = setTimeout(() => {
      logger.debug('Updating debounced preview content.');
      setDebouncedPreviewContent(activeFile.content);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [activeFile?.content, sidePanel.mode]);

  // Effect to update preview immediately when switching files
  useEffect(() => {
    if (activeFile) {
      setDebouncedPreviewContent(activeFile.content);
    }
  }, [activeFile?.id]);

  // Manual refresh handler for the button
  const handlePreviewRefresh = useCallback(() => {
    if (activeFile) {
      logger.debug('Manually refreshing preview content.');
      setDebouncedPreviewContent(activeFile.content);
    }
  }, [activeFile]);

  const createNewFile = useCallback(async (fileName: string, content = '', language?: string) => {
    if (!currentProjectId || !fileName) return;
    logger.debug(`Creating new file: ${fileName}`);

    const now = Date.now();
    const newFileId = now;
    const extension = fileName.split('.').pop() || 'plaintext';
    const lang = language || (fileName.endsWith('.algo') ? 'algo' : (fileName.endsWith('.algod') ? 'algod' : extension));

    const newFile: FileTab = {
      id: newFileId,
      projectId: currentProjectId,
      name: fileName,
      content: content,
      language: lang,
      isBinary: false,
      mimeType: 'text/plain',
      createdAt: now,
      modifiedAt: now,
    };
    logHistoryEvent('create', `File '${fileName}' created.`);
    setFiles(prev => [...prev, newFile]);
    setOpenFileIds(prev => [...prev, newFile.id]);

    const currentActivePaneId = activePaneId || panes[0]?.id;
    setPanes(prevPanes => prevPanes.map(p => p.id === currentActivePaneId ? { ...p, fileId: newFileId } : p));
    if (!currentActivePaneId && panes.length === 0) {
        const newPane = { id: Date.now(), fileId: newFileId };
        setPanes([newPane]);
        setActivePaneId(newPane.id);
    } else {
        setActivePaneId(currentActivePaneId);
    }
    debouncedSave();
    return newFile;
  }, [currentProjectId, activePaneId, panes, logHistoryEvent, debouncedSave]);
  
  const handleNewFile = useCallback(() => {
    if (!currentProjectId) return;
    let counter = 1;
    let newFileName = `untitled-${counter}.txt`;
    while (filesForCurrentProject.some(file => file.name === newFileName)) {
        counter++;
        newFileName = `untitled-${counter}.txt`;
    }
    createNewFile(newFileName);
  }, [currentProjectId, filesForCurrentProject, createNewFile]);
  
  const handleTriggerFileUpload = () => {
    logger.debug('Triggering file input for upload action.');
    fileInputRef.current?.click();
  }
  
  const handleFileUploads = useCallback(async (uploadedFiles: FileList) => {
    if (!currentProjectId) {
        logger.warn('File upload attempted without a current project selected.');
        return;
    }
    logger.debug(`Handling ${uploadedFiles.length} uploaded files for project ID ${currentProjectId}.`);

    const processFile = (file: File): Promise<Omit<FileTab, 'id'> | null> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        const extension = file.name.split('.').pop()?.toLowerCase() || '';
        const isBinaryFile = IMAGE_EXTENSIONS.includes(extension) || PDF_EXTENSIONS.includes(extension) || DATA_EXTENSIONS.includes(extension) || !TEXT_EXTENSIONS.includes(extension);

        reader.onload = (event) => {
          const content = event.target?.result as string;
          if (!content) {
            resolve(null);
            return;
          }
          const now = Date.now();
          const newFile: Omit<FileTab, 'id'> = {
            projectId: currentProjectId,
            name: file.name,
            content: content,
            language: extension,
            isBinary: isBinaryFile,
            mimeType: file.type,
            createdAt: now,
            modifiedAt: now,
          };
          logger.debug(`Successfully read file: ${file.name}`);
          resolve(newFile);
        };
        
        reader.onerror = (err) => {
            logger.error(`Error reading file: ${file.name}`, err);
            resolve(null);
        }

        if (isBinaryFile) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      });
    };

    const newFilesPromises = Array.from(uploadedFiles).map(processFile);
    const processedFiles = (await Promise.all(newFilesPromises)).filter((f): f is Omit<FileTab, 'id'> => f !== null);

    if (processedFiles.length === 0) {
        logger.warn('No files were successfully processed from the upload.');
        return;
    }
    
    logger.debug(`Processed ${processedFiles.length} files. Generating IDs and saving.`);
    const baseTimestamp = Date.now();
    const newFiles: FileTab[] = processedFiles.map((fileData, index) => ({
      ...fileData,
      id: baseTimestamp + index,
    }));
    
    for (const newFile of newFiles) {
        logHistoryEvent('create', `File '${newFile.name}' imported.`);
    }

    setFiles(prevFiles => [...prevFiles, ...newFiles]);

    if (newFiles.length > 0) {
        const firstNewFileId = newFiles[0].id;
        if (!openFileIds.includes(firstNewFileId)) {
            setOpenFileIds(prev => [...prev, firstNewFileId]);
        }
        const targetPaneId = activePaneId || (panes.length > 0 ? panes[0].id : null);
        if (targetPaneId) {
            setPanes(prevPanes => prevPanes.map(p => p.id === targetPaneId ? { ...p, fileId: firstNewFileId } : p));
        }
    }
    saveState();
  }, [currentProjectId, logHistoryEvent, activePaneId, openFileIds, panes, saveState]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUploads(e.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };


  const handleSaveFile = useCallback(() => {
    if (!activeFile || !currentProjectId) return;
    logger.debug(`Saving version for file: ${activeFile.name}`);
    if(activeFile.isBinary) {
      logger.warn('Attempted to save version for a binary file. Aborting.');
      return; 
    }
    setFiles(prev => prev.map(f => f.id === activeFile.id ? { ...f, isDirty: false, modifiedAt: Date.now() } : f));
    saveState();
  }, [activeFile, currentProjectId, saveState]);

  const handleSelectFile = (id: number) => {
    if (!currentProjectId) return;
    logger.debug(`Selecting file ID: ${id}`);
    const file = files.find(f => f.id === id);
    if (file?.language === 'algo') {
        if(analysisReport) setActiveView('analysis');
    } else if (file?.language === 'algod') {
        if(deepAnalysisReport) setActiveView('deepAnalysis');
    } else {
        setActiveView('editor');
    }

    const activePaneIdToUse = activePaneId || panes[0]?.id;
    if (!activePaneIdToUse) {
      logger.warn('No active pane to select file into.');
      return;
    }

    const isAlreadyOpen = openFileIds.includes(id);

    if (isAlreadyOpen) {
        setPanes(prevPanes => prevPanes.map(p => p.id === activePaneIdToUse ? { ...p, fileId: id } : p));
        debouncedSave();
        return;
    }
    
    if (uiSettings.previewMode) {
        const currentFileIdInPane = panes.find(p => p.id === activePaneIdToUse)?.fileId;
        setOpenFileIds(prev => {
            if (!currentFileIdInPane) return [...prev, id];
            const idx = prev.indexOf(currentFileIdInPane);
            if (idx > -1) {
                const newIds = [...prev];
                newIds[idx] = id;
                return newIds;
            }
            return [...prev, id];
        });
    } else {
        setOpenFileIds(prev => [...prev, id]);
    }
    
    setPanes(prevPanes => prevPanes.map(p => p.id === activePaneIdToUse ? { ...p, fileId: id } : p));
    debouncedSave();
  };

  // When project changes, if active file is not in new project, select a new one
  useEffect(() => {
    if (!currentProjectId) return;
    const activeFileIsInCurrentProject = files.some(f => f.id === activePane?.fileId && f.projectId === currentProjectId);
    if ((activePane?.fileId && !activeFileIsInCurrentProject) || !activePane?.fileId) {
      const firstOpenFileInNewProject = openTabsForCurrentProject[0];
      if (firstOpenFileInNewProject) {
        setPanes(prev => prev.map(p => p.id === (activePaneId || panes[0]?.id) ? { ...p, fileId: firstOpenFileInNewProject.id } : p));
      } else {
        const firstFileInProject = filesForCurrentProject.find(f => !f.name.endsWith(PLACEHOLDER_FILENAME));
        if (firstFileInProject) {
            handleSelectFile(firstFileInProject.id); // This will open it and set it active
        } else {
            // No files in new project, clear pane
            setPanes(prev => prev.map(p => p.id === (activePaneId || panes[0]?.id) ? { ...p, fileId: null } : p));
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId]);

  const handleCloseFile = useCallback(async (id: number) => {
    if (!currentProjectId) return;
    logger.debug(`Closing file ID: ${id}`);
    
    const closingFileIndex = openFileIds.findIndex(fid => fid === id);
    if (closingFileIndex === -1) return;

    const newOpenFileIds = openFileIds.filter(fid => fid !== id);
    setOpenFileIds(newOpenFileIds);

    let nextFileToShow: number | null = null;
    if (newOpenFileIds.length > 0) {
        const nextIndex = Math.max(0, closingFileIndex - 1);
        nextFileToShow = newOpenFileIds[nextIndex];
    }
    
    setPanes(prevPanes => {
        const newPanes = prevPanes.map(p => {
            if (p.fileId === id) return { ...p, fileId: nextFileToShow };
            return p;
        });
        if (newOpenFileIds.length > 0 && newPanes.every(p => p.fileId === null)) {
            newPanes[0].fileId = newOpenFileIds[0];
        }
        return newPanes;
    });

    if (newOpenFileIds.length === 0 && filesForCurrentProject.length > 0) {
      const firstFile = filesForCurrentProject.find(f => !f.name.endsWith(`/${PLACEHOLDER_FILENAME}`));
      if (firstFile) {
        const firstFileId = firstFile.id;
        setOpenFileIds([firstFileId]);
        setPanes(prev => {
          if (prev.length > 0) {
            const newPanes = [...prev];
            newPanes[0].fileId = firstFileId;
            return newPanes;
          }
          const newPane = { id: Date.now(), fileId: firstFileId };
          setActivePaneId(newPane.id);
          return [newPane];
        });
      }
    } else if (filesForCurrentProject.length === 0) {
        handleNewFile();
    }
    saveState();
  }, [currentProjectId, openFileIds, handleNewFile, filesForCurrentProject, saveState]);

  const handleContentChange = useCallback((id: number, content: string, selection?: { start: number, end: number }) => {
    if (!currentProjectId) return;
    const now = Date.now();
    setFiles(prevFiles => prevFiles.map(f => (f.id === id ? { ...f, content, isDirty: true, modifiedAt: now } : f)));
    debouncedSave();
  }, [currentProjectId, debouncedSave]);

  const handleLanguageChange = useCallback((languageId: string) => {
    if (!activeFile || !currentProjectId) return;
    logger.debug(`Changing language for file ${activeFile.name} to ${languageId}`);
    const now = Date.now();
    const currentName = activeFile.name;
    const currentExt = currentName.includes('.') ? currentName.substring(currentName.lastIndexOf('.') + 1) : '';
    const oldLangSupport = getLanguageSupport(activeFile.language);
    const isOldExtLanguage = oldLangSupport.aliases?.includes(currentExt) || oldLangSupport.id === currentExt;
    const newName = (currentName.includes('.') && isOldExtLanguage) ? currentName.substring(0, currentName.lastIndexOf('.')) + `.${languageId}` : `${currentName}.${languageId}`;
    setFiles(prevFiles => prevFiles.map(f => f.id === activeFile.id ? { ...f, language: languageId, name: newName, isDirty: true, modifiedAt: now } : f));
    saveState();
  }, [activeFile, currentProjectId, saveState]);

  const handleRenameFileCommit = useCallback((fileId: number, newName: string) => {
    if (!currentProjectId) return;
    logger.debug(`Committing rename for file ID ${fileId} to "${newName}"`);

    const trimmedName = newName.trim();
    const fileToRename = files.find(f => f.id === fileId);

    if (!trimmedName || !fileToRename || trimmedName === fileToRename.name) {
      logger.warn('Rename aborted: invalid name or name unchanged.');
      return;
    }

    if (filesForCurrentProject.some(f => f.name === trimmedName && f.id !== fileId)) {
      showAlert('Rename Failed', `A file with the name "${trimmedName}" already exists.`);
      return;
    }

    const newLang = trimmedName.split('.').pop() || 'plaintext';
    const now = Date.now();
    logHistoryEvent('rename', `'${fileToRename.name}' renamed to '${trimmedName}'.`);
    setFiles(prevFiles => prevFiles.map(f => f.id === fileId ? { ...f, name: trimmedName, language: newLang, isDirty: true, modifiedAt: now } : f));
    saveState();
  }, [currentProjectId, files, filesForCurrentProject, logHistoryEvent, saveState, showAlert]);
  
  const handleEditorCommand = (command: 'cut' | 'copy' | 'paste') => {
    try { 
      logger.debug(`Executing editor command: ${command}`);
      if (!document.execCommand(command)) logger.warn(`'${command}' command was unsuccessful`);
    } 
    catch (err) { logger.error(`'${command}' command failed:`, err); }
  };
  
  const handleSettingsChange = (newSettings: Partial<UISettings>) => {
    logger.debug('Changing UI settings:', newSettings);
    setUiSettings(prev => ({ ...prev, ...newSettings }));
    saveState();
  };

  const handleTabContextMenu = (e: React.MouseEvent, fileId: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, fileId, visible: true });
  };

  const handleProjectSwitch = useCallback(async (id: number) => {
    if (id === currentProjectId) return;
    logger.debug(`Switching to project ID: ${id}`);
    setCurrentProjectId(id);
    saveState();
  }, [currentProjectId, saveState]);

  const handleLoadSampleData = useCallback(async () => {
    if (!currentProjectId) {
      showAlert("No Project", "Please create or select a project first.");
      return;
    }

    showConfirm(
      "Load Sample Files",
      "This will add sample files and folders to your current project. This action cannot be undone. Continue?",
      () => {
        logger.debug('Loading sample project data into current project.');
        const now = Date.now();
        const sampleFilesWithData = SAMPLE_PROJECT_DATA.files.map((f, i) => ({
          ...f,
          name: `sample/${f.name}`, // Put in a sub-folder
          id: now + i,
          projectId: currentProjectId,
          createdAt: now,
          modifiedAt: now,
        }));
        
        const existingNames = new Set(files.map(f => f.name));
        const conflicts = sampleFilesWithData.filter(f => existingNames.has(f.name));
        if (conflicts.length > 0) {
            showAlert("Action Canceled",`Could not add sample files. The following files already exist: ${conflicts.map(f => f.name).join(', ')}`);
            return;
        }

        const sampleDirPlaceholder: FileTab = {
            id: now - 1,
            projectId: currentProjectId,
            name: `sample/${PLACEHOLDER_FILENAME}`,
            content: '', language: 'placeholder', isBinary: true,
            createdAt: now, modifiedAt: now,
        };
        
        setFiles(prev => [...prev, sampleDirPlaceholder, ...sampleFilesWithData]);
        
        if (sampleFilesWithData.length > 0) {
            handleSelectFile(sampleFilesWithData[0].id);
        }
        
        showAlert('Success', 'Sample files added to your project.');
        saveState();
      }
    );
  }, [currentProjectId, files, saveState, handleSelectFile, showAlert, showConfirm]);

  const handleFormatCode = useCallback(async (formatterId: string) => {
    if (!activeFile || !currentProjectId || !activePaneId) return;
    logger.debug(`Formatting code with formatter: ${formatterId}`);
    try {
        let selection;
        const editor = editorRefs.current[activePaneId];
        if (formatterId === 'prettier_selection') {
            selection = editor?.getSelection();
            if (!selection || selection.start === selection.end) {
                showAlert("Format Selection", "Please select text to format.");
                return;
            }
        }
        const formattedCode = await formattingService.formatCode(activeFile.content, activeFile.language, formatterId, selection);
        handleContentChange(activeFile.id, formattedCode);
    } catch (error: any) {
        logger.error("Formatting failed:", error);
        showAlert("Formatting Failed", `Could not format the code. Please check for syntax errors.\n\nError: ${error.message}`);
    }
  }, [activeFile, currentProjectId, handleContentChange, activePaneId, showAlert]);

  const handleChangeCase = useCallback((caseType: 'upper' | 'lower' | 'title') => {
      if (!activePaneId) return;
      const selection = editorRefs.current[activePaneId]?.getSelection();
      if (!selection || !activeFile || selection.start === selection.end) return;
      
      logger.debug(`Changing case to: ${caseType}`);
      const changedText = formattingService.changeCase(selection.text, caseType);
      const newContent = activeFile.content.substring(0, selection.start) + changedText + activeFile.content.substring(selection.end);
      handleContentChange(activeFile.id, newContent, { start: selection.start, end: selection.start + changedText.length });
  }, [activeFile, handleContentChange, activePaneId]);

  const handleSidePanelResize = (delta: number) => {
      setSidePanel(prev => ({...prev, width: Math.max(200, prev.width - delta)}));
  };

  const toggleSidePanel = (mode: 'preview' | 'algo') => {
      logger.debug(`Toggling side panel to mode: ${mode}`);
      setSidePanel(prev => ({
          ...prev,
          mode: prev.mode === mode ? 'none' : mode,
      }));
  };
  
  const handleOpenVersionHistory = async () => {
    if (!activeFile || !currentProjectId) return;
    logger.debug(`Opening version history for file: ${activeFile.name}`);
    setFileVersions([]);
    setVersionHistoryModalOpen(true);
  };

  const handleRestoreVersion = (content: string) => {
    if (!activeFile) return;
    logger.debug(`Restoring version for file: ${activeFile.name}`);
    handleContentChange(activeFile.id, content);
    setVersionHistoryModalOpen(false);
  }
  
  const handleSplitPane = () => {
    if (!activePane) return;
    logger.debug('Splitting pane.');
    const newPane: EditorPane = { id: Date.now(), fileId: activePane.fileId };
    setPanes(prev => [...prev, newPane]);
    setActivePaneId(newPane.id);
  };

  const handleClosePane = (paneIdToClose: number) => {
    logger.debug(`Closing pane ID: ${paneIdToClose}`);
    setPanes(prev => {
        if (prev.length <= 1) return prev; // Don't close the last pane
        const newPanes = prev.filter(p => p.id !== paneIdToClose);
        if (activePaneId === paneIdToClose) {
            setActivePaneId(newPanes[0]?.id || null);
        }
        return newPanes;
    });
  };

  const handleExportProject = useCallback(async () => {
    if (!currentProjectId || !currentProject) return;
    logger.debug(`Exporting project: ${currentProject.name}`);
    const projectFiles = files.filter(f => f.projectId === currentProjectId);
    if (projectFiles.length === 0) {
      showAlert("Export Failed", "Project is empty. Nothing to export.");
      return;
    }

    const zipData: { [key: string]: Uint8Array } = {};
    const textEncoder = new TextEncoder();

    const dataUrlToUint8Array = (dataUrl: string) => {
        try {
            const base64String = dataUrl.split(',')[1];
            if (!base64String) return new Uint8Array(0);
            const binaryString = atob(base64String);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes;
        } catch (e) {
            logger.error("Failed to convert data URL to Uint8Array", e);
            return new Uint8Array(0);
        }
    };

    for (const file of projectFiles) {
        if (file.isBinary && file.content.startsWith('data:')) {
            const binaryData = dataUrlToUint8Array(file.content);
            if (binaryData.length > 0) {
                zipData[file.name] = binaryData;
            } else {
                logger.warn(`Skipping file ${file.name} due to processing error.`);
            }
        } else if (!file.isBinary) {
            zipData[file.name] = textEncoder.encode(file.content);
        }
    }
    
    const projectMeta = {
      name: currentProject.name,
      exportFormatVersion: '1.0',
      exportedAt: new Date().toISOString()
    };
    zipData['.motext/project.json'] = textEncoder.encode(JSON.stringify(projectMeta, null, 2));

    try {
        const zipped = fflate.zipSync(zipData);
        const zipBlob = new Blob([zipped], { type: "application/zip" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(zipBlob);
        link.download = `${currentProject.name.replace(/ /g, '_')}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    } catch(err) {
        logger.error("Failed to create ZIP file:", err);
        showAlert("Export Error", "An error occurred while creating the project ZIP file.");
    }
  }, [currentProjectId, currentProject, files, showAlert]);

  const handleImportZip = () => {
    logger.debug('Triggering file input for ZIP import.');
    zipInputRef.current?.click();
  }

  const handleZipFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    logger.debug(`Handling imported ZIP file: ${file.name}`);

    setInputDialogState({
      isOpen: true,
      title: 'Import Project',
      message: 'Enter a name for the new project:',
      initialValue: file.name.replace('.zip', ''),
      onSubmit: async (projectName) => {
        closeInputDialog();
        if (!projectName) return;

        const newProject = await addProject(projectName);
        const newProjectId = newProject.id;
        
        try {
            const buffer = await file.arrayBuffer();
            const zipData = new Uint8Array(buffer);
            const unzipped = fflate.unzipSync(zipData);
            const textDecoder = new TextDecoder();
            const newFiles: FileTab[] = [];

            for (const [relativePath, zipEntryData] of Object.entries(unzipped) as [string, Uint8Array][]) {
                 if (relativePath.endsWith('/')) continue;
                
                const extension = relativePath.split('.').pop()?.toLowerCase() || '';
                const isBinaryFile = IMAGE_EXTENSIONS.includes(extension) || PDF_EXTENSIONS.includes(extension) || DATA_EXTENSIONS.includes(extension);
                const isText = TEXT_EXTENSIONS.includes(extension);
                let content: string = '';
                let isBinary = true;
                let mimeType = 'application/octet-stream';

                if (isBinaryFile) {
                    mimeType = `application/${extension}`;
                    if (IMAGE_EXTENSIONS.includes(extension)) mimeType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
                    if (PDF_EXTENSIONS.includes(extension)) mimeType = 'application/pdf';
                    const blob = new Blob([zipEntryData], { type: mimeType });
                    content = await new Promise(resolve => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                } else if (isText) {
                    content = textDecoder.decode(zipEntryData);
                    isBinary = false;
                    mimeType = extension === 'svg' ? 'image/svg+xml' : 'text/plain';
                } else {
                    continue;
                }
                
                const now = Date.now();
                newFiles.push({
                    id: now + Math.random(), projectId: newProjectId, name: relativePath, content, language: extension,
                    isBinary, mimeType, createdAt: now, modifiedAt: now,
                });
            }
            
            setFiles(prev => [...prev, ...newFiles]);
            setCurrentProjectId(newProjectId);
            showAlert("Import Successful", `Project "${projectName}" imported successfully!`);
            saveState();

        } catch (error) {
            logger.error("Failed to import zip file:", error);
            showAlert("Import Failed", "An error occurred while importing the project. The file may be corrupt or not a valid ZIP file.");
        } finally {
            if(zipInputRef.current) zipInputRef.current.value = '';
        }
      },
    });
  }, [addProject, saveState, showAlert]);

  const handleExecuteExtension = (extensionId: string) => {
    logger.debug(`Executing extension: ${extensionId}`);
    const extension = extensionService.getExtensions().find(e => e.id === extensionId);
    if (extension) {
      const context: ExtensionContext = {
        activeFile,
        allFiles: files,
        showPasswordGenerator: () => setPasswordModalOpen(true),
        showPdfConverter: (file) => setPdfTargetFile(file),
      };
      extension.execute(context);
    }
  };

    // --- File Explorer Actions ---
    
  const handleFileContextMenu = (e: React.MouseEvent, type: 'file' | 'folder', id: number | string, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    setFileContextMenu({ x: e.clientX, y: e.clientY, targetId: id, targetType: type, path: path, visible: true });
  };

  const handleNewItemInExplorer = (type: 'file' | 'folder', basePath = '') => {
    const title = type === 'file' ? 'New File' : 'New Folder';
    const message = `Enter the name for the new ${type}:`;
    const initialValue = type === 'file' ? 'new-file.txt' : 'new-folder';

    setInputDialogState({
      isOpen: true,
      title,
      message,
      initialValue,
      onSubmit: async (name) => {
        if (!currentProjectId) return;
        const fullPath = (basePath ? `${basePath}/` : '') + name;
        
        if (filesForCurrentProject.some(f => f.name === fullPath || f.name.startsWith(`${fullPath}/`))) {
            showAlert("Create Failed", `A ${type} with that name already exists.`);
            return;
        }

        if (type === 'file') {
            await createNewFile(fullPath);
        } else {
            const now = Date.now();
            const placeholderFile: FileTab = {
                id: now, projectId: currentProjectId, name: `${fullPath}/${PLACEHOLDER_FILENAME}`, content: '',
                language: 'placeholder', isBinary: true, createdAt: now, modifiedAt: now,
            };
            logHistoryEvent('create_folder', `Folder '${fullPath}' created.`);
            setFiles(prev => [...prev, placeholderFile]);
            saveState();
        }
        closeInputDialog();
      }
    });
  };

  const handleDeleteFile = useCallback(async (fileId: number) => {
    if (!currentProjectId) return;
    const file = files.find(f => f.id === fileId);
    if (file) {
      showConfirm('Delete File', `Are you sure you want to delete ${file.name}?`, async () => {
        logger.debug(`Deleting file: ${file.name}`);
        await handleCloseFile(fileId); // Close it if open
        logHistoryEvent('delete', `File '${file.name}' deleted.`);
        setFiles(prev => prev.filter(f => f.id !== fileId));
        saveState();
      });
    }
  }, [currentProjectId, files, handleCloseFile, logHistoryEvent, saveState, showConfirm]);

  const handleDeleteFolder = useCallback(async (folderPath: string) => {
    if (!currentProjectId) return;
    showConfirm('Delete Folder', `Are you sure you want to delete the folder "${folderPath}" and all its contents?`, async () => {
      logger.debug(`Deleting folder: ${folderPath}`);
      const filesToDelete = filesForCurrentProject.filter(f => f.name === folderPath || f.name.startsWith(`${folderPath}/`));
      const deletedFileIds = filesToDelete.map(f => f.id);
      
      logHistoryEvent('delete_folder', `Folder '${folderPath}' deleted.`);
      setOpenFileIds(prev => prev.filter(id => !deletedFileIds.includes(id)));
      setFiles(prev => prev.filter(f => !deletedFileIds.includes(f.id)));
      saveState();
    });
  }, [currentProjectId, filesForCurrentProject, logHistoryEvent, saveState, showConfirm]);
  
  const handleRenameExplorerItem = (type: 'file' | 'folder', idOrPath: number | string, currentPath: string) => {
    const isFolder = type === 'folder';
    const oldName = currentPath.split('/').pop() || '';
    logger.debug(`Opening rename dialog for ${type}: ${oldName}`);

    setInputDialogState({
        isOpen: true,
        title: `Rename ${type}`,
        message: `Enter the new name for ${oldName}:`,
        initialValue: oldName,
        onSubmit: async (newName) => {
            if (!currentProjectId || newName === oldName) {
                closeInputDialog();
                return;
            }
            
            const basePath = currentPath.substring(0, currentPath.lastIndexOf('/'));
            const newPath = basePath ? `${basePath}/${newName}` : newName;
            const now = Date.now();

            if (isFolder) {
                logHistoryEvent('rename', `Folder '${currentPath}' renamed to '${newPath}'.`);
                setFiles(prev => prev.map(f => {
                    if (f.name.startsWith(`${currentPath}/`)) {
                        return { ...f, name: f.name.replace(currentPath, newPath), modifiedAt: now };
                    }
                    return f;
                }));
            } else {
                handleRenameFileCommit(idOrPath as number, newPath);
            }
            saveState();
            closeInputDialog();
        }
    });
  };

  const handleMoveItem = useCallback(async (sourcePath: string, destFolderPath: string) => {
    if (!currentProjectId) return;
    logger.debug(`Moving item from "${sourcePath}" to "${destFolderPath}"`);

    const sourceName = sourcePath.split('/').pop() || '';
    const newBasePath = destFolderPath ? `${destFolderPath}/${sourceName}` : sourceName;

    const collisionExists = filesForCurrentProject.some(f => f.name === newBasePath || (f.name.startsWith(newBasePath + '/') && f.name !== `${newBasePath}/${PLACEHOLDER_FILENAME}`));
    if (collisionExists) {
        showAlert("Move Failed", `An item named "${sourceName}" already exists in this location.`);
        return;
    }

    const isMovingFolder = filesForCurrentProject.some(f => f.name.startsWith(sourcePath + '/'));
    const now = Date.now();
    logHistoryEvent('move', `'${sourcePath}' moved to '${destFolderPath || 'root'}'.`);
    
    if (isMovingFolder) {
        setFiles(prev => prev.map(f => {
            if (f.projectId === currentProjectId && (f.name.startsWith(sourcePath + '/') || f.name.endsWith(`${sourcePath}/${PLACEHOLDER_FILENAME}`))) {
                const newName = f.name.replace(sourcePath, newBasePath);
                return { ...f, name: newName, modifiedAt: now };
            }
            return f;
        }));
    } else {
        setFiles(prev => prev.map(f => (f.projectId === currentProjectId && f.name === sourcePath) ? { ...f, name: newBasePath, modifiedAt: now } : f));
    }
    saveState();
  }, [currentProjectId, filesForCurrentProject, logHistoryEvent, saveState, showAlert]);

  const handleShowProperties = (path: string) => {
    logger.debug(`Showing properties for: ${path}`);
    setPropertiesModalState({ isOpen: true, targetPath: path });
  };

  const handleCreateSnapshot = useCallback(async (snapshotName: string) => {
    if (!currentProjectId || !snapshotName) return;
    logger.debug(`Creating snapshot: ${snapshotName}`);
    if (filesForCurrentProject.length === 0) {
        showAlert("Snapshot Failed", "Project is empty. Cannot create a snapshot.");
        return;
    }
    
    const snapshotData = filesForCurrentProject.filter(f => !f.isBinary && !f.name.endsWith(PLACEHOLDER_FILENAME));
    const snapshot: ProjectSnapshot = {
        id: Date.now(), name: snapshotName, data: snapshotData,
    };

    setProjectSnapshots(prev => [snapshot, ...prev].sort((a,b) => b.id - a.id));
    saveState();
  }, [currentProjectId, filesForCurrentProject, saveState, showAlert]);

  const handleDeleteSnapshot = useCallback(async (snapshotId: number) => {
    if (!currentProjectId) return;
    showConfirm("Delete Snapshot", "Are you sure you want to delete this snapshot? This action cannot be undone.", () => {
        logger.debug(`Deleting snapshot ID: ${snapshotId}`);
        setProjectSnapshots(prev => prev.filter(s => s.id !== snapshotId));
        saveState();
    });
  }, [currentProjectId, saveState, showConfirm]);

  const handleRestoreSnapshot = useCallback(async (snapshotId: number) => {
      if (!currentProjectId || !currentProject) return;
      const snapshot = projectSnapshots.find(s => s.id === snapshotId);
      if (!snapshot) {
          showAlert("Error", "Snapshot not found!");
          return;
      }
      logger.debug(`Restoring from snapshot: ${snapshot.name}`);

      const newProjectName = `${currentProject.name} (from ${snapshot.name})`;
      const newProject = await addProject(newProjectName);
      
      const newFiles = snapshot.data.map(fileData => {
          const now = Date.now();
          return {
              ...fileData, id: now + Math.random(), projectId: newProject.id, createdAt: now, modifiedAt: now, isDirty: false,
          };
      });
      
      setFiles(prev => [...prev, ...newFiles]);
      setCurrentProjectId(newProject.id);
      showAlert("Success", `Project restored successfully as "${newProjectName}". Switching to the new project.`);
      saveState();

  }, [currentProjectId, currentProject, addProject, projectSnapshots, saveState, showAlert]);

  const handleScanProjectFlow = useCallback(async () => {
    if (!currentProjectId) return;
    logger.debug('Starting shallow project scan.');
    setScanStatus({ isScanning: true, scanType: 'shallow', processed: 0, total: 0 });

    try {
        if (filesForCurrentProject.length === 0) {
            showAlert("Scan Canceled", "Project is empty. Nothing to scan.");
            return;
        }

        const report = await projectAnalysisService.analyzeProject(filesForCurrentProject, 
            ({ processed, total }) => setScanStatus({ isScanning: true, scanType: 'shallow', processed, total })
        );
        
        setAnalysisReport(report);
        setActiveView('analysis');

    } catch (error) {
        logger.error("Project scan failed:", error);
        showAlert("Scan Failed", "An error occurred during the project scan.");
    } finally {
        setScanStatus({ isScanning: false, scanType: 'shallow', processed: 0, total: 0 });
    }
  }, [currentProjectId, filesForCurrentProject, showAlert]);

  const handleDeepScanProject = useCallback(async () => {
    if (!currentProjectId) return;
    logger.debug('Starting deep project scan.');
    setScanStatus({ isScanning: true, scanType: 'deep', processed: 0, total: 0 });

    try {
         if (filesForCurrentProject.length === 0) {
            showAlert("Scan Canceled", "Project is empty. Nothing to scan.");
            return;
        }

        const report = await projectAnalysisService.analyzeProjectDeep(filesForCurrentProject);
        setDeepAnalysisReport(report);
        setActiveView('deepAnalysis');

    } catch (error) {
        logger.error("Project deep scan failed:", error);
        showAlert("Scan Failed", `An error occurred during the deep project scan: ${error}`);
    } finally {
        setScanStatus({ isScanning: false, scanType: 'deep', processed: 0, total: 0 });
    }
  }, [currentProjectId, filesForCurrentProject, showAlert]);

  const handleViewLastScan = useCallback(() => {
    if (analysisReport) {
        setActiveView('analysis');
    }
  }, [analysisReport]);

  const handleViewLastDeepScan = useCallback(() => {
    if (deepAnalysisReport) {
        setActiveView('deepAnalysis');
    }
  }, [deepAnalysisReport]);

  const handleFileLinkClick = useCallback((path: string) => {
    logger.debug(`Analysis viewer clicked file link: ${path}`);
    const fileToOpen = filesForCurrentProject.find(f => f.name === path);
    if (fileToOpen) {
        handleSelectFile(fileToOpen.id);
    } else {
        logger.warn(`File link clicked, but file not found in project: ${path}`);
        showAlert("File Not Found", `File not found: ${path}`);
    }
  }, [filesForCurrentProject, handleSelectFile, showAlert]);
  
  const handleSaveAnalysisReport = useCallback(async (markdownContent: string) => {
    if (!currentProjectId) return;
    logger.debug('Saving analysis report to file.');
    let counter = 1;
    let newFileName = `project-flow.algo`;
    while (filesForCurrentProject.some(file => file.name === newFileName)) {
        newFileName = `project-flow-${counter}.algo`;
        counter++;
    }
    await createNewFile(newFileName, markdownContent, 'algo');
    showAlert("Report Saved", `Report saved as ${newFileName}`);
  }, [currentProjectId, filesForCurrentProject, createNewFile, showAlert]);

  const handleSaveDeepAnalysisReport = useCallback(async () => {
    if (!currentProjectId || !deepAnalysisReport) return;
    logger.debug('Saving deep analysis report to file.');
    const reportContent = JSON.stringify(deepAnalysisReport, null, 2);
    let counter = 1;
    let newFileName = `detailed-report.algod`;
    while(filesForCurrentProject.some(f => f.name === newFileName)) {
        newFileName = `detailed-report-${counter}.algod`;
        counter++;
    }
    await createNewFile(newFileName, reportContent, 'algod');
    showAlert("Report Saved", `Report saved as ${newFileName}`);
  }, [currentProjectId, filesForCurrentProject, createNewFile, deepAnalysisReport, showAlert]);

  // --- Project Search ---
  const handleProjectSearch = useCallback((options: Omit<ProjectSearchState, 'results' | 'isActive' | 'isSearching'>) => {
      setProjectSearch(s => ({ ...s, ...options, isActive: true, isSearching: true, results: [] }));
      searchWorkerRef.current?.postMessage({ files: filesForCurrentProject, query: options.query, options });
  }, [filesForCurrentProject]);
  
  const handleClearSearch = useCallback(() => {
      setProjectSearch(s => ({ ...s, isActive: false, query: '', results: [] }));
  }, []);
  
  const handleSearchResultClick = useCallback((fileName: string, line: number) => {
      const file = filesForCurrentProject.find(f => f.name === fileName);
      if (!file) return;

      const activeEditorRef = editorRefs.current[activePaneId!];
      if (activeFile?.id === file.id && activeEditorRef) {
          activeEditorRef.goToLine(line);
      } else {
          handleSelectFile(file.id);
          setPendingNavigation({ fileId: file.id, line });
      }
  }, [filesForCurrentProject, activeFile, activePaneId, handleSelectFile]);

  useEffect(() => {
      if (pendingNavigation && activeFile?.id === pendingNavigation.fileId) {
          const activeEditorRef = editorRefs.current[activePaneId!];
          if (activeEditorRef) {
              setTimeout(() => {
                  activeEditorRef.goToLine(pendingNavigation.line);
                  setPendingNavigation(null);
              }, 100);
          }
      }
  }, [activeFile, pendingNavigation, activePaneId]);

    // --- Unit Testing ---
    const handleRunTests = useCallback(() => {
        const testFiles = filesForCurrentProject.filter(f => f.name.endsWith('.test.js') || f.name.endsWith('.spec.js'));
        if (testFiles.length === 0) {
            showAlert("No Tests Found", "No test files found in the project. Create files ending in '.test.js' or '.spec.js'.");
            return;
        }
        setIsTesting(true);
        setTestResults(null);
        testWorkerRef.current?.postMessage({ files: testFiles });
    }, [filesForCurrentProject, showAlert]);

    // --- Git Actions (Placeholders) ---
    const handleGitPull = () => {
        logger.info('Git Pull action triggered. Ready for browser integration.');
        showAlert('Git Pull', 'Git Pull functionality is handled by the host browser/extension.');
    };
    const handleGitPush = () => {
        logger.info('Git Push action triggered. Ready for browser integration.');
        showAlert('Git Push', 'Git Push functionality is handled by the host browser/extension.');
    };
    const handleGitCommit = (message: string) => {
        logger.info('Git Commit action triggered. Ready for browser integration.', { message });
        showAlert('Git Commit', `Git Commit functionality is handled by the host browser/extension.\nMessage: "${message}"`);
    };
    const handleGitRefresh = () => {
        logger.info('Git Refresh action triggered. Ready for browser integration.');
        showAlert('Git Refresh', 'Git Refresh functionality is handled by the host browser/extension.');
    };
    const handleGitConfig = () => {
        logger.info('Git Config action triggered. Ready for browser integration.');
        showAlert('Git Config', 'Git Configuration is handled by the host browser/extension.');
    };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod) {
        switch (e.key.toLowerCase()) {
          case 's': e.preventDefault(); handleSaveFile(); break;
          case 'n': e.preventDefault(); handleNewFile(); break;
          case 'o': e.preventDefault(); handleTriggerFileUpload(); break;
          case 'w': e.preventDefault(); activeFile?.id && handleCloseFile(activeFile.id); break;
          case 'f': e.preventDefault(); setFindState(s => ({ ...s, isVisible: !s.isVisible })); break;
          case 'h': e.preventDefault(); setFindState(s => ({ ...s, isVisible: true })); break;
          case 'k':
            e.preventDefault();
            const nextKeyHandler = (e2: KeyboardEvent) => {
              if (e2.key.toLowerCase() === 'v') toggleSidePanel('preview');
              if (e2.key.toLowerCase() === 'a') toggleSidePanel('algo');
              window.removeEventListener('keydown', nextKeyHandler, true);
            }
            window.addEventListener('keydown', nextKeyHandler, { capture: true, once: true });
            break;
        }
      }
      if (e.key === 'Escape') {
          if (findState.isVisible) {
              e.preventDefault();
              setFindState(s => ({...s, isVisible: false}));
          }
          if (projectSearch.isActive) {
              e.preventDefault();
              handleClearSearch();
          }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveFile, handleNewFile, activeFile, handleCloseFile, findState.isVisible, projectSearch.isActive, handleClearSearch, handleTriggerFileUpload]);

  const closeInputDialog = () => setInputDialogState(prev => ({ ...prev, isOpen: false }));
  
  const closeAllContextMenus = () => {
    if (contextMenu.visible) setContextMenu(prev => ({...prev, visible: false}));
    if (fileContextMenu.visible) setFileContextMenu(prev => ({...prev, visible: false}));
  }

  const renderMenus = () => (
    <>
      <Menu label="File" menuPosition={uiSettings.menuPosition}>
        <MenuItem onClick={handleNewFile} shortcut={`${modKey}N`}>New File</MenuItem>
        <MenuItem onClick={handleTriggerFileUpload} shortcut={`${modKey}O`}>Open Files...</MenuItem>
        <MenuItem onClick={handleImportZip}>Import Project from ZIP...</MenuItem>
        <MenuItem type="separator" />
        <MenuItem onClick={handleSaveFile} shortcut={`${modKey}S`} disabled={activeFile?.isBinary}>Save Version</MenuItem>
        <MenuItem onClick={handleExportProject} disabled={!currentProjectId}>Download Project as ZIP</MenuItem>
        <MenuItem onClick={handleOpenVersionHistory} disabled={!activeFile || activeFile.isBinary}>Version History</MenuItem>
        <MenuItem type="separator" />
        <MenuItem onClick={() => activeFile?.id && handleCloseFile(activeFile.id)} shortcut={`${modKey}W`} disabled={!activeFile?.id}>Close File</MenuItem>
      </Menu>
      <Menu label="Edit" menuPosition={uiSettings.menuPosition}>
        <MenuItem onClick={() => handleEditorCommand('cut')} shortcut={`${modKey}X`}>Cut</MenuItem>
        <MenuItem onClick={() => handleEditorCommand('copy')} shortcut={`${modKey}C`}>Copy</MenuItem>
        <MenuItem onClick={() => handleEditorCommand('paste')} shortcut={`${modKey}V`}>Paste</MenuItem>
        <MenuItem type="separator" />
        <MenuItem onClick={() => setFindState(s => ({...s, isVisible: true}))} shortcut={`${modKey}F`}>Find...</MenuItem>
        <MenuItem onClick={() => setFindState(s => ({...s, isVisible: true}))} shortcut={`${modKey}H`}>Replace...</MenuItem>
      </Menu>
       <Menu label="Project" menuPosition={uiSettings.menuPosition}>
        <MenuItem onClick={() => setProjectHubModalOpen(true)} disabled={!currentProjectId}>Project Hub</MenuItem>
        <MenuItem onClick={handleScanProjectFlow} disabled={!currentProjectId}>Scan Project Flow</MenuItem>
        <MenuItem onClick={handleDeepScanProject} disabled={!currentProjectId}>Deep Scan Project</MenuItem>
        <MenuItem onClick={handleRunTests} disabled={!currentProjectId || isTesting}>Run All Tests</MenuItem>
        <MenuItem type="separator" />
        <MenuItem onClick={handleViewLastScan} disabled={!analysisReport}>View Last Scan</MenuItem>
        <MenuItem onClick={handleViewLastDeepScan} disabled={!deepAnalysisReport}>View Last Deepscan</MenuItem>
      </Menu>
      <Menu label="Git" menuPosition={uiSettings.menuPosition}>
        <MenuItem onClick={handleGitPull} disabled={!currentProjectId}>Pull</MenuItem>
        <MenuItem onClick={handleGitPush} disabled={!currentProjectId}>Push</MenuItem>
        <MenuItem type="separator" />
        <MenuItem onClick={handleGitConfig} disabled={!currentProjectId}>Configure...</MenuItem>
      </Menu>
      <Menu label="View" menuPosition={uiSettings.menuPosition}>
        <MenuItem type="checkbox" checked={isExplorerVisible} onClick={() => setExplorerVisible(v => !v)}>Project Explorer</MenuItem>
        <MenuItem type="checkbox" checked={sidePanel.mode === 'preview'} onClick={() => toggleSidePanel('preview')} shortcut={`${modKey}K V`} disabled={!languageSupport?.isVisual}>Toggle Preview Panel</MenuItem>
        <MenuItem type="checkbox" checked={sidePanel.mode === 'algo'} onClick={() => toggleSidePanel('algo')} shortcut={`${modKey}K A`} disabled={!activeFile}>Toggle Algo Panel</MenuItem>
        <MenuItem type="separator" />
        <MenuItem onClick={handleSplitPane}>Split Pane</MenuItem>
        <MenuItem type="separator" />
        <MenuItem type="checkbox" checked={isWordWrapEnabled} onClick={() => setWordWrapEnabled(v => !v)}>Word Wrap</MenuItem>
        <MenuItem type="checkbox" checked={whitespaceVisibility === 'all'} onClick={() => setWhitespaceVisibility(v => v === 'all' ? 'none' : 'all')}>Show Invisibles</MenuItem>
        <MenuItem type="checkbox" checked={isStatusBarVisible} onClick={() => setStatusBarVisible(v => !v)}>Status Bar</MenuItem>
      </Menu>
      <Menu label="Language" menuPosition={uiSettings.menuPosition}>
        {getCommonLanguages().map(lang => (<MenuItem key={lang.id} type="checkbox" checked={activeFile?.language === lang.id} onClick={() => handleLanguageChange(lang.id)} disabled={!activeFile}>{lang.name}</MenuItem>))}
        <MenuItem type="separator" />
        <MenuItem onClick={() => setLanguageModalOpen(true)} disabled={!activeFile}>More Languages...</MenuItem>
      </Menu>
      <Menu label="Format" menuPosition={uiSettings.menuPosition}>
        {availableFormatters.some(f => f.id === 'prettier') && <MenuItem onClick={() => handleFormatCode('prettier')} disabled={!activeFile} shortcut={`Shift+Alt+F`}>Format Document</MenuItem>}
        {availableFormatters.some(f => f.id === 'prettier_selection') && <MenuItem onClick={() => handleFormatCode('prettier_selection')} disabled={!activeFile || editorState.selectionLength === 0}>Format Selection</MenuItem>}
        <MenuItem onClick={() => handleFormatCode('reindent')} disabled={!activeFile}>Re-indent Lines</MenuItem>
        <div className="relative group/submenu">
            <MenuItem className="justify-between" disabled={editorState.selectionLength === 0}>
                <span>Change Case</span><span className="text-xs">▶</span>
            </MenuItem>
            <div className="absolute left-full -top-1 w-48 py-1 bg-gray-700 border border-gray-600 rounded-md shadow-lg hidden group-hover/submenu:block">
                <MenuItem onClick={() => handleChangeCase('upper')}>UPPERCASE</MenuItem>
                <MenuItem onClick={() => handleChangeCase('lower')}>lowercase</MenuItem>
                <MenuItem onClick={() => handleChangeCase('title')}>Title Case</MenuItem>
            </div>
        </div>
        <MenuItem type="separator" />
        <MenuItem onClick={() => handleFormatCode('compress')} disabled={!activeFile}>Compress Empty Lines</MenuItem>
      </Menu>
      <Menu label="Extensions" menuPosition={uiSettings.menuPosition}>
        {extensionService.getExtensions().map(ext => (
          <MenuItem key={ext.id} onClick={() => handleExecuteExtension(ext.id)}>{ext.name}</MenuItem>
        ))}
      </Menu>
      <Menu label="Settings" menuPosition={uiSettings.menuPosition}>
        <MenuItem type="checkbox" checked={uiSettings.isAdvancedMode} onClick={() => handleSettingsChange({ isAdvancedMode: !uiSettings.isAdvancedMode })}>Advanced Snippets</MenuItem>
        <MenuItem type="checkbox" checked={uiSettings.isInlineSuggestionEnabled} onClick={() => handleSettingsChange({ isInlineSuggestionEnabled: !uiSettings.isInlineSuggestionEnabled })}>Inline Suggestions</MenuItem>
        <MenuItem type="checkbox" checked={uiSettings.isDebugModeEnabled} onClick={() => handleSettingsChange({ isDebugModeEnabled: !uiSettings.isDebugModeEnabled })}>Debug Mode</MenuItem>
        <MenuItem type="separator" />
        <MenuItem onClick={() => setSettingsModalOpen(true)}>All Settings...</MenuItem>
      </Menu>
      <Menu label="Help" menuPosition={uiSettings.menuPosition}>
        <MenuItem onClick={handleLoadSampleData}>Load Sample Files</MenuItem>
        <MenuItem type="separator" />
        <MenuItem onClick={() => setAboutModalOpen(true)}>About MoText</MenuItem>
      </Menu>
    </>
  );

  return (
    <div className="w-screen h-screen bg-gray-900 flex flex-row overflow-hidden" onClick={closeAllContextMenus}>
        {uiSettings.menuPosition === 'left' && (<div className="bg-gray-800 border-r border-gray-700 shrink-0 hidden md:block"><MenuBar orientation="vertical">{renderMenus()}</MenuBar></div>)}
        {isExplorerVisible && ( 
          <ProjectExplorer 
            projects={projects} 
            currentProject={currentProject} 
            files={filesForCurrentProject} 
            activeFileId={activeFile?.id ?? null}
            searchState={projectSearch}
            gitState={gitState}
            testState={{ results: testResults, isTesting: isTesting }}
            onRunTests={handleRunTests}
            onSearch={handleProjectSearch}
            onClearSearch={handleClearSearch}
            onSearchResultClick={handleSearchResultClick}
            onSelectFile={handleSelectFile} 
            onCreateProject={openCreateProjectDialog} 
            onSelectProject={handleProjectSwitch}
            onNewItem={handleNewItemInExplorer}
            onContextMenu={handleFileContextMenu}
            onMoveItem={handleMoveItem}
            onFileDrop={handleFileUploads}
            onOpenProjectHub={() => setProjectHubModalOpen(true)}
            onUploadClick={handleTriggerFileUpload}
            onGitCommit={handleGitCommit}
            onGitPush={handleGitPush}
            onGitPull={handleGitPull}
            onGitRefresh={handleGitRefresh}
          /> 
        )}
        
        <div className="flex flex-col flex-1 min-w-0 h-full">
            <header className="bg-gray-800 border-b border-gray-700 shrink-0 flex items-center pr-2">
                <button onClick={() => setExplorerVisible(v => !v)} className="p-2.5 hover:bg-gray-700 hidden md:block"><Icon name="folder" className="w-5 h-5" /></button>
                <div className="flex-1">
                    <div className="flex items-center justify-between p-2 md:hidden">
                        <button onClick={() => setMobileMenuOpen(true)}><Icon name="menu" className="w-6 h-6" /></button>
                        <h1 className="text-lg font-bold text-white">MoText</h1>
                        <button onClick={() => setExplorerVisible(v => !v)}><Icon name="folder" className="w-6 h-6" /></button>
                    </div>
                    {uiSettings.menuPosition === 'top' && (<div className="hidden px-1 md:block"><MenuBar orientation="horizontal">{renderMenus()}</MenuBar></div>)}
                </div>
            </header>
            
            <MobileMenu
              isOpen={isMobileMenuOpen}
              onClose={() => setMobileMenuOpen(false)}
              // File
              onNewFile={handleNewFile}
              onOpenFile={handleTriggerFileUpload}
              onSaveFile={handleSaveFile}
              onCloseFile={() => activeFile?.id && handleCloseFile(activeFile.id)}
              onImportZip={handleImportZip}
              onExportProject={handleExportProject}
              // Edit
              onEditorCommand={handleEditorCommand}
              onShowFindWidget={() => setFindState(s => ({...s, isVisible: true}))}
              // Project
              onOpenVersionHistory={handleOpenVersionHistory}
              onOpenProjectHub={() => setProjectHubModalOpen(true)}
              onScanProjectFlow={handleScanProjectFlow}
              onDeepScanProject={handleDeepScanProject}
              onRunTests={handleRunTests}
              onViewLastScan={handleViewLastScan}
              onViewLastDeepScan={handleViewLastDeepScan}
              // View
              isExplorerVisible={isExplorerVisible}
              onToggleExplorer={() => setExplorerVisible(v => !v)}
              isPreviewVisible={sidePanel.mode === 'preview'}
              onTogglePreview={() => toggleSidePanel('preview')}
              isAlgoVisible={sidePanel.mode === 'algo'}
              onToggleAlgo={() => toggleSidePanel('algo')}
              onSplitPane={handleSplitPane}
              isWordWrapEnabled={isWordWrapEnabled}
              onToggleWordWrap={() => setWordWrapEnabled(v => !v)}
              whitespaceVisibility={whitespaceVisibility}
              onToggleWhitespace={() => setWhitespaceVisibility(v => v === 'all' ? 'none' : 'all')}
              isStatusBarVisible={isStatusBarVisible}
              onToggleStatusBar={() => setStatusBarVisible(v => !v)}
              onOpenSettings={() => setSettingsModalOpen(true)}
              // Settings
              isAdvancedMode={uiSettings.isAdvancedMode}
              onToggleAdvancedMode={() => handleSettingsChange({ isAdvancedMode: !uiSettings.isAdvancedMode })}
              isInlineSuggestionEnabled={uiSettings.isInlineSuggestionEnabled}
              onToggleInlineSuggestions={() => handleSettingsChange({ isInlineSuggestionEnabled: !uiSettings.isInlineSuggestionEnabled })}
              isDebugModeEnabled={uiSettings.isDebugModeEnabled}
              onToggleDebugMode={() => handleSettingsChange({ isDebugModeEnabled: !uiSettings.isDebugModeEnabled })}
              // Language
              onSetLanguage={() => setLanguageModalOpen(true)}
              // Format
              availableFormatters={availableFormatters}
              onFormatCode={handleFormatCode}
              onChangeCase={handleChangeCase}
              // Help
              onLoadSampleData={handleLoadSampleData}
              onOpenAbout={() => setAboutModalOpen(true)}
              // Disable states
              canTogglePreview={!!languageSupport?.isVisual}
              canDoFileActions={!!activeFile}
              hasSelection={editorState.selectionLength > 0}
              hasScanReport={!!analysisReport}
              hasDeepScanReport={!!deepAnalysisReport}
            />

            <div className="flex flex-col flex-1 min-w-0 min-h-0 relative">
                <Toolbar onSave={handleSaveFile} onNewFile={handleNewFile} onSplitPane={handleSplitPane} />
                <TabBar
                    files={openTabsForCurrentProject}
                    activeFileId={activeFile?.id ?? null}
                    onSelectFile={handleSelectFile}
                    onCloseFile={handleCloseFile}
                    onNewFile={handleNewFile}
                    onContextMenu={handleTabContextMenu}
                    onPreviewClick={languageSupport?.isVisual ? () => toggleSidePanel('preview') : undefined}
                    isAnalysisVisible={!!analysisReport}
                    isDeepAnalysisVisible={!!deepAnalysisReport}
                    activeView={activeView}
                    onSelectAnalysis={() => setActiveView('analysis')}
                    onSelectDeepAnalysis={() => setActiveView('deepAnalysis')}
                />

                {findState.isVisible && activeFile && activePaneId && activeView === 'editor' && <FindWidget state={findState} onStateChange={setFindState} onFindNext={() => editorRefs.current[activePaneId]?.find(findState.searchTerm, findState)} onFindPrev={() => editorRefs.current[activePaneId]?.find(findState.searchTerm, {...findState, backwards: true})} onReplace={() => editorRefs.current[activePaneId]?.replace(findState.searchTerm, findState.replaceTerm, findState)} onReplaceAll={() => editorRefs.current[activePaneId]?.replaceAll(findState.searchTerm, findState.replaceTerm, findState)} onClose={() => setFindState(s => ({...s, isVisible: false}))} />}
                <div className="flex-1 flex overflow-hidden">
                    {activeView === 'analysis' && analysisReport ? (
                        <AnalysisViewer report={analysisReport} onFileLinkClick={handleFileLinkClick} onSaveReport={handleSaveAnalysisReport} />
                    ) : activeView === 'deepAnalysis' && deepAnalysisReport ? (
                        <DeepAnalysisViewer report={deepAnalysisReport} allFiles={filesForCurrentProject} onFileLinkClick={handleFileLinkClick} onSaveReport={handleSaveDeepAnalysisReport} />
                    ) : (
                         <main className="flex-1 flex overflow-hidden">
                            {panes.map((pane, index) => {
                                const fileForPane = files.find(f => f.id === pane.fileId);
                                return (
                                    <React.Fragment key={pane.id}>
                                        {index > 0 && <div className="w-1.5 h-full bg-gray-700 cursor-col-resize shrink-0" />}
                                        <div
                                            tabIndex={-1}
                                            className={`relative flex-1 min-w-0 ${pane.id === activePaneId ? 'focus:ring-2 focus:ring-blue-500' : ''}`}
                                            onClick={() => setActivePaneId(pane.id)}
                                        >
                                            {panes.length > 1 && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleClosePane(pane.id); }}
                                                    className="absolute top-2 right-2 z-10 p-1 rounded-full bg-gray-800/50 hover:bg-gray-700"
                                                    title="Close Pane"
                                                >
                                                    <Icon name="close" className="w-4 h-4" />
                                                </button>
                                            )}
                                            {fileForPane ? (
                                                IMAGE_EXTENSIONS.includes(fileForPane.language) ? (
                                                    <ImageViewer file={fileForPane} />
                                                ) : PDF_EXTENSIONS.includes(fileForPane.language) ? (
                                                    <PdfViewer file={fileForPane} />
                                                ) : DATA_EXTENSIONS.includes(fileForPane.language) ? (
                                                    <DataViewer file={fileForPane} />
                                                ) : fileForPane.language === 'algo' ? (
                                                    <AlgoViewer content={fileForPane.content} onFileLinkClick={handleFileLinkClick} />
                                                ) : fileForPane.language === 'algod' ? (
                                                    <DeepAnalysisViewer file={fileForPane} onFileLinkClick={handleFileLinkClick} onSaveReport={handleSaveDeepAnalysisReport} />
                                                ) : fileForPane.isBinary ? (
                                                    <BinaryFileViewer file={fileForPane} />
                                                ) : (
                                                    <MonacoEditor
                                                        ref={(el) => { if(el) editorRefs.current[pane.id] = el; }}
                                                        file={fileForPane}
                                                        onContentChange={handleContentChange}
                                                        onStateChange={pane.id === activePaneId ? setEditorState : noOpStateChange}
                                                        isWordWrapEnabled={isWordWrapEnabled}
                                                        whitespaceVisibility={whitespaceVisibility}
                                                    />
                                                )
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-gray-500">No file selected</div>
                                            )}
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                        </main>
                    )}

                    {sidePanel.mode !== 'none' && <DraggableResizer onResize={handleSidePanelResize} />}
                    {sidePanel.mode === 'preview' && activeFile && <div style={{ width: sidePanel.width }}><PreviewPanel content={debouncedPreviewContent} language={activeFile.language} onRefresh={handlePreviewRefresh} /></div>}
                    {sidePanel.mode === 'algo' && activeFile && <div style={{ width: sidePanel.width }}><AlgoPanel file={activeFile} allFiles={filesForCurrentProject} onFileLinkClick={handleFileLinkClick} /></div>}
                </div>
            </div>

            {isStatusBarVisible && activeFile && activeView === 'editor' && <StatusBar editorState={editorState} language={languageSupport?.name} />}
        </div>
        
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} multiple />
        <input ref={zipInputRef} type="file" accept=".zip" className="hidden" onChange={handleZipFileChange} />
        <ContextMenu x={contextMenu.x} y={contextMenu.y} visible={contextMenu.visible} onClose={() => setContextMenu({ ...contextMenu, visible: false })} onRename={() => {}} onCloseFile={() => handleCloseFile(contextMenu.fileId)} />
        <FileContextMenu
            {...fileContextMenu}
            onClose={() => setFileContextMenu(prev => ({...prev, visible: false}))}
            onNewFile={() => handleNewItemInExplorer('file', fileContextMenu.path)}
            onNewFolder={() => handleNewItemInExplorer('folder', fileContextMenu.path)}
            onDeleteFile={() => handleDeleteFile(fileContextMenu.targetId as number)}
            onDeleteFolder={() => handleDeleteFolder(fileContextMenu.path)}
            onRename={() => handleRenameExplorerItem(fileContextMenu.targetType, fileContextMenu.targetId, fileContextMenu.path)}
            onShowProperties={() => handleShowProperties(fileContextMenu.path)}
        />
        <LanguageModal isOpen={isLanguageModalOpen} onClose={() => setLanguageModalOpen(false)} onSelectLanguage={handleLanguageChange} activeLanguageId={activeFile?.language} />
        <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setSettingsModalOpen(false)} settings={uiSettings} onSettingsChange={handleSettingsChange} onLoadSampleData={() => { handleLoadSampleData(); setSettingsModalOpen(false); }} />
        <AboutModal isOpen={isAboutModalOpen} onClose={() => setAboutModalOpen(false)} />
        {activeFile && <VersionHistoryModal isOpen={isVersionHistoryModalOpen} onClose={() => setVersionHistoryModalOpen(false)} versions={fileVersions} onRestore={handleRestoreVersion} currentContent={activeFile.content} language={activeFile.language} />}
        <InputDialog
            isOpen={inputDialogState.isOpen}
            title={inputDialogState.title}
            message={inputDialogState.message}
            initialValue={inputDialogState.initialValue}
            onSubmit={inputDialogState.onSubmit}
            onClose={closeInputDialog}
        />
        <AlertDialog 
            isOpen={alertDialog.isOpen}
            title={alertDialog.title}
            message={alertDialog.message}
            onClose={() => setAlertDialog({ isOpen: false, title: '', message: '' })}
        />
        <ConfirmDialog
            isOpen={confirmDialog.isOpen}
            title={confirmDialog.title}
            message={confirmDialog.message}
            onConfirm={confirmDialog.onConfirm}
            onClose={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} })}
        />
        <PropertiesModal 
            isOpen={propertiesModalState.isOpen}
            onClose={() => setPropertiesModalState({ isOpen: false, targetPath: null })}
            targetPath={propertiesModalState.targetPath}
            allFiles={files}
        />
        <ProjectHubModal
            isOpen={isProjectHubModalOpen}
            onClose={() => setProjectHubModalOpen(false)}
            history={projectHistory}
            snapshots={projectSnapshots}
            onCreateSnapshot={handleCreateSnapshot}
            onDeleteSnapshot={handleDeleteSnapshot}
            onRestoreSnapshot={handleRestoreSnapshot}
            onScanProjectFlow={handleScanProjectFlow}
            onDeepScanProject={handleDeepScanProject}
        />
        <PasswordGeneratorModal isOpen={isPasswordModalOpen} onClose={() => setPasswordModalOpen(false)} />
        <PdfConverterModal file={pdfTargetFile} onClose={() => setPdfTargetFile(null)} />
        <ProcessingModal
            isOpen={scanStatus.isScanning}
            processed={scanStatus.processed}
            total={scanStatus.total}
            scanType={scanStatus.scanType}
        />
    </div>
  );
};

export default MoText;