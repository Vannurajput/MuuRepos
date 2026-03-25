import { LanguageSupport, FoldableRegion } from "../types";

export const typescript: LanguageSupport = {
    id: 'typescript',
    name: 'TypeScript',
    aliases: ['ts', 'tsx'],
    keywords: [
        'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
        'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function',
        'if', 'import', 'in', 'instanceof', 'new', 'return', 'super', 'switch',
        'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
        'let', 'static', 'enum', 'implements', 'interface', 'package', 'private',
        'protected', 'public', 'await', 'async', 'null', 'true', 'false', 'undefined',
        'constructor', 'from', 'get', 'set', 'of', 'any', 'boolean', 'declare', 'module',
        'require', 'number', 'string', 'symbol', 'type', 'namespace', 'readonly', 'abstract',
        'as', 'is', 'keyof', 'infer'
    ],
    autoClosePairs: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
        ['"', '"'],
        ["'", "'"],
        ['`', '`'],
    ],
    onEnter: (line, indent) => {
        let newIndent = indent;
        if (line.trim().endsWith('{') || line.trim().endsWith('(') || line.trim().endsWith('[')) {
            newIndent += '  ';
        }
        let append = '';
        const trimmedLine = line.trim();
        if ((trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) ||
            (trimmedLine.startsWith('(') && trimmedLine.endsWith(')')) ||
            (trimmedLine.startsWith('[') && trimmedLine.endsWith(']'))) {
             append = '\n' + indent;
        }
        return { indent: newIndent, append };
    },
    getFoldableRegions: (code: string): FoldableRegion[] => {
        const regions: FoldableRegion[] = [];
        const stack: { char: string, line: number }[] = [];
        const lines = code.split('\n');

        lines.forEach((line, index) => {
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '{') {
                    stack.push({ char: '{', line: index + 1 });
                } else if (char === '}') {
                    if (stack.length > 0 && stack[stack.length - 1].char === '{') {
                        const start = stack.pop();
                        if (start) {
                            const endLine = index + 1;
                            if (endLine > start.line) {
                                regions.push({ startLine: start.line, endLine });
                            }
                        }
                    }
                }
            }
        });

        return regions;
    }
};
