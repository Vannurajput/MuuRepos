import { describe, it, expect } from 'vitest';
import { analyzeCode } from '@services/codeAnalysisService';
import { FileTab } from '@/types';

const createMockFile = (content: string, language: string, name = 'test.js'): FileTab => ({
  id: 1,
  projectId: 1,
  name,
  content,
  language,
  createdAt: Date.now(),
  modifiedAt: Date.now(),
});

describe('codeAnalysisService', () => {
  describe('analyzeCode', () => {
    describe('JavaScript analysis', () => {
      it('should detect function declarations', () => {
        const code = `
          function hello(name) {
            return 'Hello ' + name;
          }
          
          function goodbye() {
            console.log('Goodbye');
          }
        `;
        const file = createMockFile(code, 'javascript');
        const result = analyzeCode(file, [file]);

        expect(result.functions).toBeDefined();
        expect(result.functions?.length).toBe(2);
        expect(result.functions?.[0].name).toBe('hello');
        expect(result.functions?.[1].name).toBe('goodbye');
      });

      it('should detect arrow functions', () => {
        const code = `
          const add = (a, b) => a + b;
          const multiply = async (x, y) => x * y;
        `;
        const file = createMockFile(code, 'javascript');
        const result = analyzeCode(file, [file]);

        expect(result.functions?.length).toBe(2);
        expect(result.functions?.[0].type).toBe('arrow');
      });

      it('should detect class declarations', () => {
        const code = `
          class Calculator {
            add(a, b) { return a + b; }
          }
          
          class AdvancedCalculator extends Calculator {
            multiply(a, b) { return a * b; }
          }
        `;
        const file = createMockFile(code, 'javascript');
        const result = analyzeCode(file, [file]);

        expect(result.variables).toBeDefined();
        const classes = result.variables?.filter(v => v.type === 'class');
        expect(classes?.length).toBe(2);
      });

      it('should detect DOM selectors', () => {
        const code = `
          const btn = document.getElementById('submit-btn');
          const items = document.querySelectorAll('.item');
          const header = document.querySelector('#header');
        `;
        const file = createMockFile(code, 'javascript');
        const result = analyzeCode(file, [file]);

        expect(result.domSelectors?.length).toBe(3);
        expect(result.domSelectors?.[0].method).toBe('getElementById');
        expect(result.domSelectors?.[0].selector).toBe('submit-btn');
      });

      it('should count imports correctly', () => {
        const code = `
          import React from 'react';
          import { useState, useEffect } from 'react';
          const lodash = require('lodash');
        `;
        const file = createMockFile(code, 'javascript');
        const result = analyzeCode(file, [file]);

        expect(result.summary?.importCount).toBe(3);
      });

      it('should count comment lines', () => {
        const code = `
          // This is a comment
          function test() {
            // Another comment
            * multiline comment line
            return true;
          }
          /* Block comment */
        `;
        const file = createMockFile(code, 'javascript');
        const result = analyzeCode(file, [file]);

        expect(result.summary?.commentLineCount).toBeGreaterThan(0);
      });
    });

    describe('CSS analysis', () => {
      it('should detect class selectors', () => {
        const code = `
          .button { color: red; }
          .header { background: blue; }
          .nav-item { padding: 10px; }
        `;
        const file = createMockFile(code, 'css', 'styles.css');
        const result = analyzeCode(file, [file]);

        const classSelectors = result.cssSelectors?.filter(s => s.type === 'class');
        expect(classSelectors?.length).toBe(3);
      });

      it('should detect ID selectors', () => {
        const code = `
          #main { display: flex; }
          #sidebar { width: 300px; }
        `;
        const file = createMockFile(code, 'css', 'styles.css');
        const result = analyzeCode(file, [file]);

        const idSelectors = result.cssSelectors?.filter(s => s.type === 'id');
        expect(idSelectors?.length).toBe(2);
      });

      it('should detect keyframe animations', () => {
        const code = `
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          @keyframes slideIn {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(0); }
          }
        `;
        const file = createMockFile(code, 'css', 'styles.css');
        const result = analyzeCode(file, [file]);

        const animations = result.cssSelectors?.filter(s => s.type === 'animation');
        expect(animations?.length).toBe(2);
        expect(animations?.[0].name).toBe('fadeIn');
      });
    });

    describe('HTML analysis', () => {
      it('should count HTML elements', () => {
        const code = `
          <html>
            <head><title>Test</title></head>
            <body>
              <div id="main">
                <h1>Hello</h1>
                <p>World</p>
              </div>
            </body>
          </html>
        `;
        const file = createMockFile(code, 'html', 'index.html');
        const result = analyzeCode(file, [file]);

        expect(result.summary?.htmlElementCount).toBeGreaterThan(0);
      });
    });

    describe('TypeScript analysis', () => {
      it('should handle TypeScript like JavaScript', () => {
        const code = `
          function greet(user) {
            return 'Hello ' + user.name;
          }
          
          function getAge(user) {
            return user.age;
          }
        `;
        const file = createMockFile(code, 'typescript', 'index.ts');
        const result = analyzeCode(file, [file]);

        expect(result.functions?.length).toBe(2);
      });
    });

    describe('Unknown language handling', () => {
      it('should provide basic summary for unknown languages', () => {
        const code = 'Some content here\nLine 2\nLine 3';
        const file = createMockFile(code, 'unknown', 'file.xyz');
        const result = analyzeCode(file, [file]);

        expect(result.summary).toBeDefined();
        expect(result.summary?.totalLines).toBe(3);
        expect(result.summary?.charCount).toBe(code.length);
      });
    });
  });
});
