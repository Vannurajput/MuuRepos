import { describe, it, expect } from 'vitest';
import { createTestWorker, workerCode } from '@services/testRunnerService';

describe('testRunnerService', () => {
    describe('workerCode', () => {
        it('should be a non-empty string', () => {
            expect(workerCode).toBeDefined();
            expect(typeof workerCode).toBe('string');
            expect(workerCode.length).toBeGreaterThan(0);
        });

        it('should contain self.onmessage handler', () => {
            expect(workerCode).toContain('self.onmessage');
        });

        it('should define describe function', () => {
            expect(workerCode).toContain('self.describe');
        });

        it('should define it function', () => {
            expect(workerCode).toContain('self.it');
        });

        it('should define expect function', () => {
            expect(workerCode).toContain('self.expect');
        });

        it('should support toBe assertion', () => {
            expect(workerCode).toContain('toBe:');
        });

        it('should support toEqual assertion', () => {
            expect(workerCode).toContain('toEqual:');
        });

        it('should support toThrow assertion', () => {
            expect(workerCode).toContain('toThrow:');
        });

        it('should post message with results', () => {
            expect(workerCode).toContain('self.postMessage');
        });

        it('should track test statistics', () => {
            expect(workerCode).toContain('stats');
            expect(workerCode).toContain('total');
            expect(workerCode).toContain('passed');
            expect(workerCode).toContain('failed');
        });

        it('should handle suites array', () => {
            expect(workerCode).toContain('allSuites');
            expect(workerCode).toContain('suites');
        });

        it('should handle test cases', () => {
            expect(workerCode).toContain('testCase');
            expect(workerCode).toContain('currentSuite');
        });

        it('should handle errors in tests', () => {
            expect(workerCode).toContain('catch');
            expect(workerCode).toContain('error');
        });
    });

    describe('createTestWorker', () => {
        it('should be a function', () => {
            expect(typeof createTestWorker).toBe('function');
        });

        // Skip Worker test - jsdom doesn't support Web Workers
        it.skip('should create a worker when called in browser environment', () => {
            // This test verifies the function exists and is callable
            // In jsdom, Blob and Worker are available
            const worker = createTestWorker();
            expect(worker).toBeDefined();
            expect(typeof worker.postMessage).toBe('function');
            expect(typeof worker.terminate).toBe('function');

            // Clean up
            worker.terminate();
        });
    });
});
