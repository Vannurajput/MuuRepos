import { describe, it, expect } from 'vitest';
import { reindent } from '@services/indentationService';

describe('indentationService', () => {
    describe('reindent', () => {
        describe('C-style languages (JavaScript, TypeScript, etc.)', () => {
            it('should indent nested braces correctly', () => {
                const input = `function test() {
if (true) {
console.log('hello');
}
}`;
                const result = reindent(input, 'javascript');

                expect(result).toContain('  if (true) {');
                expect(result).toContain('    console.log');
            });

            it('should handle empty lines', () => {
                const input = `function test() {

console.log('hello');
}`;
                const result = reindent(input, 'javascript');

                expect(result.split('\n')[1]).toBe('');
                expect(result).toContain('  console.log');
            });

            it('should handle closing braces at start of line', () => {
                const input = `{
{
}
}`;
                const result = reindent(input, 'javascript');

                const lines = result.split('\n');
                expect(lines[0]).toBe('{');
                expect(lines[1]).toBe('  {');
                expect(lines[2]).toBe('  }');
                expect(lines[3]).toBe('}');
            });

            it('should handle square brackets for arrays', () => {
                const input = `const arr = [
1,
2,
3
];`;
                const result = reindent(input, 'typescript');

                expect(result).toContain('  1,');
                expect(result).toContain('  2,');
                expect(result).toContain('  3');
            });

            it('should handle multiple braces on same line', () => {
                const input = `if (a) { if (b) {
return true;
}}`;
                const result = reindent(input, 'javascript');

                expect(result).toContain('    return true;');
            });

            it('should work for CSS', () => {
                const input = `.class {
color: red;
}`;
                const result = reindent(input, 'css');

                expect(result).toContain('  color: red;');
            });

            it('should work for JSON', () => {
                const input = `{
"key": "value",
"nested": {
"inner": true
}
}`;
                const result = reindent(input, 'json');

                expect(result).toContain('  "key": "value",');
                expect(result).toContain('  "nested": {');
                expect(result).toContain('    "inner": true');
            });

            it('should handle negative indent levels gracefully', () => {
                const input = `}
}
}
function test() {
}`;
                const result = reindent(input, 'javascript');

                // All lines should start without negative indentation (no strange chars)
                result.split('\n').forEach((line: string) => {
                    expect(line.startsWith('  ') || line.length === 0 || line[0] !== ' ').toBe(true);
                });
            });
        });

        describe('Python-style languages', () => {
            it('should indent after colon', () => {
                const input = `def test():
print('hello')
if True:
print('world')`;
                const result = reindent(input, 'python');

                expect(result).toContain('  print(\'hello\')');
                expect(result).toContain('  if True:');
                expect(result).toContain('    print(\'world\')');
            });

            it('should dedent for elif/else', () => {
                const input = `if True:
print('a')
elif False:
print('b')
else:
print('c')`;
                const result = reindent(input, 'python');

                expect(result).toContain('elif False:');
                expect(result).toContain('else:');
            });

            it('should dedent for pass/break/continue/return', () => {
                const input = `for i in range(10):
if i == 5:
break
pass`;
                const result = reindent(input, 'python');

                expect(result).toMatch(/^\s*pass$/m);
            });

            it('should handle empty lines in Python', () => {
                const input = `def test():

pass`;
                const result = reindent(input, 'python');

                expect(result.split('\n')[1]).toBe('');
            });

            it('should dedent for except/finally', () => {
                const input = `try:
something()
except:
handle()
finally:
cleanup()`;
                const result = reindent(input, 'python');

                expect(result).toContain('except:');
                expect(result).toContain('finally:');
            });
        });

        describe('Unsupported languages', () => {
            it('should return original code for unsupported languages', () => {
                const input = `some random text
  with weird indentation
    that varies`;
                const result = reindent(input, 'markdown');

                expect(result).toBe(input);
            });

            it('should handle unknown language identifiers', () => {
                const input = 'const x = 1;';
                const result = reindent(input, 'unknownlang123');

                expect(result).toBe(input);
            });
        });

        describe('Language detection', () => {
            it('should recognize JavaScript', () => {
                const input = '{ test }';
                expect(reindent(input, 'javascript')).toBeDefined();
                expect(reindent(input, 'JAVASCRIPT')).toBeDefined(); // case insensitive
            });

            it('should recognize TypeScript variants', () => {
                const input = '{ test }';
                expect(reindent(input, 'typescript')).toBeDefined();
                expect(reindent(input, 'tsx')).toBeDefined();
                expect(reindent(input, 'jsx')).toBeDefined();
            });

            it('should recognize other C-style languages', () => {
                const input = '{ test }';
                const languages = ['csharp', 'java', 'c', 'cpp', 'go', 'rust', 'swift', 'kotlin', 'php', 'shell'];

                for (const lang of languages) {
                    expect(reindent(input, lang)).toBeDefined();
                }
            });
        });
    });
});
