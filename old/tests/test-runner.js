/**
 * Test Runner for Quick Chat Application
 * Provides comprehensive testing infrastructure for all components
 */

class TestRunner {
    constructor() {
        this.tests = [];
        this.results = {
            passed: 0,
            failed: 0,
            skipped: 0,
            total: 0
        };
        this.startTime = null;
        this.endTime = null;
    }

    /**
     * Add a test suite to the runner
     */
    addSuite(name, testFunction) {
        this.tests.push({
            name,
            test: testFunction,
            type: 'suite'
        });
    }

    /**
     * Add a single test to the runner
     */
    addTest(name, testFunction, options = {}) {
        this.tests.push({
            name,
            test: testFunction,
            type: 'test',
            timeout: options.timeout || 5000,
            skip: options.skip || false
        });
    }

    /**
     * Run all tests
     */
    async runTests() {
        this.startTime = Date.now();
        console.log('🧪 Starting Quick Chat Test Suite');
        console.log('=' .repeat(50));

        for (const test of this.tests) {
            await this.runSingleTest(test);
        }

        this.endTime = Date.now();
        this.printResults();
    }

    /**
     * Run a single test
     */
    async runSingleTest(testItem) {
        const { name, test, type, timeout = 5000, skip = false } = testItem;

        if (skip) {
            console.log(`⏭️  SKIP: ${name}`);
            this.results.skipped++;
            this.results.total++;
            return;
        }

        try {
            console.log(`🔄 Running: ${name}`);
            
            // Set timeout for test
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Test timeout')), timeout);
            });

            await Promise.race([test(), timeoutPromise]);
            
            console.log(`✅ PASS: ${name}`);
            this.results.passed++;
        } catch (error) {
            console.log(`❌ FAIL: ${name}`);
            console.log(`   Error: ${error.message}`);
            if (error.stack) {
                console.log(`   Stack: ${error.stack.split('\n')[1]?.trim()}`);
            }
            this.results.failed++;
        }

        this.results.total++;
    }

    /**
     * Print test results summary
     */
    printResults() {
        const duration = this.endTime - this.startTime;
        console.log('\n' + '=' .repeat(50));
        console.log('📊 Test Results Summary');
        console.log('=' .repeat(50));
        console.log(`Total Tests: ${this.results.total}`);
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`⏭️  Skipped: ${this.results.skipped}`);
        console.log(`⏱️  Duration: ${duration}ms`);
        
        const successRate = this.results.total > 0 
            ? ((this.results.passed / this.results.total) * 100).toFixed(1)
            : 0;
        console.log(`📈 Success Rate: ${successRate}%`);

        if (this.results.failed > 0) {
            console.log('\n❌ Some tests failed!');
            process.exit(1);
        } else {
            console.log('\n🎉 All tests passed!');
        }
    }
}

/**
 * Test utilities and assertions
 */
class TestUtils {
    static assert(condition, message = 'Assertion failed') {
        if (!condition) {
            throw new Error(message);
        }
    }

    static assertEqual(actual, expected, message = 'Values are not equal') {
        if (actual !== expected) {
            throw new Error(`${message}. Expected: ${expected}, Actual: ${actual}`);
        }
    }

    static assertNotEqual(actual, expected, message = 'Values should not be equal') {
        if (actual === expected) {
            throw new Error(`${message}. Both values are: ${actual}`);
        }
    }

    static assertThrows(fn, message = 'Function should throw an error') {
        let threw = false;
        try {
            fn();
        } catch (e) {
            threw = true;
        }
        if (!threw) {
            throw new Error(message);
        }
    }

    static async assertAsync(asyncFn, message = 'Async assertion failed') {
        try {
            const result = await asyncFn();
            this.assert(result, message);
        } catch (error) {
            throw new Error(`${message}: ${error.message}`);
        }
    }

    /**
     * Mock fetch for API testing
     */
    static mockFetch(responses) {
        const originalFetch = global.fetch;
        let callCount = 0;

        global.fetch = jest.fn((url, options) => {
            const response = responses[callCount] || responses[responses.length - 1];
            callCount++;
            
            return Promise.resolve({
                ok: response.ok !== false,
                status: response.status || 200,
                json: () => Promise.resolve(response.data || {}),
                text: () => Promise.resolve(response.text || ''),
                blob: () => Promise.resolve(new Blob([response.blob || '']))
            });
        });

        return () => {
            global.fetch = originalFetch;
        };
    }

    /**
     * Create a mock DOM element
     */
    static createMockElement(tagName, attributes = {}) {
        const element = {
            tagName: tagName.toUpperCase(),
            attributes: { ...attributes },
            children: [],
            innerHTML: '',
            textContent: '',
            classList: {
                add: jest.fn(),
                remove: jest.fn(),
                contains: jest.fn(),
                toggle: jest.fn()
            },
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            getAttribute: jest.fn((name) => element.attributes[name]),
            setAttribute: jest.fn((name, value) => {
                element.attributes[name] = value;
            }),
            appendChild: jest.fn((child) => {
                element.children.push(child);
            }),
            querySelector: jest.fn(),
            querySelectorAll: jest.fn(() => [])
        };
        return element;
    }
}

// Export for use in other test files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TestRunner, TestUtils };
}

// For browser use
if (typeof window !== 'undefined') {
    window.TestRunner = TestRunner;
    window.TestUtils = TestUtils;
}
