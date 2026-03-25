import { LanguageSupport } from "../../types";

export const kotlin: LanguageSupport = {
    id: 'kotlin',
    name: 'Kotlin',
    aliases: ['kt', 'kts'],
    keywords: [
        'as', 'break', 'class', 'continue', 'do', 'else', 'false', 'for', 'fun', 'if', 'in',
        'interface', 'is', 'null', 'object', 'package', 'return', 'super', 'this', 'throw',
        'true', 'try', 'typealias', 'typeof', 'val', 'var', 'when', 'while', 'by', 'catch',
        'constructor', 'delegate', 'dynamic', 'field', 'file', 'finally', 'get', 'import',
        'init', 'param', 'property', 'receiver', 'set', 'setparam', 'where', 'actual',
        'abstract', 'annotation', 'companion', 'const', 'crossinline', 'data', 'enum',
        'expect', 'external', 'final', 'infix', 'inline', 'inner', 'internal', 'lateinit',
        'noinline', 'open', 'operator', 'out', 'override', 'private', 'protected', 'public',
        'reified', 'sealed', 'suspend', 'tailrec', 'vararg'
    ],
    autoClosePairs: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
        ['"', '"'],
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