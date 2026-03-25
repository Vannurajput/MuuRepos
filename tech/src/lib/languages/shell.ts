import { LanguageSupport } from "../types";

export const shell: LanguageSupport = {
    id: 'shell',
    name: 'Shell',
    aliases: ['sh', 'bash', 'zsh'],
    keywords: [
        'if', 'then', 'else', 'elif', 'fi', 'for', 'in', 'do', 'done', 'while', 'until', 'case',
        'esac', 'function', 'select', 'echo', 'read', 'let', 'export', 'unset', 'return',
        'exit', 'source', 'declare', 'local', 'readonly', 'true', 'false', 'break', 'continue',
        'test', 'alias', 'bg', 'bind', 'builtin', 'caller', 'cd', 'command', 'compgen',
        'complete', 'compopt', 'coproc', 'dirs', 'disown', 'enable', 'eval', 'exec', 'fc',
        'fg', 'getopts', 'hash', 'help', 'history', 'jobs', 'kill', 'logout', 'mapfile',
        'popd', 'printf', 'pushd', 'pwd', 'set', 'shift', 'shopt', 'suspend', 'times',
        'trap', 'type', 'typeset', 'ulimit', 'umask', 'unalias', 'wait'
    ],
    autoClosePairs: [
        ['{', '}'],
        ['(', ')'],
        ['"', '"'],
        ["'", "'"],
        ['`', '`'],
    ],
    onEnter: (line, indent) => {
        let newIndent = indent;
        if (line.trim().endsWith('do') || line.trim().endsWith('{')) {
            newIndent += '  ';
        }
        return { indent: newIndent };
    },
};
