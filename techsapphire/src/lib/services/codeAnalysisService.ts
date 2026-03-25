import { FileTab, AnalysisResult, CodeSummary, FunctionDetail, VariableDetail, DomSelector, CssSelector, HtmlElement } from '../types';
// Re-export types so other modules can import them from this service.
export type { AnalysisResult, CodeSummary, FunctionDetail, VariableDetail, DomSelector, CssSelector, HtmlElement };

// --- Dependency Extraction Logic ---

const JS_IMPORT_REGEX = /(?:from|import).*?['"](.+?)['"]|require\(['"](.+?)['"]\)/g;
const CSS_IMPORT_REGEX = /@import\s*['"](.+?)['"]|url\(['"]?(.+?)['"]?\)/g;
const HTML_LINK_REGEX = /<link.+?href\s*=\s*['"](.+?)['"]/g;
const HTML_SCRIPT_REGEX = /<script.+?src\s*=\s*['"](.+?)['"]/g;

function resolvePath(basePath: string, relativePath: string): string {
    const baseParts = basePath.split('/').slice(0, -1);
    if (relativePath.startsWith('/')) {
        return relativePath.substring(1);
    }
    const relativeParts = relativePath.split('/');

    for (const part of relativeParts) {
        if (part === '.') continue;
        if (part === '..') {
            if (baseParts.length > 0) baseParts.pop();
        } else {
            baseParts.push(part);
        }
    }
    return baseParts.join('/');
}

function getInternalReferences(file: FileTab, allFiles: FileTab[]): string[] {
    const references = new Set<string>();
    const allFileNames = new Set(allFiles.map(f => f.name));
    
    const addReference = (rawDep: string) => {
        if (!rawDep || /^(https?:|data:)/.test(rawDep)) return;
        const resolved = resolvePath(file.name, rawDep);
        if (allFileNames.has(resolved)) {
            references.add(`[\`${rawDep}\`](motext://open-file/${resolved})`);
        }
    }

    const regexes = [JS_IMPORT_REGEX, CSS_IMPORT_REGEX, HTML_LINK_REGEX, HTML_SCRIPT_REGEX];
    regexes.forEach(regex => {
        regex.lastIndex = 0; // Reset regex state for global flag
        let match;
        while ((match = regex.exec(file.content)) !== null) {
            addReference(match[1] || match[2]);
        }
    });
    
    return Array.from(references);
}


// --- Heuristic Analysis Logic ---

const FUNCTION_REGEX = /(?:function\s+([a-zA-Z0-9_$]+)\s*\((.*?)\)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\((.*?)\)\s*=>)/g;
const CLASS_REGEX = /class\s+([a-zA-Z0-9_$]+)/g;
const VAR_REGEX = /(?:(const|let|var))\s+([a-zA-Z0-9_$]+)\s*=/g;
const DOM_SELECTOR_REGEX = /\.(getElementById|querySelector|querySelectorAll)\s*\(\s*['"](.*?_?.*?)['"]\s*\)/g;
const ADD_EVENT_LISTENER_REGEX = /\.addEventListener\s*\(\s*['"](.+?)['"]\s*,/g;

const analyzeJavaScript = (code: string): Omit<AnalysisResult, 'references'> => {
    const functions: FunctionDetail[] = [];
    const variables: VariableDetail[] = [];
    const domSelectors: DomSelector[] = [];
    const eventListeners: string[] = [];

    let match;
    while ((match = FUNCTION_REGEX.exec(code)) !== null) {
        functions.push({
            name: match[1] || match[3],
            params: match[2] || match[4] || '',
            type: match[1] ? 'function' : 'arrow',
        });
    }

    while ((match = CLASS_REGEX.exec(code)) !== null) {
        variables.push({ name: match[1], type: 'class' });
    }

    while ((match = VAR_REGEX.exec(code)) !== null) {
        // Avoid capturing arrow functions as simple variables
        const lineEnd = code.substring(match.index, code.indexOf('\n', match.index) || code.length);
        if (!lineEnd.includes('=>')) {
            variables.push({ name: match[2], type: match[1] as 'const' | 'let' | 'var' });
        }
    }

    while ((match = DOM_SELECTOR_REGEX.exec(code)) !== null) {
        domSelectors.push({
            method: match[1] as 'getElementById' | 'querySelector' | 'querySelectorAll',
            selector: match[2]
        });
    }
    
    while ((match = ADD_EVENT_LISTENER_REGEX.exec(code)) !== null) {
        eventListeners.push(match[1]);
    }

    const lines = code.split('\n');
    const summary: CodeSummary = {
        totalLines: lines.length,
        charCount: code.length,
        commentLineCount: lines.filter(l => /^\s*(\/\/|\*|\/\*)/.test(l)).length,
        functionCount: functions.length,
        classCount: variables.filter(v => v.type === 'class').length,
        variableCount: variables.filter(v => v.type !== 'class').length,
        domSelectorCount: domSelectors.length + eventListeners.length,
        importCount: (code.match(/\b(import|require)\b/g) || []).length,
    };

    return { summary, functions, variables, domSelectors };
};

const HTML_ELEMENT_REGEX = /<([a-zA-Z0-9-]+)\s+.*?(?:id|class)\s*=\s*['"](.*?)['"]/g;
const CSS_SELECTOR_REGEX = /(?:([.#])([a-zA-Z0-9_-]+)|@keyframes\s+([a-zA-Z0-9_-]+))/g;

const analyzeHtml = (code: string): Omit<AnalysisResult, 'references'> => {
    const htmlElements: HtmlElement[] = [];
    let match;
    while((match = HTML_ELEMENT_REGEX.exec(code)) !== null) {
        // This regex is imperfect and will need refinement, but it's a start.
        // It captures a tag and the *first* id or class value.
        const tag = match[1];
        // A better approach would be to parse attributes properly.
        // For now, this gives a heuristic view.
        htmlElements.push({ tag });
    }
    const lines = code.split('\n');
    const summary: CodeSummary = {
        totalLines: lines.length,
        charCount: code.length,
        commentLineCount: lines.filter(l => /^\s*<!--/.test(l)).length,
        htmlElementCount: (code.match(/</g) || []).length,
    }
    return { summary, htmlElements };
}

const analyzeCss = (code: string): Omit<AnalysisResult, 'references'> => {
    const cssSelectors: CssSelector[] = [];
    let match;
    while((match = CSS_SELECTOR_REGEX.exec(code)) !== null) {
        if (match[3]) { // @keyframes
            cssSelectors.push({ type: 'animation', name: match[3] });
        } else if (match[1] === '#') {
            cssSelectors.push({ type: 'id', name: match[2] });
        } else if (match[1] === '.') {
            cssSelectors.push({ type: 'class', name: match[2] });
        }
    }
    const lines = code.split('\n');
    const summary: CodeSummary = {
        totalLines: lines.length,
        charCount: code.length,
        commentLineCount: lines.filter(l => /^\s*\/\*/.test(l)).length,
        cssSelectorCount: cssSelectors.length,
    }
    return { summary, cssSelectors };
}

export const analyzeCode = (file: FileTab, allFiles: FileTab[]): AnalysisResult => {
    const lang = file.language.toLowerCase();
    const references = getInternalReferences(file, allFiles);
    let analysis: Omit<AnalysisResult, 'references'>;
    
    switch (lang) {
        case 'javascript':
        case 'typescript':
        case 'jsx':
        case 'tsx':
            analysis = analyzeJavaScript(file.content);
            break;

        case 'html':
        case 'xml':
        case 'svg':
            analysis = analyzeHtml(file.content);
            break;
            
        case 'css':
        case 'scss':
            analysis = analyzeCss(file.content);
            break;

        default:
            const lines = file.content.split('\n');
            analysis = {
                summary: {
                    totalLines: lines.length,
                    charCount: file.content.length,
                    commentLineCount: 0,
                }
            };
    }

    return { ...analysis, references };
};
