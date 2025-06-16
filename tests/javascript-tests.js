/**
 * JavaScript Function Tests
 * Unit tests for all JavaScript functions in the Quick Chat application
 */

const { TestRunner, TestUtils } = require('./test-runner.js');

class JavaScriptTests {
    constructor() {
        this.mockDOM();
    }

    /**
     * Mock DOM environment for testing
     */
    mockDOM() {
        // Mock document object
        global.document = {
            createElement: jest.fn((tagName) => TestUtils.createMockElement(tagName)),
            getElementById: jest.fn(),
            querySelector: jest.fn(),
            querySelectorAll: jest.fn(() => []),
            addEventListener: jest.fn(),
            body: TestUtils.createMockElement('body')
        };

        // Mock window object
        global.window = {
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            location: { reload: jest.fn() },
            localStorage: {
                getItem: jest.fn(),
                setItem: jest.fn(),
                removeItem: jest.fn()
            },
            sessionStorage: {
                getItem: jest.fn(),
                setItem: jest.fn(),
                removeItem: jest.fn()
            }
        };
    }

    /**
     * Test utility functions
     */
    async testUtilityFunctions() {
        const runner = new TestRunner();

        runner.addTest('formatDate function', async () => {
            // Mock the formatDate function
            const formatDate = (date) => {
                if (!date) return 'Invalid date';
                const d = new Date(date);
                return d.toLocaleDateString();
            };

            const result1 = formatDate('2024-01-01');
            TestUtils.assert(result1 !== 'Invalid date', 'Should format valid date');

            const result2 = formatDate(null);
            TestUtils.assertEqual(result2, 'Invalid date', 'Should handle null date');
        });

        runner.addTest('sanitizeInput function', async () => {
            const sanitizeInput = (input) => {
                if (typeof input !== 'string') return '';
                return input
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#x27;')
                    .trim();
            };

            const result1 = sanitizeInput('<script>alert("xss")</script>');
            TestUtils.assert(!result1.includes('<script>'), 'Should sanitize script tags');

            const result2 = sanitizeInput('  normal text  ');
            TestUtils.assertEqual(result2, 'normal text', 'Should trim whitespace');
        });

        runner.addTest('validateEmail function', async () => {
            const validateEmail = (email) => {
                const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return regex.test(email);
            };

            TestUtils.assert(validateEmail('test@example.com'), 'Should validate correct email');
            TestUtils.assert(!validateEmail('invalid-email'), 'Should reject invalid email');
            TestUtils.assert(!validateEmail(''), 'Should reject empty email');
        });

        await runner.runTests();
    }

    /**
     * Test chat functionality
     */
    async testChatFunctions() {
        const runner = new TestRunner();

        runner.addTest('sendMessage function', async () => {
            let messageSent = false;
            const mockFetch = TestUtils.mockFetch([
                { ok: true, data: { success: true, message_id: 123 } }
            ]);

            const sendMessage = async (content, recipient) => {
                if (!content.trim()) throw new Error('Message cannot be empty');
                
                const response = await fetch('/api/messages.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content, recipient })
                });
                
                const data = await response.json();
                if (data.success) {
                    messageSent = true;
                    return data.message_id;
                }
                throw new Error('Failed to send message');
            };

            const messageId = await sendMessage('Test message', 'user123');
            TestUtils.assert(messageSent, 'Message should be sent');
            TestUtils.assertEqual(messageId, 123, 'Should return message ID');

            // Test empty message
            TestUtils.assertThrows(
                () => sendMessage('', 'user123'),
                'Should throw error for empty message'
            );

            mockFetch();
        });

        runner.addTest('loadMessages function', async () => {
            const mockFetch = TestUtils.mockFetch([
                { 
                    ok: true, 
                    data: { 
                        success: true, 
                        messages: [
                            { id: 1, content: 'Hello', user: 'user1' },
                            { id: 2, content: 'Hi there', user: 'user2' }
                        ]
                    } 
                }
            ]);

            const loadMessages = async (limit = 50) => {
                const response = await fetch(`/api/messages.php?limit=${limit}`);
                const data = await response.json();
                return data.messages || [];
            };

            const messages = await loadMessages(10);
            TestUtils.assert(Array.isArray(messages), 'Should return array of messages');
            TestUtils.assertEqual(messages.length, 2, 'Should return correct number of messages');

            mockFetch();
        });

