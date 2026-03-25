

export const workerCode = `
self.onmessage = ({ data }) => {
    const { files } = data;
    const allSuites = [];
    let stats = { total: 0, passed: 0, failed: 0 };

    // Simple testing framework implementation
    const implementation = (file) => {
        const suites = [];
        let currentSuite = { suiteName: 'Unnamed Suite', fileName: file.name, tests: [], passed: true, error: null };

        self.describe = (suiteName, fn) => {
            currentSuite = { suiteName, fileName: file.name, tests: [], passed: true, error: null };
            suites.push(currentSuite);
            try {
                fn();
            } catch(e) {
                currentSuite.error = e.stack || e.toString();
                currentSuite.passed = false;
            }
        };

        self.it = (testName, fn) => {
            stats.total++;
            const testCase = { name: testName, passed: false, error: null };
            try {
                fn();
                testCase.passed = true;
                stats.passed++;
            } catch (e) {
                testCase.passed = false;
                testCase.error = e.stack || e.toString();
                stats.failed++;
                currentSuite.passed = false;
            }
            currentSuite.tests.push(testCase);
        };

        self.expect = (actual) => ({
            toBe: (expected) => {
                if (actual !== expected) {
                    throw new Error(\`Expected \${JSON.stringify(actual)} to be \${JSON.stringify(expected)}\`);
                }
            },
            toEqual: (expected) => {
                if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                     throw new Error(\`Expected \${JSON.stringify(actual)} to equal \${JSON.stringify(expected)}\`);
                }
            },
            toThrow: (expectedMessage) => {
                let didThrow = false;
                let errorMessage = '';
                try {
                    actual();
                } catch(e) {
                    didThrow = true;
                    errorMessage = e.message;
                }
                if (!didThrow) {
                    throw new Error('Expected function to throw, but it did not.');
                }
                if (expectedMessage && !errorMessage.includes(expectedMessage)) {
                     throw new Error(\`Expected function to throw message containing "\${expectedMessage}", but got "\${errorMessage}"\`);
                }
            }
        });
        
        try {
            new Function(file.content)();
        } catch (e) {
            currentSuite.error = e.stack || e.toString();
            currentSuite.passed = false;
        }

        // Handle tests not in a describe block
        if(suites.length === 0 && currentSuite.tests.length > 0) {
            suites.push(currentSuite);
        }
        
        return suites;
    };

    for (const file of files) {
        allSuites.push(...implementation(file));
    }
    
    self.postMessage({ suites: allSuites, stats });
};
`;

export function createTestWorker() {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    return worker;
}
