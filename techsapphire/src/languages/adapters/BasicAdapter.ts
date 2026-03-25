import { LanguageSupport, LanguageAdapter, SuggestionContext } from "../../../types";

export class BasicAdapter implements LanguageAdapter {
    private languageSupport: LanguageSupport;

    constructor(languageSupport: LanguageSupport) {
        this.languageSupport = languageSupport;
    }

    async getSuggestions(context: SuggestionContext): Promise<string[]> {
        const { currentWord, textBeforeCursor } = context;

        const keywords = this.languageSupport.keywords || [];
        const textWords = textBeforeCursor.match(/\b(\w+)\b/g) || [];
        const uniqueWords = new Set([...keywords, ...textWords]);
        
        const suggestions = Array.from(uniqueWords)
            .filter(word => word.toLowerCase().startsWith(currentWord.toLowerCase()) && word.toLowerCase() !== currentWord.toLowerCase())
            .slice(0, 15);

        return Promise.resolve(suggestions);
    }
}