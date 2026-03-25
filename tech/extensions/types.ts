import { FileTab } from '../types';

export interface ExtensionContext {
    activeFile?: FileTab;
    allFiles?: FileTab[];
    showPasswordGenerator: () => void;
    showPdfConverter: (file: FileTab) => void;
}

export interface Extension {
    id: string;
    name: string;
    description: string;
    execute: (context: ExtensionContext) => void;
}
