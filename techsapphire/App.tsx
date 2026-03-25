import React, { useState, useEffect, useCallback, useRef } from 'react';
import MoText from './MoText';
import { SAMPLE_PROJECT_DATA } from './services/sampleData';
import { logger } from './services/logger';
import { FileTab } from './types';
import * as storage from './services/indexedDBService';

const APP_STORAGE_KEY = 'motext_app_data';
const AUTOSAVE_INTERVAL_MS = 30000; // Autosave every 30 seconds

const App: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const pendingDataRef = useRef<any>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load data from IndexedDB on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedData = await storage.loadState<any>(APP_STORAGE_KEY);

        if (savedData) {
          logger.debug('Loading data from IndexedDB.');
          let parsedData = savedData;

          // MIGRATION: Ensure files have a projectId
          if (parsedData.files && parsedData.files.length > 0 && parsedData.files[0].projectId === undefined) {
            const defaultProjectId = parsedData.projects?.[0]?.id ?? 1;
            logger.debug(`Migrating old data: assigning projectId ${defaultProjectId} to all files.`);
            parsedData.files.forEach((f: FileTab) => f.projectId = defaultProjectId);
          }
          setData(parsedData);
        } else {
          logger.debug('No saved data found, loading sample project.');
          const sampleProjectId = Date.now();
          const sampleFilesWithIds = SAMPLE_PROJECT_DATA.files.map((f, i) => ({
            ...f,
            id: sampleProjectId + i + 1,
            projectId: sampleProjectId,
            createdAt: Date.now(),
            modifiedAt: Date.now()
          }));
          const sample = {
            projects: [{ id: sampleProjectId, name: SAMPLE_PROJECT_DATA.projectName }],
            files: sampleFilesWithIds,
            activeProjectId: sampleProjectId,
            history: [],
            snapshots: [],
            openFileIds: sampleFilesWithIds.length > 0 ? [sampleFilesWithIds[0].id] : [],
            uiSettings: {
              menuPosition: 'top',
              isAdvancedMode: false,
              isInlineSuggestionEnabled: true,
              isAutoSaveEnabled: true,  // Enable autosave by default
              previewMode: false,
              isDebugModeEnabled: true
            },
          };
          setData(sample);
          // Save sample data to IndexedDB
          await storage.saveState(APP_STORAGE_KEY, sample);
        }

        // Request persistent storage
        const isPersistent = await storage.requestPersistentStorage();
        logger.debug(`Persistent storage: ${isPersistent ? 'granted' : 'not granted'}`);

      } catch (error) {
        logger.error('Failed to load data from IndexedDB, using sample data.', error);
        setData(null); // Fallback to default in MoText
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Cleanup autosave timer on unmount
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  // Debounced save to IndexedDB
  const handleSave = useCallback(async (newData: any) => {
    pendingDataRef.current = newData;

    // Clear existing timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    // Save immediately but debounce rapid saves
    const performSave = async () => {
      if (!pendingDataRef.current) return;

      setIsSaving(true);
      try {
        await storage.saveState(APP_STORAGE_KEY, pendingDataRef.current);
        logger.debug('Saved state to IndexedDB.');
      } catch (error) {
        logger.error('Failed to save state to IndexedDB.', error);
      } finally {
        setIsSaving(false);
      }
    };

    // Immediate save for first call, then debounce
    await performSave();

    // Set up autosave for next interval
    autosaveTimerRef.current = setTimeout(() => {
      if (pendingDataRef.current) {
        performSave();
      }
    }, AUTOSAVE_INTERVAL_MS);
  }, []);

  // Warn user about unsaved changes before leaving
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSaving || pendingDataRef.current) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSaving]);

  if (isLoading) {
    return (
      <div className="w-screen h-screen bg-gray-900 flex items-center justify-center text-gray-400">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span>Loading Editor...</span>
        </div>
      </div>
    );
  }

  return <MoText initialData={data} onSave={handleSave} />;
};

export default App;