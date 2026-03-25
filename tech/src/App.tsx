
import React, { useState, useEffect, useCallback } from 'react';
import MoText from './lib';
import type { MoTextState, FileTab } from './lib';
import { SAMPLE_PROJECT_DATA } from './lib/services/sampleData';
import { logger } from './lib/services/logger';

const APP_STORAGE_KEY = 'motext_app_data';

const App: React.FC = () => {
  const [data, setData] = useState<MoTextState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const savedData = localStorage.getItem(APP_STORAGE_KEY);
      if (savedData) {
        logger.debug('Loading data from localStorage.');
        let parsedData = JSON.parse(savedData);
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
        const sampleFilesWithIds = SAMPLE_PROJECT_DATA.files.map((f: any, i: number) => ({ ...f, id: sampleProjectId + i + 1, projectId: sampleProjectId, createdAt: Date.now(), modifiedAt: Date.now() }));
        const sample: MoTextState = {
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
            isAutoSaveEnabled: false, 
            previewMode: false, 
            isDebugModeEnabled: true 
          },
        };
        setData(sample);
      }
    } catch (error) {
        logger.error('Failed to load or parse data, using sample data.', error);
        setData(null); // Fallback to default in MoText
    } finally {
        setIsLoading(false);
    }
  }, []);

  const handleSave = useCallback((newData: MoTextState) => {
    try {
      const stateToSave = {
        ...newData,
      };
      localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(stateToSave));
      logger.debug('Host app saved state to localStorage.');
    } catch (error) {
      logger.error('Failed to save state to localStorage.', error);
    }
  }, []);

  if (isLoading) {
    return (
        <div className="w-screen h-screen bg-gray-900 flex items-center justify-center text-gray-400">
            Loading Editor...
        </div>
    );
  }

  return <MoText initialData={data!} onSave={handleSave} />;
};

export default App;
