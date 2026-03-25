import { LanguageSupport } from "../types";
import { javascript } from './javascript';
import { python } from './python';
import { html } from './html';
import { css } from './css';
import { csharp } from './csharp';
import { java } from './java';
import { c } from './c';
import { cpp } from './cpp';
import { ruby } from './ruby';
import { php } from './php';
import { go } from './go';
import { rust } from './rust';
import { sql } from './sql';
import { svg } from './svg';
import { typescript } from './typescript';
import { swift } from './swift';
import { kotlin } from './kotlin';
import { shell } from './shell';
import { markdown } from './markdown';
import { xml } from './xml';
import { algo } from './algo';
import { algod } from "./algod";


const languages: LanguageSupport[] = [
    javascript,
    python,
    html,
    css,
    markdown,
    xml,
    csharp,
    java,
    c,
    cpp,
    ruby,
    php,
    go,
    rust,
    sql,
    svg,
    typescript,
    swift,
    kotlin,
    shell,
    algo,
    algod,
];

const plainTextSupport: LanguageSupport = {
    id: 'plaintext',
    name: 'Plain Text',
};

const languageMap = new Map<string, LanguageSupport>();
languages.forEach(lang => {
    languageMap.set(lang.id.toLowerCase(), lang);
    lang.aliases?.forEach(alias => {
        languageMap.set(alias.toLowerCase(), lang);
    });
});

export const getLanguageSupport = (languageId: string): LanguageSupport => {
    return languageMap.get(languageId.toLowerCase()) || plainTextSupport;
};

export const getSupportedLanguages = (): LanguageSupport[] => {
    return [plainTextSupport, ...languages];
};

export const getCommonLanguages = (): LanguageSupport[] => {
    const commonIds = ['html', 'css', 'javascript', 'python', 'markdown', 'xml', 'sql', 'java', 'csharp', 'c', 'cpp', 'php'];
    return commonIds.map(id => languageMap.get(id)).filter(Boolean) as LanguageSupport[];
}
