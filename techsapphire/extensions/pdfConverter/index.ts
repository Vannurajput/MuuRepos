import { Extension } from '../types';

export const pdfConverter: Extension = {
    id: 'pdf-converter',
    name: 'Convert to PDF',
    description: 'Converts the current document to an encrypted PDF.',
    execute: (context) => {
        if (context.activeFile && !context.activeFile.isBinary) {
            context.showPdfConverter(context.activeFile);
        } else {
            alert('No active text file to convert.');
        }
    }
};
