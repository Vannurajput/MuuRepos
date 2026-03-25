const INDENT_UNIT = '  '; // 2 spaces

/**
 * Re-indents code for C-style languages that use braces for blocks.
 * @param code The code to re-indent.
 * @returns The re-indented code.
 */
function reindentCStyle(code: string): string {
    let level = 0;
    const lines = code.split('\n');
    const newLines: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            newLines.push('');
            continue;
        }

        // If line starts with a closing brace, decrease indent level first.
        if (trimmed.startsWith('}') || trimmed.startsWith(']')) {
            level = Math.max(0, level - 1);
        }

        newLines.push(INDENT_UNIT.repeat(level) + trimmed);

        // Count braces/brackets to determine next line's indentation.
        const openBraces = (trimmed.match(/{/g) || []).length;
        const closeBraces = (trimmed.match(/}/g) || []).length;
        level += openBraces - closeBraces;
        
        const openBrackets = (trimmed.match(/\[/g) || []).length;
        const closeBrackets = (trimmed.match(/]/g) || []).length;
        level += openBrackets - closeBrackets;

        level = Math.max(0, level);
    }
    return newLines.join('\n');
}

/**
 * Re-indents code for Python, where indentation is significant.
 * This is a heuristic and may not be perfect for all cases.
 * @param code The code to re-indent.
 * @returns The re-indented code.
 */
function reindentPythonStyle(code: string): string {
    let level = 0;
    const lines = code.split('\n');
    const newLines: string[] = [];
    const dedentKeywords = /^(elif |else:|except|finally:|pass|break|continue|return)/;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            newLines.push('');
            continue;
        }

        if (dedentKeywords.test(trimmed)) {
            level = Math.max(0, level - 1);
        }

        newLines.push(INDENT_UNIT.repeat(level) + trimmed);
        
        if (trimmed.endsWith(':')) {
            level++;
        }
    }
    return newLines.join('\n');
}


/**
 * Re-indents the given code based on the specified language's syntax.
 * @param code The string of code to re-indent.
 * @param languageId The language identifier (e.g., 'javascript', 'python').
 * @returns The re-indented code as a string.
 */
export function reindent(code: string, languageId: string): string {
    const langId = languageId.toLowerCase();

    const cStyleLangs = ['javascript', 'typescript', 'jsx', 'tsx', 'css', 'scss', 'csharp', 'java', 'c', 'cpp', 'json', 'go', 'rust', 'swift', 'kotlin', 'php', 'shell'];
    const pythonStyleLangs = ['python'];

    if (cStyleLangs.includes(langId)) {
        return reindentCStyle(code);
    }

    if (pythonStyleLangs.includes(langId)) {
        return reindentPythonStyle(code);
    }
    
    // For unsupported languages, return the original code to be safe.
    return code;
}
