import { FileTab, ProjectAnalysisReport, FileAnalysis, DeepAnalysisReport, SymbolDefinition, CrossReference, DeepFileAnalysis } from '../types';

// This worker code is a string that will be turned into a Blob and then a Worker.
// It includes a self-contained version of the analysis logic.
const analysisWorkerCode = `
self.onmessage = (event) => {
    const { file, allFiles } = event.data;

    // --- Start of inlined codeAnalysisService ---
    const JS_IMPORT_REGEX = /(?:from|import).*?['"](.+?)['"]|require\\((['"](.+?)['"])\\)/g;
    const CSS_IMPORT_REGEX = /@import\\s*['"](.+?)['"]|url\\((['"]?(.+?)['"]?)\\)/g;
    const HTML_LINK_REGEX = /<link.+?href\\s*=\\s*['"](.+?)['"]/g;
    const HTML_SCRIPT_REGEX = /<script.+?src\\s*=\\s*['"](.+?)['"]/g;

    function resolvePath(basePath, relativePath) {
        const baseParts = basePath.split('/').slice(0, -1);
        if (relativePath.startsWith('/')) { return relativePath.substring(1); }
        const relativeParts = relativePath.split('/');
        for (const part of relativeParts) {
            if (part === '.') continue;
            if (part === '..') {
                if (baseParts.length > 0) baseParts.pop();
            } else { baseParts.push(part); }
        }
        return baseParts.join('/');
    }

    function getInternalReferences(file, allFiles) {
        const references = new Set();
        const allFileNames = new Set(allFiles.map(f => f.name));
        const addReference = (rawDep) => {
            if (!rawDep || /^(https?:|data:)/.test(rawDep)) return;
            const resolved = resolvePath(file.name, rawDep);
            if (allFileNames.has(resolved)) {
                references.add('[\`' + rawDep + '\`](motext://open-file/' + resolved + ')');
            }
        };
        const regexes = [JS_IMPORT_REGEX, CSS_IMPORT_REGEX, HTML_LINK_REGEX, HTML_SCRIPT_REGEX];
        regexes.forEach(regex => {
            regex.lastIndex = 0;
            let match;
            while ((match = regex.exec(file.content)) !== null) {
                addReference(match[1] || match[2] || match[3]);
            }
        });
        return Array.from(references);
    }
    
    const FUNCTION_REGEX = /(?:function\\s+([a-zA-Z0-9_$]+)\\s*\\((.*?)\\)|(?:const|let|var)\\s+([a-zA-Z0-9_$]+)\\s*=\\s*(?:async\\s*)?\\((.*?)\\)\\s*=>)/g;
    const CLASS_REGEX = /class\\s+([a-zA-Z0-9_$]+)/g;
    const VAR_REGEX = /(?:(const|let|var))\\s+([a-zA-Z0-9_$]+)\\s*=/g;
    const DOM_SELECTOR_REGEX = /\\.(getElementById|querySelector|querySelectorAll)\\s*\\(\\s*['"](.*?_?.*?)['"]\\s*\\)/g;
    const HTML_ELEMENT_REGEX = /<([a-zA-Z0-9-]+)[^>]*?(?:id|class)=['"][^>]*?>/g;
    const CSS_SELECTOR_REGEX = /(?:([.#])([a-zA-Z0-9_-]+)|@keyframes\\s+([a-zA-Z0-9_-]+))/g;


    const analyzeJavaScript = (code) => {
        const functions = [];
        const variables = [];
        const domSelectors = [];
        let match;
        while ((match = FUNCTION_REGEX.exec(code)) !== null) {
            functions.push({ name: match[1] || match[3], params: match[2] || match[4] || '', type: match[1] ? 'function' : 'arrow' });
        }
        while ((match = CLASS_REGEX.exec(code)) !== null) {
            variables.push({ name: match[1], type: 'class' });
        }
        while ((match = VAR_REGEX.exec(code)) !== null) {
            const lineEnd = code.substring(match.index, code.indexOf('\\n', match.index) || code.length);
            if (!lineEnd.includes('=>')) {
                variables.push({ name: match[2], type: match[1] });
            }
        }
        while ((match = DOM_SELECTOR_REGEX.exec(code)) !== null) {
            domSelectors.push({ method: match[1], selector: match[2] });
        }
        const lines = code.split('\\n');
        const summary = {
            totalLines: lines.length,
            charCount: code.length,
            commentLineCount: lines.filter(l => /^\\s*(\\/\\/|\\*|\\/\\*)/.test(l)).length,
            functionCount: functions.length,
            classCount: variables.filter(v => v.type === 'class').length,
            variableCount: variables.filter(v => v.type !== 'class').length,
            domSelectorCount: domSelectors.length,
            importCount: (code.match(/\\b(import|require)\\b/g) || []).length,
        };
        return { summary, functions, variables, domSelectors };
    };

    const analyzeHtml = (code) => {
        const htmlElements = [];
        let match;
        const tagRegex = /<([a-zA-Z0-9-]+)([^>]*)>/g;
        while((match = tagRegex.exec(code)) !== null) {
            const tag = match[1];
            const attributes = match[2];
            const idMatch = attributes.match(/id="([^"]+)"/);
            const classMatch = attributes.match(/class="([^"]+)"/);
            if (idMatch || classMatch) {
                htmlElements.push({ 
                    tag: tag, 
                    id: idMatch ? idMatch[1] : undefined,
                    classes: classMatch ? classMatch[1].split(' ') : undefined
                });
            }
        }
        const lines = code.split('\\n');
        const summary = {
            totalLines: lines.length,
            charCount: code.length,
            commentLineCount: lines.filter(l => /^\\s*<!--/.test(l)).length,
            htmlElementCount: (code.match(/</g) || []).length,
        };
        return { summary, htmlElements };
    };

    const analyzeCss = (code) => {
        const cssSelectors = [];
        let match;
        while((match = CSS_SELECTOR_REGEX.exec(code)) !== null) {
            if (match[3]) { cssSelectors.push({ type: 'animation', name: match[3] }); } 
            else if (match[1] === '#') { cssSelectors.push({ type: 'id', name: match[2] }); }
            else if (match[1] === '.') { cssSelectors.push({ type: 'class', name: match[2] }); }
        }
        const lines = code.split('\\n');
        const summary = {
            totalLines: lines.length,
            charCount: code.length,
            commentLineCount: lines.filter(l => /^\\s*\\/\\*/.test(l)).length,
            cssSelectorCount: cssSelectors.length,
        };
        return { summary, cssSelectors };
    };

    const analyzeCode = (file, allFiles) => {
        const lang = file.language.toLowerCase();
        const references = getInternalReferences(file, allFiles);
        let analysis;
        switch (lang) {
            case 'javascript': case 'typescript': case 'jsx': case 'tsx': analysis = analyzeJavaScript(file.content); break;
            case 'html': case 'xml': case 'svg': analysis = analyzeHtml(file.content); break;
            case 'css': case 'scss': analysis = analyzeCss(file.content); break;
            default:
                const lines = file.content.split('\\n');
                analysis = { summary: { totalLines: lines.length, charCount: file.content.length, commentLineCount: 0 }};
        }
        return { ...analysis, references };
    };
    // --- End of inlined codeAnalysisService ---

    try {
        const result = analyzeCode(file, allFiles);
        self.postMessage({ fileName: file.name, analysisResult: result });
    } catch(e) {
        self.postMessage({ 
            fileName: file.name, 
            analysisResult: { 
                summary: null, 
                references: [] 
            }
        });
    }
};
`;

