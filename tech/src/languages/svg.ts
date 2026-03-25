// FIX: Corrected import path for LanguageSupport to point to the root types file.
import { LanguageSupport } from "../../types";

export const svg: LanguageSupport = {
    id: 'svg',
    name: 'SVG',
    isVisual: true,
    keywords: [
        'svg', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text',
        'g', 'defs', 'symbol', 'use', 'image', 'clipPath', 'mask', 'pattern', 'filter',
        'animate', 'set', 'animateMotion', 'animateTransform', 'title', 'desc', 'metadata'
    ],
    autoClosePairs: [
        ['(', ')'],
        ['"', '"'],
        ["'", "'"],
    ],
    onOpenTag: (tagName: string) => `</${tagName}>`,
};