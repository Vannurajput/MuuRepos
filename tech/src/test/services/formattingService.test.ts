import { describe, it, expect } from 'vitest';
import * as formattingService from '@services/formattingService';

describe('formattingService', () => {
    describe('getAvailableFormatters', () => {
        it('should return prettier formatters for JavaScript', () => {
            const formatters = formattingService.getAvailableFormatters('javascript');
            expect(formatters.length).toBeGreaterThan(0);
            expect(formatters.some(f => f.id.includes('prettier'))).toBe(true);
        });

        it('should return prettier formatters for TypeScript', () => {
            const formatters = formattingService.getAvailableFormatters('typescript');
            expect(formatters.length).toBeGreaterThan(0);
        });

        it('should return formatters for CSS', () => {
            const formatters = formattingService.getAvailableFormatters('css');
            expect(formatters.length).toBeGreaterThan(0);
        });

        it('should return formatters for HTML', () => {
            const formatters = formattingService.getAvailableFormatters('html');
            expect(formatters.length).toBeGreaterThan(0);
        });

        it('should return base formatters for unsupported languages', () => {
            const formatters = formattingService.getAvailableFormatters('unknown_language_xyz');
            // Even unsupported languages get reindent and compress
            expect(formatters.some(f => f.id === 'reindent')).toBe(true);
            expect(formatters.some(f => f.id === 'compress')).toBe(true);
        });
    });
});
