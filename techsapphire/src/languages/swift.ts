import { LanguageSupport } from "../../types";

export const swift: LanguageSupport = {
    id: 'swift',
    name: 'Swift',
    keywords: [
        'class', 'deinit', 'enum', 'extension', 'func', 'import', 'init', 'internal', 'let', 'operator',
        'private', 'protocol', 'public', 'static', 'struct', 'subscript', 'typealias', 'var', 'break',
        'case', 'continue', 'default', 'defer', 'do', 'else', 'fallthrough', 'for', 'guard', 'if',
        'in', 'repeat', 'return', 'switch', 'where', 'while', 'as', 'Any', 'catch', 'false', 'is',
        'nil', 'rethrows', 'super', 'self', 'Self', 'throw', 'throws', 'true', 'try',
        '#available', '#colorLiteral', '#column', '#dsohandle', '#file', '#fileID', '#fileLiteral',
        '#filePath', '#function', '#imageLiteral', '#line', '#selector', '#sourceLocation', 'associativity',
        'convenience', 'dynamic', 'didSet', 'final', 'get', 'infix', 'indirect', 'lazy', 'left',
        'mutating', 'none', 'nonmutating', 'optional', 'override', 'postfix', 'precedence', 'prefix',
        'Protocol', 'required', 'right', 'set', 'Type', 'unowned', 'weak', 'willSet',
    ],
    autoClosePairs: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
        ['"', '"'],
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