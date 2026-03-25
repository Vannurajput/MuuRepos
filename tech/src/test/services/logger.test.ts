import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logger, setDebugMode } from '@services/logger';

describe('logger', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => { });
        vi.spyOn(console, 'info').mockImplementation(() => { });
        vi.spyOn(console, 'warn').mockImplementation(() => { });
        vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    describe('setDebugMode', () => {
        it('should enable debug mode', () => {
            setDebugMode(true);
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('Debug mode is now ENABLED')
            );
        });

        it('should disable debug mode', () => {
            setDebugMode(false);
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('Debug mode is now DISABLED')
            );
        });
    });

    describe('debug', () => {
        it('should log debug messages when debug mode is enabled', () => {
            setDebugMode(true);
            logger.debug('Test message');
            expect(console.log).toHaveBeenCalledWith(
                '[DEBUG]',
                expect.any(String),
                'Test message'
            );
        });

        it('should not log debug messages when debug mode is disabled', () => {
            setDebugMode(false);
            vi.clearAllMocks();
            logger.debug('Test message');
            // Should not be called with [DEBUG] prefix
            expect(console.log).not.toHaveBeenCalledWith(
                '[DEBUG]',
                expect.any(String),
                'Test message'
            );
        });
    });

    describe('info', () => {
        it('should always log info messages', () => {
            logger.info('Info message');
            expect(console.info).toHaveBeenCalledWith(
                '[INFO]',
                expect.any(String),
                'Info message'
            );
        });
    });

    describe('warn', () => {
        it('should always log warning messages', () => {
            logger.warn('Warning message');
            expect(console.warn).toHaveBeenCalledWith(
                '[WARN]',
                expect.any(String),
                'Warning message'
            );
        });
    });

    describe('error', () => {
        it('should always log error messages', () => {
            logger.error('Error message');
            expect(console.error).toHaveBeenCalledWith(
                '[ERROR]',
                expect.any(String),
                'Error message'
            );
        });

        it('should log error objects', () => {
            const error = new Error('Test error');
            logger.error('Failed:', error);
            expect(console.error).toHaveBeenCalledWith(
                '[ERROR]',
                expect.any(String),
                'Failed:',
                error
            );
        });
    });
});
