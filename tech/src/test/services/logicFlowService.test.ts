import { describe, it, expect } from 'vitest';
import { generateAlgoYAML } from '@services/logicFlowService';
import { FileTab } from '@/types';

describe('logicFlowService', () => {
  describe('generateAlgoYAML', () => {
    const createFile = (name: string, content: string, language: string): FileTab => ({
      id: 1,
      projectId: 1,
      name,
      content,
      language,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    });

    describe('JavaScript/TypeScript files', () => {
      it('should detect conditional logic', () => {
        const file = createFile('test.js', `
          if (condition) {
            doSomething();
          }
        `, 'javascript');


        const result = generateAlgoYAML(file);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should detect loop constructs', () => {
        const file = createFile('test.js', `
          for (let i = 0; i < 10; i++) {
            console.log(i);
          }
        `, 'javascript');
        const result = generateAlgoYAML(file);
        expect(result).toContain('Loop');
      });

      it('should detect while loops', () => {
        const file = createFile('test.js', `
          while (true) {
            break;
          }
        `, 'javascript');

        const result = generateAlgoYAML(file);
        expect(result).toContain('while');
      });

      it('should detect function declarations', () => {
        const file = createFile('test.js', `
          function myFunction() {
            return 42;
          }
        `, 'javascript');

        const result = generateAlgoYAML(file);
        expect(result).toContain('function');
      });

      it('should detect arrow functions', () => {
        const file = createFile('test.js', `
          const myFunc = () => {
            return 'hello';
          };
        `, 'javascript');

        const result = generateAlgoYAML(file);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should handle try-catch blocks', () => {
        const file = createFile('test.js', `
          try {
            riskyOperation();
          } catch (e) {
            handleError(e);
          }
        `, 'javascript');

        const result = generateAlgoYAML(file);
        expect(result).toContain('try');
      });

      it('should handle return statements', () => {
        const file = createFile('test.js', `
          function test() {
            return value;
          }
        `, 'javascript');


        const result = generateAlgoYAML(file);
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('HTML files', () => {
      it('should generate tree structure for HTML', () => {
        const file = createFile('test.html', `
          <html>
            <body>
              <div class="container">
                <p>Hello</p>
              </div>
            </body>
          </html>
        `, 'html');

        const result = generateAlgoYAML(file);
        expect(result.length).toBeGreaterThan(0);
        expect(result).toContain('html');
      });

      it('should handle empty HTML', () => {
        const file = createFile('test.html', '', 'html');

        const result = generateAlgoYAML(file);
        expect(result).toBeDefined();
      });

      it('should handle HTML with attributes', () => {
        const file = createFile('test.html', `
          <div id="main" class="container" data-value="test">
            Content
          </div>
        `, 'html');

        const result = generateAlgoYAML(file);
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('CSS files', () => {
      it('should detect CSS selectors', () => {
        const file = createFile('test.css', `
          .container {
            display: flex;
          }
          
          #main {
            color: red;
          }
        `, 'css');

        const result = generateAlgoYAML(file);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should handle media queries', () => {
        const file = createFile('test.css', `
          @media (max-width: 768px) {
            .container {
              flex-direction: column;
            }
          }
        `, 'css');

        const result = generateAlgoYAML(file);
        expect(result).toBeDefined();
      });

      it('should handle empty CSS', () => {
        const file = createFile('test.css', '', 'css');

        const result = generateAlgoYAML(file);
        expect(result).toBeDefined();
      });
    });

    describe('Python files', () => {
      it('should detect Python functions', () => {
        const file = createFile('test.py', `
def calculate(x, y):
    return x + y
        `, 'python');


        const result = generateAlgoYAML(file);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should detect Python classes', () => {
        const file = createFile('test.py', `
class MyClass:
    def __init__(self):
        pass
        `, 'python');


        const result = generateAlgoYAML(file);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should detect Python control flow', () => {
        const file = createFile('test.py', `
for i in range(10):
    if i % 2 == 0:
        print(i)
        `, 'python');

        const result = generateAlgoYAML(file);
        expect(result).toContain('for');
      });
    });

    describe('Edge cases', () => {
      it('should handle empty file content', () => {
        const file = createFile('test.js', '', 'javascript');

        const result = generateAlgoYAML(file);
        expect(result).toBeDefined();
      });

      it('should handle whitespace-only content', () => {
        const file = createFile('test.js', '   \n\n   \t\t\n   ', 'javascript');

        const result = generateAlgoYAML(file);
        expect(result).toBeDefined();
      });

      it('should handle unknown language', () => {
        const file = createFile('test.xyz', 'some content', 'unknown');

        const result = generateAlgoYAML(file);
        expect(result).toBeDefined();
      });

      it('should handle very large files', () => {
        const largeContent = 'function test() {\n' +
          '  console.log("line");\n'.repeat(1000) +
          '}';
        const file = createFile('test.js', largeContent, 'javascript');

        const result = generateAlgoYAML(file);
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });
});
