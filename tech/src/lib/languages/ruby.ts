import { LanguageSupport } from "../types";

export const ruby: LanguageSupport = {
    id: 'ruby',
    name: 'Ruby',
    aliases: ['rb'],
    keywords: [
        'BEGIN', 'END', 'alias', 'and', 'begin', 'break', 'case', 'class', 'def', 'defined?',
        'do', 'else', 'elsif', 'end', 'ensure', 'false', 'for', 'if', 'in', 'module', 'next',
        'nil', 'not', 'or', 'redo', 'rescue', 'retry', 'return', 'self', 'super', 'then',
        'true', 'undef', 'unless', 'until', 'when', 'while', 'yield'
    ],
    autoClosePairs: [
        ['(', ')'],
        ['[', ']'],
        ['{', '}'],
        ['"', '"'],
        ["'", "'"],
        ['|', '|'],
    ],
    onEnter: (line, indent) => {
        let newIndent = indent;
        const trimmedLine = line.trim();
        if (/^(class|module|def|if|unless|case|while|until|for|begin|do)\b/.test(trimmedLine) && !trimmedLine.endsWith('end')) {
            newIndent += '  ';
        }
        return { indent: newIndent };
    },
};
