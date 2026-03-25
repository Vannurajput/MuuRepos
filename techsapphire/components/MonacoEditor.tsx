import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { FileTab, EditorState, WhitespaceVisibility } from '../types';
import { getLanguageSupport } from '../src/languages';

interface MonacoEditorProps {
    file: FileTab;
    onContentChange: (id: number, content: string) => void;
    onStateChange: (state: EditorState) => void;
    isWordWrapEnabled: boolean;
    whitespaceVisibility: WhitespaceVisibility;
}

export interface EditorRef {
    find: (term: string, options: { isCaseSensitive: boolean, isWholeWord: boolean, isRegex: boolean, backwards?: boolean }) => boolean;
    replace: (searchTerm: string, replaceTerm: string, options: { isCaseSensitive: boolean, isWholeWord: boolean, isRegex: boolean }) => boolean;
    replaceAll: (searchTerm: string, replaceTerm: string, options: { isCaseSensitive: boolean, isWholeWord: boolean, isRegex: boolean }) => void;
    getSelection: () => { start: number, end: number, text: string } | null;
    goToLine: (lineNumber: number) => void;
}

const getMonacoLang = (lang: string) => {
    const langSupport = getLanguageSupport(lang);
    const id = langSupport.id.toLowerCase();
    const mapping: { [key: string]: string } = {
        javascript: 'javascript', typescript: 'typescript', html: 'html', css: 'css', python: 'python', csharp: 'csharp',
        java: 'java', c: 'c', cpp: 'cpp', ruby: 'ruby', php: 'php', go: 'go', rust: 'rust', sql: 'sql',
        markdown: 'markdown', shell: 'shell', svg: 'xml', json: 'json', xml: 'xml',
    };
    return mapping[id] || 'plaintext';
}

