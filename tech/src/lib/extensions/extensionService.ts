import { Extension } from './types';
import { passwordGenerator } from '@/extensions/passwordGenerator';
import { pdfConverter } from '@/extensions/pdfConverter';

const extensions: Extension[] = [
    passwordGenerator,
    pdfConverter,
];

export const getExtensions = (): Extension[] => {
    return extensions;
};