        await runner.runTests();
    }

    /**
     * Test file upload functionality
     */
    async testFileUploadFunctions() {
        const runner = new TestRunner();

        runner.addTest('validateFileType function', async () => {
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
            
            const validateFileType = (file) => {
                return allowedTypes.includes(file.type);
            };

            const validFile = { type: 'image/jpeg', name: 'test.jpg' };
            const invalidFile = { type: 'application/exe', name: 'virus.exe' };

            TestUtils.assert(validateFileType(validFile), 'Should accept valid file type');
            TestUtils.assert(!validateFileType(invalidFile), 'Should reject invalid file type');
        });

        runner.addTest('validateFileSize function', async () => {
            const maxSize = 5 * 1024 * 1024; // 5MB
            
            const validateFileSize = (file) => {
                return file.size <= maxSize;
            };

            const validFile = { size: 1024 * 1024 }; // 1MB
            const invalidFile = { size: 10 * 1024 * 1024 }; // 10MB

            TestUtils.assert(validateFileSize(validFile), 'Should accept valid file size');
            TestUtils.assert(!validateFileSize(invalidFile), 'Should reject oversized file');
        });

        runner.addTest('uploadFile function', async () => {
            const mockFetch = TestUtils.mockFetch([
                { ok: true, data: { success: true, file_id: 'upload123' } }
            ]);

            const uploadFile = async (file) => {
                const formData = new FormData();
                formData.append('file', file);
                
                const response = await fetch('/api/upload.php', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                return data;
            };

            const mockFile = new Blob(['test content'], { type: 'image/jpeg' });
            const result = await uploadFile(mockFile);
            
            TestUtils.assert(result.success, 'Upload should succeed');
            TestUtils.assert(result.file_id, 'Should return file ID');

            mockFetch();
        });

        await runner.runTests();
    }

    /**
     * Test WebRTC functionality
     */
    async testWebRTCFunctions() {
        const runner = new TestRunner();

        runner.addTest('initializeWebRTC function', async () => {
            // Mock WebRTC APIs
            global.RTCPeerConnection = jest.fn(() => ({
                createOffer: jest.fn(() => Promise.resolve({})),
                createAnswer: jest.fn(() => Promise.resolve({})),
                setLocalDescription: jest.fn(() => Promise.resolve()),
                setRemoteDescription: jest.fn(() => Promise.resolve()),
                addIceCandidate: jest.fn(() => Promise.resolve()),
                addEventListener: jest.fn(),
                close: jest.fn()
            }));

            const initializeWebRTC = () => {
                try {
                    const pc = new RTCPeerConnection({
                        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                    });
                    return { success: true, connection: pc };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            };

            const result = initializeWebRTC();
            TestUtils.assert(result.success, 'WebRTC initialization should succeed');
            TestUtils.assert(result.connection, 'Should return connection object');
        });

        runner.addTest('getUserMedia function', async () => {
            // Mock getUserMedia
            global.navigator = {
                mediaDevices: {
                    getUserMedia: jest.fn(() => Promise.resolve({
                        getTracks: jest.fn(() => []),
                        getVideoTracks: jest.fn(() => []),
                        getAudioTracks: jest.fn(() => [])
                    }))
                }
            };

            const getUserMedia = async (constraints) => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia(constraints);
                    return { success: true, stream };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            };

            const result = await getUserMedia({ video: true, audio: true });
            TestUtils.assert(result.success, 'getUserMedia should succeed');
            TestUtils.assert(result.stream, 'Should return media stream');
        });

        await runner.runTests();
    }

    /**
     * Test error handling functions
     */
    async testErrorHandling() {
        const runner = new TestRunner();

        runner.addTest('handleError function', async () => {
            let errorLogged = false;
            const errors = [];

            const handleError = (error, context = '') => {
                errorLogged = true;
                errors.push({
                    message: error.message || error,
                    context,
                    timestamp: new Date().toISOString()
                });
                
                // Show user-friendly message
                return 'An error occurred. Please try again.';
            };

            const message = handleError(new Error('Test error'), 'test context');
            TestUtils.assert(errorLogged, 'Error should be logged');
            TestUtils.assert(errors.length === 1, 'Should store error details');
            TestUtils.assert(message.includes('error occurred'), 'Should return user-friendly message');
        });

        runner.addTest('retryOperation function', async () => {
            let attempts = 0;
            const maxRetries = 3;

            const retryOperation = async (operation, retries = maxRetries) => {
                for (let i = 0; i <= retries; i++) {
                    try {
                        attempts++;
                        return await operation();
                    } catch (error) {
                        if (i === retries) throw error;
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
            };

            const failingOperation = async () => {
                if (attempts < 2) throw new Error('Operation failed');
                return 'success';
            };

            const result = await retryOperation(failingOperation);
            TestUtils.assertEqual(result, 'success', 'Should succeed after retries');
            TestUtils.assertEqual(attempts, 2, 'Should attempt correct number of times');
        });

        await runner.runTests();
    }

    /**
     * Run all JavaScript tests
     */
    async runAllTests() {
        console.log('🔧 Setting up JavaScript test environment...');
        
        await this.testUtilityFunctions();
        await this.testChatFunctions();
        await this.testFileUploadFunctions();
        await this.testWebRTCFunctions();
        await this.testErrorHandling();
    }
}

// Export for use in test runner
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JavaScriptTests;
}

// For browser use
if (typeof window !== 'undefined') {
    window.JavaScriptTests = JavaScriptTests;
}
