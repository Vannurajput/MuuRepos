import * as indentationService from '@services/indentationService';

const PRETTIER_SUPPORTED_LANGUAGES: { [langId: string]: string } = {
    javascript: 'babel',
    typescript: 'babel-ts',
    jsx: 'babel',
    tsx: 'babel-ts',
    css: 'css',
    scss: 'scss',
    html: 'html',
    json: 'json',
    markdown: 'markdown',
};

const getPrettierParser = (languageId: string): string | null => {
    return PRETTIER_SUPPORTED_LANGUAGES[languageId.toLowerCase()] || null;
}

export const getAvailableFormatters = (languageId: string): { id: string, name: string }[] => {
    const formatters: { id: string, name: string }[] = [];

    if (getPrettierParser(languageId)) {
        formatters.push({ id: 'prettier', name: 'Format Document' });
        formatters.push({ id: 'prettier_selection', name: 'Format Selection' });
    }
    formatters.push({ id: 'reindent', name: 'Re-indent Lines' });
    formatters.push({ id: 'compress', name: 'Compress Empty Lines' });

    return formatters;
};

const formatWithPrettier = async (code: string, parser: string, selection?: { start: number, end: number }): Promise<string> => {
    if (!window.prettier || !window.prettierPlugins) {
        throw new Error("Prettier is not loaded.");
    }
    // @ts-ignore
    return window.prettier.format(code, {
        parser: parser,
        plugins: window.prettierPlugins,
        rangeStart: selection?.start,
        rangeEnd: selection?.end,
    });
};

const compressCode = (code: string): string => {
    return code.replace(/^\s*[\r\n]/gm, '');
};

export const changeCase = (text: string, caseType: 'upper' | 'lower' | 'title'): string => {
    switch (caseType) {
        case 'upper':
            return text.toUpperCase();
        case 'lower':
            return text.toLowerCase();
        case 'title':
            return text.replace(/\b\w/g, char => char.toUpperCase());
        default:
            return text;
    }
}

export const formatCode = async (code: string, languageId: string, formatterId: string, selection?: { start: number, end: number }): Promise<string> => {
    switch (formatterId) {
        case 'compress':
            return Promise.resolve(compressCode(code));
        case 'reindent':
            return Promise.resolve(indentationService.reindent(code, languageId));
        case 'prettier':
            const parser = getPrettierParser(languageId);
            if (parser) {
                return await formatWithPrettier(code, parser);
            }
            throw new Error(`Prettier does not support language: ${languageId}`);
        case 'prettier_selection':
            const selectionParser = getPrettierParser(languageId);
            if (selectionParser && selection) {
                return await formatWithPrettier(code, selectionParser, selection);
            }
            throw new Error(`Prettier does not support language: ${languageId} or selection is missing.`);
        default:
            throw new Error(`Unknown formatter: ${formatterId}`);
    }
};
