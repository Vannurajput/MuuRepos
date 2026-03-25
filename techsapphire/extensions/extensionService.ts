import { Extension } from './types';
import { passwordGenerator } from './passwordGenerator';
import { pdfConverter } from './pdfConverter';

const extensions: Extension[] = [
    passwordGenerator,
    pdfConverter,
];

export const getExtensions = (): Extension[] => {
    return extensions;
};
