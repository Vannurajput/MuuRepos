import { Snippet } from '../../types';

export const snippets: Snippet[] = [
    {
        label: 'fun',
        detail: 'Function Declaration',
        code: `function function_name(params) {\n  |\n}`
    },
    {
        label: 'afun',
        detail: 'Arrow Function',
        code: `const function_name = (params) => {\n  |\n}`
    },
    {
        label: 'for',
        detail: 'For Loop',
        code: `for (let i = 0; i < array.length; i++) {\n  const element = array[i];\n  |\n}`
    },
    {
        label: 'forof',
        detail: 'For...of Loop',
        code: `for (const item of iterable) {\n  |\n}`
    },
    {
        label: 'forin',
        detail: 'For...in Loop',
        code: `for (const key in object) {\n  if (Object.hasOwnProperty.call(object, key)) {\n    const element = object[key];\n    |\n  }\n}`
    },
    {
        label: 'while',
        detail: 'While Loop',
        code: `while (condition) {\n  |\n}`
    },
    {
        label: 'if',
        detail: 'If Statement',
        code: `if (condition) {\n  |\n}`
    },
    {
        label: 'ifelse',
        detail: 'If...else Statement',
        code: `if (condition) {\n  |\n} else {\n  \n}`
    },
    {
        label: 'switch',
        detail: 'Switch Statement',
        code: `switch (key) {\n  case value:\n    |\n    break;\n\n  default:\n    break;\n}`
    },
    {
        label: 'class',
        detail: 'Class Declaration',
        code: `class MyClass {\n  constructor(|) {\n    \n  }\n}`
    },
    {
        label: 'try',
        detail: 'Try...catch Block',
        code: `try {\n  |\n} catch (error) {\n  \n}`
    },
    {
        label: 'prom',
        detail: 'New Promise',
        code: `new Promise((resolve, reject) => {\n  |\n})`
    },
    {
        label: 'log',
        detail: 'console.log',
        code: `console.log(|)`
    }
];