export const analyzeProject = (files: FileTab[], onProgress: (progress: { processed: number, total: number }) => void): Promise<ProjectAnalysisReport> => {
    return new Promise(async (resolve, reject) => {
        const filesToAnalyze = files.filter(f => !f.name.endsWith('.placeholder') && f.language !== 'algo');
        if (filesToAnalyze.length === 0) {
            resolve({
                overviewMarkdown: "# Project Algorithm Flow Analysis (Heuristic)\n\nNo source code files were found to analyze.",
                fileAnalyses: []
            });
            return;
        }

        const total = filesToAnalyze.length;
        let processed = 0;
        onProgress({ processed, total });

        const analysisPromises = filesToAnalyze.map(file =>
            new Promise<FileAnalysis>((resolvePromise) => {
                const worker = new Worker(URL.createObjectURL(new Blob([analysisWorkerCode], { type: 'application/javascript' })));

                const timeoutId = setTimeout(() => {
                    worker.terminate();
                    processed++;
                    onProgress({ processed, total });
                    resolvePromise({
                        fileName: file.name,
                        analysisResult: { summary: null, references: [] }
                    });
                }, 5000);

                worker.onmessage = (e) => {
                    clearTimeout(timeoutId);
                    worker.terminate();
                    processed++;
                    onProgress({ processed, total });
                    resolvePromise(e.data);
                };

                worker.onerror = (_e) => {
                    clearTimeout(timeoutId);
                    worker.terminate();
                    processed++;
                    onProgress({ processed, total });
                    resolvePromise({
                        fileName: file.name,
                        analysisResult: { summary: { totalLines: 0, charCount: 0, commentLineCount: 0 }, references: [] }
                    });
                };

                worker.postMessage({ file, allFiles: files });
            })
        );

        try {
            const results = await Promise.all(analysisPromises);

            let overviewMarkdown = '# Project Algorithm Flow Analysis (Heuristic)\n\n';
            overviewMarkdown += `This document provides a high-level, auto-generated overview of the project structure. **Click on file names to open them.**\n\n`;

            const dependencyMap = new Map<string, string[]>();
            results.forEach(res => {
                if (res.analysisResult?.references) {
                    const deps = res.analysisResult.references.map(mdLink => {
                        const match = mdLink.match(/motext:\/\/open-file\/(.+?)\)/);
                        return match ? match[1] : '';
                    }).filter(Boolean);
                    dependencyMap.set(res.fileName, deps);
                }
            });

            overviewMarkdown += `## Project Dependency Graph\n\n`;
            let graphGenerated = false;
            dependencyMap.forEach((deps, fileName) => {
                if (deps.length > 0) {
                    graphGenerated = true;
                    overviewMarkdown += `**[\`${fileName}\`](motext://open-file/${fileName})** imports:\n`;
                    deps.forEach(dep => {
                        const cleanDepPath = dep.replace(/[`[]/g, '').split(']')[0];
                        overviewMarkdown += `- [\`${cleanDepPath}\`](motext://open-file/${cleanDepPath})\n`;
                    });
                    overviewMarkdown += '\n';
                }
            });
            if (!graphGenerated) {
                overviewMarkdown += 'No relative imports or script/stylesheet dependencies were detected between project files.\n\n';
            }

            overviewMarkdown += '---\n\n## All Files Summary\n\n';
            results.forEach(res => {
                overviewMarkdown += `- **[\`${res.fileName}\`](motext://open-file/${res.fileName})**: ${res.analysisResult?.summary?.totalLines || 'N/A'} lines\n`;
            });

            resolve({
                overviewMarkdown,
                fileAnalyses: results
            });
        } catch (error) {
            reject(error);
        }
    });
};

const getLineNumber = (content: string, index: number): number => {
    return content.substring(0, index).split('\n').length;
};

const extractFunctionBody = (content: string, startIndex: number): string | null => {
    let bodyStartIndex = -1;
    let braceLevel = 0;

    // Find the start of the function body (the first '{' after the signature)
    for (let i = startIndex; i < content.length; i++) {
        if (content[i] === '{') {
            bodyStartIndex = i;
            braceLevel = 1;
            break;
        }
        // If we hit a newline before a '{', it's likely a single-line arrow function without braces
        if (content[i] === '\n') {
            const restOfLine = content.substring(startIndex).split('\n')[0].trim();
            return restOfLine.endsWith(';') ? restOfLine.slice(0, -1) : restOfLine;
        }
    }

    if (bodyStartIndex === -1) {
        // Handle expression-body arrow functions e.g. `=> a + b`
        const restOfLine = content.substring(startIndex).split('\n')[0].trim();
        if (restOfLine) {
            return restOfLine.endsWith(';') ? restOfLine.slice(0, -1) : restOfLine;
        }
        return null;
    }

    // Find the matching closing brace
    for (let i = bodyStartIndex + 1; i < content.length; i++) {
        if (content[i] === '{') {
            braceLevel++;
        } else if (content[i] === '}') {
            braceLevel--;
            if (braceLevel === 0) {
                return content.substring(bodyStartIndex + 1, i).trim();
            }
        }
    }

    return null; // Unmatched brace
};

const JS_FUNCTION_REGEX = /(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/g;
const JS_CLASS_REGEX = /(?:export\s+)?class\s+([a-zA-Z0-9_$]+)/g;
const JS_VAR_REGEX = /(?:export\s+)?(const|let|var)\s+([a-zA-Z0-9_$]+)\s*=/g;
const JS_ARROW_VAR_REGEX = /(?:export\s+)?(const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async)?\s*\(.*?\)\s*=>/g;

const CSS_CLASS_REGEX = /\.([a-zA-Z0-9_-]+)/g;
const CSS_ID_REGEX = /#([a-zA-Z0-9_-]+)/g;
const CSS_KEYFRAMES_REGEX = /@keyframes\s+([a-zA-Z0-9_-]+)/g;

export const analyzeProjectDeep = (files: FileTab[]): Promise<DeepAnalysisReport> => {
    return new Promise((resolve, reject) => {
        const analysisPromise = new Promise<DeepAnalysisReport>(async (res) => {
            const symbolDefinitions: DeepAnalysisReport['symbolDefinitions'] = {};
            const symbolUsage: DeepAnalysisReport['symbolUsage'] = {};

            const summary: DeepAnalysisReport['summary'] = {
                totalFiles: files.length, jsFiles: 0, cssFiles: 0, htmlFiles: 0, otherFiles: 0, totalCrossReferences: 0,
            };

            const textFiles = files.filter(f => !f.isBinary && !f.name.endsWith('.placeholder') && f.language !== 'algo' && f.language !== 'algod');
            const jsFiles = textFiles.filter(f => ['javascript', 'typescript', 'jsx', 'tsx'].includes(f.language.toLowerCase()));
            const cssFiles = textFiles.filter(f => ['css', 'scss'].includes(f.language.toLowerCase()));
            const htmlFiles = textFiles.filter(f => ['html', 'xml', 'svg'].includes(f.language.toLowerCase()));
            summary.jsFiles = jsFiles.length;
            summary.cssFiles = cssFiles.length;
            summary.htmlFiles = htmlFiles.length;
            summary.otherFiles = textFiles.length - jsFiles.length - cssFiles.length - htmlFiles.length;

            // Phase 1: Find all definitions
            for (const file of jsFiles) {
                let match;
                JS_ARROW_VAR_REGEX.lastIndex = 0;
                while ((match = JS_ARROW_VAR_REGEX.exec(file.content)) !== null) {
                    const name = match[2];
                    const algorithm = extractFunctionBody(file.content, match.index + match[0].length);
                    if (name && !symbolDefinitions[name]) symbolDefinitions[name] = { file: file.name, line: getLineNumber(file.content, match.index), type: 'js', jsType: 'function', algorithm: algorithm || undefined };
                }
                JS_FUNCTION_REGEX.lastIndex = 0;
                while ((match = JS_FUNCTION_REGEX.exec(file.content)) !== null) {
                    const name = match[1];
                    const algorithm = extractFunctionBody(file.content, match.index + match[0].length);
                    if (name && !symbolDefinitions[name]) symbolDefinitions[name] = { file: file.name, line: getLineNumber(file.content, match.index), type: 'js', jsType: 'function', algorithm: algorithm || undefined };
                }
                JS_CLASS_REGEX.lastIndex = 0;
                while ((match = JS_CLASS_REGEX.exec(file.content)) !== null) {
                    const name = match[1];
                    if (name && !symbolDefinitions[name]) symbolDefinitions[name] = { file: file.name, line: getLineNumber(file.content, match.index), type: 'js', jsType: 'class' };
                }
                JS_VAR_REGEX.lastIndex = 0;
                while ((match = JS_VAR_REGEX.exec(file.content)) !== null) {
                    const name = match[2];
                    if (name && !symbolDefinitions[name]) symbolDefinitions[name] = { file: file.name, line: getLineNumber(file.content, match.index), type: 'js', jsType: match[1] as 'const' | 'let' | 'var' };
                }
            }
            for (const file of cssFiles) {
                let match;
                CSS_CLASS_REGEX.lastIndex = 0;
                while ((match = CSS_CLASS_REGEX.exec(file.content)) !== null) {
                    const name = match[1];
                    if (name && !symbolDefinitions[name]) symbolDefinitions[name] = { file: file.name, line: getLineNumber(file.content, match.index), type: 'css', jsType: 'class' };
                }
                CSS_ID_REGEX.lastIndex = 0;
                while ((match = CSS_ID_REGEX.exec(file.content)) !== null) {
                    const name = match[1];
                    if (name && !symbolDefinitions[name]) symbolDefinitions[name] = { file: file.name, line: getLineNumber(file.content, match.index), type: 'css', jsType: 'id' };
                }
                CSS_KEYFRAMES_REGEX.lastIndex = 0;
                while ((match = CSS_KEYFRAMES_REGEX.exec(file.content)) !== null) {
                    const name = match[1];
                    if (name && !symbolDefinitions[name]) symbolDefinitions[name] = { file: file.name, line: getLineNumber(file.content, match.index), type: 'css', jsType: 'animation' };
                }
            }

            const definedSymbols = Object.keys(symbolDefinitions);

            // Phase 2: Find all usages
            for (const file of textFiles) {
                for (const symbol of definedSymbols) {
                    const definition = symbolDefinitions[symbol];
                    if (file.name === definition.file) continue;

                    try {
                        const regex = new RegExp(`\\b${symbol}\\b`, 'g');
                        let match;
                        while ((match = regex.exec(file.content)) !== null) {
                            if (!symbolUsage[symbol]) symbolUsage[symbol] = [];
                            symbolUsage[symbol].push({ file: file.name, line: getLineNumber(file.content, match.index) });
                            summary.totalCrossReferences++;
                        }
                    } catch (e) {
                        console.warn(`Could not create regex for symbol: ${symbol}`);
                    }
                }
            }

            // Phase 3: Build file-by-file analysis
            const fileAnalyses: DeepFileAnalysis[] = textFiles.map(file => {
                const definitions: SymbolDefinition[] = [];
                for (const symbol in symbolDefinitions) {
                    if (symbolDefinitions[symbol].file === file.name) {
                        definitions.push({
                            symbol,
                            type: symbolDefinitions[symbol].jsType,
                            line: symbolDefinitions[symbol].line,
                            algorithm: symbolDefinitions[symbol].algorithm,
                        });
                    }
                }

                const usages: CrossReference[] = [];
                for (const symbol in symbolUsage) {
                    const definition = symbolDefinitions[symbol];
                    for (const use of symbolUsage[symbol]) {
                        if (use.file === file.name) {
                            usages.push({
                                sourceFile: file.name,
                                targetFile: definition.file,
                                symbol,
                                line: use.line
                            });
                        }
                    }
                }

                return { fileName: file.name, definitions, usages };
            });

            res({ summary, symbolUsage, symbolDefinitions, fileAnalyses });
        });

        // Timeout wrapper
        const timeout = new Promise<never>((_, rejectTimeout) =>
            setTimeout(() => rejectTimeout(new Error("Deep scan timed out after 10 seconds.")), 10000)
        );

        Promise.race([analysisPromise, timeout])
            .then(result => resolve(result as DeepAnalysisReport))
            .catch(err => reject(err));
    });
};