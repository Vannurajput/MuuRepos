import { LanguageSupport } from "../types";

export const go: LanguageSupport = {
    id: 'go',
    name: 'Go',
    keywords: [
        'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else', 'fallthrough',
        'for', 'func', 'go', 'goto', 'if', 'import', 'interface', 'map', 'package', 'range',
        'return', 'select', 'struct', 'switch', 'type', 'var'
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
        if (line.trim().endsWith('{') || line.trim().endsWith('(')) {
            newIndent += '  ';
        }
        let append = '';
        if (line.trim() === '{}' || line.trim() === '()') {
            append = '\n' + indent;
        }
        return { indent: newIndent, append };
    },
};
