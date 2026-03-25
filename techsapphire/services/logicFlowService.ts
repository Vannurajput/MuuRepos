import { FileTab } from '../types';

/**
 * Extracts function names and their body content from a string of code.
 * This uses a regex-based heuristic and may not capture all edge cases.
 * @param code The source code to parse.
 * @returns An array of objects with function name and body.
 */
export const extractFunctionsWithBody = (code: string): { name: string, body: string }[] => {
    const functions: { name: string, body: string }[] = [];
    // This regex is designed to be safer, looking for patterns that are very likely to be functions.
    // It covers: function name(){}, const name = () => {}, get/set name(){}, async name(){}
    const regex = /(?:(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\([^)]*\)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async)?\s*\([^)]*\)\s*=>|^\s*(?:get|set|async)\s*([a-zA-Z0-9_$]+)\s*\([^)]*\))\s*\{/gm;
    let match;

    while ((match = regex.exec(code)) !== null) {
        const name = match[1] || match[2] || match[3];
        // Ensure it's not a control flow statement
        if (name && !['if', 'for', 'while', 'switch', 'catch'].includes(name)) {
            const bodyStartIndex = match.index + match[0].length;
            let braceLevel = 1;
            let bodyEndIndex = -1;

            for (let i = bodyStartIndex; i < code.length; i++) {
                if (code[i] === '{') {
                    braceLevel++;
                } else if (code[i] === '}') {
                    braceLevel--;
                    if (braceLevel === 0) {
                        bodyEndIndex = i;
                        break;
                    }
                }
            }

            if (bodyEndIndex !== -1) {
                const body = code.substring(bodyStartIndex, bodyEndIndex);
                functions.push({ name, body });
            }
        }
    }
    return functions;
};


/**
 * Generates a human-readable YAML-like logic flow from a function body or full script.
 * @param code The code to analyze.
 * @returns A string representing the logic flow.
 */
export const generateLogicFlow = (code: string): string => {
    if (!code || !code.trim()) {
        return "  - Empty content.";
    }

    const lines = code.split('\n');
    let yaml = "";
    let indentLevel = 0;
    const INDENT = "  ";

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

        if (trimmed.startsWith('}') || trimmed.startsWith(']')) {
            indentLevel = Math.max(0, indentLevel - 1);
        }

        const currentIndent = INDENT.repeat(indentLevel);
        let description = "";

        let match;
        if (match = trimmed.match(/^if\s*\((.*)\)/)) {
            description = `If condition '${match[1].trim()}' is true:`;
        } else if (match = trimmed.match(/^else\s+if\s*\((.*)\)/)) {
            description = `Else If condition '${match[1].trim()}' is true:`;
        } else if (trimmed.match(/^else/)) {
            description = `Else:`;
        } else if (match = trimmed.match(/^for\s*\((.*)\)/)) {
            description = `Loop with '${match[1].trim()}':`;
        } else if (match = trimmed.match(/^while\s*\((.*)\)/)) {
            description = `Loop while '${match[1].trim()}':`;
        } else if (match = trimmed.match(/^switch\s*\((.*)\)/)) {
            description = `Switch on '${match[1].trim()}':`;
        } else if (match = trimmed.match(/^case\s+(.*):/)) {
            description = `Case ${match[1].trim()}:`;
        } else if (match = trimmed.match(/^return\s*(.*);?/)) {
            description = `Return ${match[1].trim() || 'value'}`;
        } else if (match = trimmed.match(/^(const|let|var)\s+([^=]+?)\s*=\s*(.*);?/)) {
            description = `Declare ${match[1]} '${match[2].trim()}' and assign it the value of: ${match[3].trim()}`;
        } else if (match = trimmed.match(/^([\w\d.\[\]]+)\s*(=|\+\+|--|\+=|-=)\s*(.*);?/)) {
            description = `Update variable '${match[1].trim()}' with operator '${match[2]}' and value: ${match[3].trim()}`;
        } else if (trimmed.match(/^(break;|default:)/)) {
            continue; // Skip for clarity
        }
         else {
            description = `Execute: ${trimmed.replace(/;$/, '')}`;
        }

        if (description) {
            yaml += `${currentIndent}- ${description}\n`;
        }

        if (trimmed.endsWith('{')) {
            indentLevel++;
        }
    }

    return yaml.trim() || "  - Could not generate logic flow.";
};

