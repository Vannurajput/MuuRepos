import { LanguageSupport, LanguageAdapter } from "../../types";
import { BasicAdapter } from './BasicAdapter';
import { AdvancedAdapter } from './AdvancedAdapter';

export const createAdapter = (languageSupport: LanguageSupport, isAdvanced: boolean): LanguageAdapter => {
    if (isAdvanced) {
        return new AdvancedAdapter(languageSupport);
    }
    return new BasicAdapter(languageSupport);
}