const MonacoEditor = forwardRef<EditorRef, MonacoEditorProps>(({ file, onContentChange, onStateChange, isWordWrapEnabled, whitespaceVisibility }, ref) => {
    const editorRef = useRef<any>(null); // monaco.editor.IStandaloneCodeEditor
    const containerRef = useRef<HTMLDivElement>(null);
    const monacoInstanceRef = useRef<any>(null);
    const contentChangeSubscriptionRef = useRef<any>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const initMonaco = () => {
            const monaco = (window as any).monaco;
            if (!monaco || !container) return;
            monacoInstanceRef.current = monaco;

            editorRef.current = monaco.editor.create(container, {
                theme: 'vs-dark',
                automaticLayout: true,
                minimap: { enabled: true },
            });

            return () => {
                if (editorRef.current) {
                    editorRef.current.dispose();
                    editorRef.current = null;
                }
                // Dispose all models to prevent memory leaks on component unmount
                monacoInstanceRef.current?.editor.getModels().forEach((model: any) => model.dispose());
            };
        };

        if ((window as any).monaco) {
            return initMonaco();
        } else if ((window as any).require) {
            (window as any).require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.49.0/min/vs' } });
            (window as any).require(['vs/editor/editor.main'], () => {
                initMonaco();
            });
        } else {
            console.error("Monaco loader script not found.");
        }
    }, []);

    useEffect(() => {
        const editor = editorRef.current;
        const monaco = monacoInstanceRef.current;
        if (!editor || !monaco || !file) return;

        const modelUri = monaco.Uri.parse(`file:///${file.id}`);
        let model = monaco.editor.getModel(modelUri);

        if (!model) {
            model = monaco.editor.createModel(
                file.content,
                getMonacoLang(file.language),
                modelUri
            );
        } else {
            if (model.getValue() !== file.content) {
                model.setValue(file.content);
            }
            if (model.getLanguageId() !== getMonacoLang(file.language)) {
                monaco.editor.setModelLanguage(model, getMonacoLang(file.language));
            }
        }

        if (editor.getModel() !== model) {
            editor.setModel(model);
        }

        contentChangeSubscriptionRef.current?.dispose();
        contentChangeSubscriptionRef.current = model.onDidChangeContent(() => {
            const currentContent = model.getValue();
            if (file && currentContent !== file.content) {
                onContentChange(file.id, currentContent);
            }
        });

        const cursorSubscription = editor.onDidChangeCursorSelection(() => {
            if (editor.getModel() === model) { // Only update state for the active model
                const position = editor.getPosition();
                const selection = editor.getSelection();
                if (model && position && selection) {
                    onStateChange({
                        line: position.lineNumber,
                        column: position.column,
                        charCount: model.getValueLength(),
                        selectionLength: model.getValueInRange(selection).length
                    });
                }
            }
        });

        // Initial state update
        const position = editor.getPosition();
        const selection = editor.getSelection();
        if (model && position && selection) {
            onStateChange({
                line: position.lineNumber,
                column: position.column,
                charCount: model.getValueLength(),
                selectionLength: model.getValueInRange(selection).length
            });
        }

        return () => {
            cursorSubscription.dispose();
        };

    }, [file, onContentChange, onStateChange]);

    useEffect(() => {
        if (editorRef.current) {
            editorRef.current.updateOptions({ wordWrap: isWordWrapEnabled ? 'on' : 'off' });
        }
    }, [isWordWrapEnabled]);

    useEffect(() => {
        if (editorRef.current) {
            editorRef.current.updateOptions({ renderWhitespace: whitespaceVisibility === 'all' ? 'all' : 'none' });
        }
    }, [whitespaceVisibility]);

    useImperativeHandle(ref, () => ({
        find: (term, options) => {
            const editor = editorRef.current;
            const monaco = monacoInstanceRef.current;
            if (!editor || !term || !monaco) return false;
            const model = editor.getModel();
            const findController = editor.getContribution('editor.contrib.findController');
            if (options.backwards) {
                // @ts-ignore - a bit of a private API, but standard way to do this
                findController.start({ searchString: term, isRegex: options.isRegex, matchCase: options.isCaseSensitive, wholeWord: options.isWholeWord, findInSelection: false }, false);
                // @ts-ignore
                findController.findPreviousAction();
            } else {
                // @ts-ignore
                findController.start({ searchString: term, isRegex: options.isRegex, matchCase: options.isCaseSensitive, wholeWord: options.isWholeWord, findInSelection: false }, false);
                // @ts-ignore
                findController.findNextAction();
            }

            // The find widget is now open, but we need to check if a match was found.
            const currentSelection = editor.getSelection();
            if (currentSelection && !currentSelection.isEmpty()) {
                const selectedText = model.getValueInRange(currentSelection);
                if (options.isRegex) {
                    const regex = new RegExp(term, options.isCaseSensitive ? '' : 'i');
                    return regex.test(selectedText);
                }
                if (options.isCaseSensitive) {
                    return selectedText === term;
                }
                return selectedText.toLowerCase() === term.toLowerCase();
            }
            return false;
        },
        replace: (searchTerm, replaceTerm, options) => {
            const editor = editorRef.current;
            if (!editor) return false;
            const selection = editor.getSelection();
            const model = editor.getModel();
            if (!selection || selection.isEmpty()) return false;

            const selectedText = model.getValueInRange(selection);
            const textToCompare = options.isCaseSensitive ? selectedText : selectedText.toLowerCase();
            const termToCompare = options.isCaseSensitive ? searchTerm : searchTerm.toLowerCase();

            if (textToCompare === termToCompare) {
                editor.executeEdits('replace', [{
                    range: selection,
                    text: replaceTerm,
                    forceMoveMarkers: true,
                }]);
                return true;
            }
            return false;
        },
        replaceAll: (searchTerm, replaceTerm, options) => {
            const editor = editorRef.current;
            if (!editor || !searchTerm) return;
            const model = editor.getModel();
            const findMatches = model.findMatches(searchTerm, true, options.isRegex, options.isCaseSensitive, options.isWholeWord ? " " : null, true);
            const edits = findMatches.map((match: any) => ({
                range: match.range,
                text: replaceTerm,
            }));
            editor.executeEdits('replaceAll', edits);
        },
        getSelection: () => {
            const editor = editorRef.current;
            if (!editor) return null;
            const model = editor.getModel();
            const selection = editor.getSelection();
            if (!selection || !model) return null;

            const startOffset = model.getOffsetAt(selection.getStartPosition());
            const endOffset = model.getOffsetAt(selection.getEndPosition());

            return {
                start: startOffset,
                end: endOffset,
                text: model.getValueInRange(selection),
            };
        },
        goToLine: (lineNumber: number) => {
            const editor = editorRef.current;
            if (editor) {
                editor.revealLineInCenter(lineNumber, 1 /* Immediate */);
                editor.setPosition({ lineNumber, column: 1 });
                editor.focus();
            }
        }
    }));

    return <div ref={containerRef} className="w-full h-full" />;
});

export default MonacoEditor;