const parseHtmlAttributes = (attrString: string): { [key: string]: string } | undefined => {
    if (!attrString || !attrString.trim()) return undefined;
    const attrs: { [key: string]: string } = {};
    const attrRegex = /([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let match;
    while ((match = attrRegex.exec(attrString)) !== null) {
        attrs[match[1]] = match[2] || match[3] || match[4] || 'true';
    }
    return Object.keys(attrs).length > 0 ? attrs : undefined;
};

const nodeToYaml = (node: any, indent: number): string => {
    const indentStr = '  '.repeat(indent);
    let yaml = '';
    if (node.tag) {
        yaml += `${indentStr}- tag: ${node.tag}\n`;
        if (node.attributes) {
            yaml += `${'  '.repeat(indent + 1)}attributes:\n`;
            for (const key in node.attributes) {
                yaml += `${'  '.repeat(indent + 2)}${key}: "${node.attributes[key].replace(/"/g, '\\"')}"\n`;
            }
        }
        if (node.children && node.children.length > 0) {
            yaml += `${'  '.repeat(indent + 1)}children:\n`;
            node.children.forEach((child: any) => {
                yaml += nodeToYaml(child, indent + 2);
            });
        }
    } else if (node.text) {
        const textContent = node.text.length > 100 ? node.text.substring(0, 100) + '...' : node.text;
        yaml += `${indentStr}- text: "${textContent.replace(/"/g, '\\"')}"\n`;
    }
    return yaml;
}

const generateHtmlTreeYAML = (html: string): string => {
    const tree: any[] = [];
    const stack: any[] = [{ children: tree }];
    const tagRegex = /<\/?([a-zA-Z0-9-]+)((?:\s+[\w-]+(?:=(?:"[^"]*"|'[^']*'|[^>\s]+))?)*)\s*\/?>|([^<]+)/g;
    
    const cleanedHtml = html.replace(/<!--[\s\S]*?-->/g, '');

    let match;
    while ((match = tagRegex.exec(cleanedHtml)) !== null) {
        const [fullMatch, tagName, attrs, text] = match;

        if (tagName) {
            if (fullMatch.startsWith('</')) {
                if (stack.length > 1) stack.pop();
            } else {
                const parent = stack[stack.length - 1];
                const node: any = { tag: tagName };
                const parsedAttrs = parseHtmlAttributes(attrs || '');
                if(parsedAttrs) node.attributes = parsedAttrs;
                
                if (!parent.children) parent.children = [];
                parent.children.push(node);

                if (!fullMatch.endsWith('/>') && !['br', 'hr', 'img', 'input', 'meta', 'link'].includes(tagName.toLowerCase())) {
                    stack.push(node);
                }
            }
        } else if (text && text.trim()) {
            const parent = stack[stack.length - 1];
            if(parent.children) {
                 parent.children.push({ text: text.trim() });
            }
        }
    }
    
    let yaml = '';
    tree.forEach(rootNode => {
        yaml += nodeToYaml(rootNode, 0);
    });

    return yaml || '- Could not parse HTML structure.';
};

const generateCssTreeYAML = (css: string): string => {
    const cleanedCss = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const ruleRegex = /([^{}]+)\{([^{}]+)\}/g;
    let yaml = '';
    let match;
    while ((match = ruleRegex.exec(cleanedCss)) !== null) {
        const selector = match[1].trim();
        const properties = match[2].trim().split(';').map(p => p.trim()).filter(Boolean);

        yaml += `- selector: "${selector}"\n`;
        yaml += `  properties:\n`;
        properties.forEach(prop => {
            yaml += `    - "${prop}"\n`;
        });
    }
    return yaml || '- No CSS rules found.';
};


export const generateAlgoYAML = (file: FileTab): string => {
    const lang = file.language.toLowerCase();
    switch (lang) {
        case 'javascript':
        case 'typescript':
        case 'js':
        case 'ts':
        case 'jsx':
        case 'tsx':
            return generateLogicFlow(file.content);
        case 'html':
            return generateHtmlTreeYAML(file.content);
        case 'css':
        case 'scss':
            return generateCssTreeYAML(file.content);
        default:
            return `- Document breakdown not supported for '${file.language}'.`;
    }
};