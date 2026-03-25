// FIX: Corrected import path for LanguageSupport to point to the root types file.
import { LanguageSupport } from "../../types";

export const c: LanguageSupport = {
    id: 'c',
    name: 'C',
    keywords: [
        'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double', 'else',
        'enum', 'extern', 'float', 'for', 'goto', 'if', 'int', 'long', 'register', 'return', 'short',
        'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void',
        'volatile', 'while'
    ],
    autoClosePairs: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
        ['"', '"'],
        ["'", "'"],
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