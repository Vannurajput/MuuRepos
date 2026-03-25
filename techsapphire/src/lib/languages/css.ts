import { LanguageSupport } from "../types";

export const css: LanguageSupport = {
    id: 'css',
    name: 'CSS',
    aliases: ['scss', 'less'],
    keywords: [
        'color', 'background-color', 'font-size', 'width', 'height', 'padding', 'margin',
        'border', 'display', 'position', 'top', 'right', 'bottom', 'left', 'float',
        'clear', 'flex', 'grid', 'align-items', 'justify-content', 'absolute', 'relative',
        'fixed', 'sticky', 'inherit', 'initial', 'unset', 'block', 'inline', 'inline-block',
        'none', 'solid', 'dotted', 'dashed', 'double', 'groove', 'ridge', 'inset', 'outset',
        'hidden', 'visible', 'auto', 'scroll', 'bold', 'italic', 'normal', 'sans-serif',
        'serif', 'monospace',
    ],
    autoClosePairs: [
        ['{', '}'],
        ['(', ')'],
        ['"', '"'],
        ["'", "'"],
    ],
     onEnter: (line, indent) => {
        let newIndent = indent;
        if (line.trim().endsWith('{')) {
            newIndent += '  ';
        }
        let append = '';
        if (line.trim() === '{}') {
            append = '\n' + indent;
        }
        return { indent: newIndent, append };
    },
};
