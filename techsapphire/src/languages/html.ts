// FIX: Corrected import path for LanguageSupport to point to the root types file.
import { LanguageSupport } from "../../types";

const selfClosingTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

export const html: LanguageSupport = {
    id: 'html',
    name: 'HTML',
    aliases: ['htm'],
    isVisual: true,
    keywords: [
        // Tags
        'div', 'span', 'p', 'a', 'img', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot', 'form', 'input', 'button', 'select',
        'option', 'textarea', 'label', 'head', 'body', 'title', 'meta', 'link', 'script',
        'style', 'header', 'footer', 'nav', 'main', 'section', 'article', 'aside', 'details',
        'summary', 'figure', 'figcaption', 'dialog', 'iframe', 'canvas', 'video', 'audio',
        'source', 'track', 'embed', 'object', 'param', 'picture', 'map', 'area', 'br', 'hr',
        // Attributes
        'id', 'class', 'style', 'lang', 'title', 'src', 'href', 'alt', 'width', 'height',
        'rel', 'type', 'name', 'value', 'placeholder', 'disabled', 'checked', 'selected',
        'readonly', 'required', 'for', 'action', 'method', 'target', 'charset', 'content',
        'http-equiv', 'onclick', 'onload', 'onchange', 'onsubmit', 'onmouseover', 'onmouseout',
        'onkeydown', 'onkeyup', 'onkeypress',
    ],
    autoClosePairs: [
        ['(', ')'],
        ['"', '"'],
        ["'", "'"],
    ],
    onOpenTag: (tagName: string) => {
        if (selfClosingTags.has(tagName.toLowerCase())) {
            return '';
        }
        return `</${tagName}>`;
    },
    onEnter: (line, indent) => {
        let newIndent = indent;
        // Basic indentation increase if line ends with an open tag not on the same line
        if (/<([a-zA-Z0-9]+)(?![^>]*\/>)[^>]*>$/.test(line.trim()) && !/<\/[a-zA-Z0-9\s]*>$/.test(line.trim())) {
             if (!selfClosingTags.has(RegExp.$1.toLowerCase())) {
                newIndent += '  ';
             }
        }
        return { indent: newIndent };
    }
};