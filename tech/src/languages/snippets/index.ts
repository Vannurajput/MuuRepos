import { Snippet } from '../../../types';

const snippetLoaders: { [languageId: string]: () => Promise<{ snippets: Snippet[] }> } = {
    javascript: () => import('./javascript'),
    typescript: () => import('./javascript'), // Reuse JS snippets for TS for now
};

export const getSnippetsForLanguage = async (languageId: string): Promise<Snippet[]> => {
    const loader = snippetLoaders[languageId.toLowerCase()];
    if (loader) {
        try {
            const module = await loader();
            return module.snippets;
        } catch (e) {
            console.error(`Failed to load snippets for ${languageId}`, e);
            return [];
        }
    }
    return [];
};