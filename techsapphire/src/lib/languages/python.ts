import { LanguageSupport } from "../types";

export const python: LanguageSupport = {
    id: 'python',
    name: 'Python',
    aliases: ['py'],
    keywords: [
        'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
        'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
        'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
        'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield'
    ],
    autoClosePairs: [
        ['(', ')'],
        ['[', ']'],
        ['{', '}'],
        ['"', '"'],
        ["'", "'"],
    ],
    onEnter: (line, indent) => {
        let newIndent = indent;
        if (line.trim().endsWith(':')) {
            newIndent += '  '; // Or 4 spaces
        }
        return { indent: newIndent };
    },
};
