import { LanguageSupport, LanguageAdapter, SuggestionContext, Snippet } from "../../../types";
import { getSnippetsForLanguage } from '../snippets';

export class AdvancedAdapter implements LanguageAdapter {
    private languageSupport: LanguageSupport;
    private snippets: Snippet[] | null = null;

    constructor(languageSupport: LanguageSupport) {
        this.languageSupport = languageSupport;
        this.loadSnippets();
    }

    private async loadSnippets() {
        this.snippets = await getSnippetsForLanguage(this.languageSupport.id);
    }

    async getSuggestions(context: SuggestionContext): Promise<Snippet[]> {
        const { currentWord } = context;
        
        if (!this.snippets) {
            await this.loadSnippets();
        }

        if (!this.snippets || this.snippets.length === 0) {
            return [];
        }
        
        const suggestions = this.snippets
            .filter(snippet => snippet.label.toLowerCase().startsWith(currentWord.toLowerCase()))
            .slice(0, 10);

        return Promise.resolve(suggestions);
    }
}