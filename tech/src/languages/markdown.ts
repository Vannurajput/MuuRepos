import { LanguageSupport } from "../../types";

export const markdown: LanguageSupport = {
    id: 'markdown',
    name: 'Markdown',
    aliases: ['md', 'mkd'],
    isVisual: true,
    autoClosePairs: [
        ['(', ')'],
        ['[', ']'],
        ['*', '*'],
        ['_', '_'],
        ['`', '`'],
    ],
    onEnter: (line, indent) => {
        // Matches list items like: "  - item", "  * item", or "  1. item"
        const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s*(.*)/);
        
        if (listMatch) {
            const whitespace = listMatch[1];
            const bullet = listMatch[2];
            const content = listMatch[3];

            if (content.length === 0) {
                // If the user presses enter on an empty list item, create a new line without the bullet.
                // This allows them to "break out" of the list.
                return { indent: '' };
            }

            let newBullet = bullet;
            if (/\d+\./.test(bullet)) {
                // If it's a numbered list, increment the number.
                const num = parseInt(bullet, 10);
                newBullet = `${num + 1}.`;
            }

            // Return the same whitespace indent plus the bullet for the next line.
            return { indent: `${whitespace}${newBullet} ` };
        }
        
        // Default behavior: just keep the same indentation.
        return { indent };
    },
};
