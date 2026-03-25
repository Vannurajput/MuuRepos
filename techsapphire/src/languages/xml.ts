import { LanguageSupport } from "../../types";

const selfClosingTags = new Set(['br', 'hr', 'img', 'input', 'link', 'meta']); // Common ones, not exhaustive for XML

export const xml: LanguageSupport = {
    id: 'xml',
    name: 'XML',
    isVisual: true, // Can be rendered, but often treated as data
    keywords: [
        // Common XML-related keywords, though XML is schema-driven
        'xml', 'version', 'encoding', 'standalone', 'DOCTYPE', 'SYSTEM', 'PUBLIC',
        'ELEMENT', 'ATTLIST', 'ENTITY', 'NOTATION',
    ],
    autoClosePairs: [
        ['<', '>'],
        ['"', '"'],
        ["'", "'"],
    ],
    onOpenTag: (tagName: string) => {
        // XML is stricter, but for editor purposes, we can have a small set of void elements.
        if (selfClosingTags.has(tagName.toLowerCase())) {
            return '';
        }
        return `</${tagName}>`;
    },
    onEnter: (line, indent) => {
        let newIndent = indent;
        // Basic indentation increase if line ends with an open tag not on the same line
        if (/<([a-zA-Z0-9:]+)(?![^>]*\/>)[^>]*>$/.test(line.trim()) && !/<\/[a-zA-Z0-9:\s]*>$/.test(line.trim())) {
             const tagName = RegExp.$1;
             if (!selfClosingTags.has(tagName.toLowerCase())) {
                newIndent += '  ';
             }
        }
        return { indent: newIndent };
    }
};
