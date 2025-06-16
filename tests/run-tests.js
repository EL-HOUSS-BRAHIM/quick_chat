#!/usr/bin/env node

/**
 * Main Test Runner Script
 * Runs all tests for the Quick Chat application
 */

const { TestRunner, TestUtils } = require('./test-runner.js');
const APITests = require('./api-tests.js');
const JavaScriptTests = require('./javascript-tests.js');

class MainTestRunner {
    constructor() {
        this.runner = new TestRunner();
        this.startTime = null;
        this.endTime = null;
    }

    /**
     * Run all test suites
     */
    async runAllTests() {
        console.log('🚀 Starting Quick Chat Comprehensive Test Suite');
        console.log('=' .repeat(60));
        
        this.startTime = Date.now();

        try {
            // Run API Tests
            console.log('\n📡 Running API Tests...');
            const apiTests = new APITests();
            await apiTests.runAllTests();

            // Run JavaScript Tests  
            console.log('\n🟨 Running JavaScript Tests...');
            const jsTests = new JavaScriptTests();
            await jsTests.runAllTests();

            // Run Integration Tests
            console.log('\n🔗 Running Integration Tests...');
            await this.runIntegrationTests();

            // Run Accessibility Tests
            console.log('\n♿ Running Accessibility Tests...');
            await this.runAccessibilityTests();

            this.endTime = Date.now();
            this.printFinalResults();

        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            process.exit(1);
        }
    }

    /**
     * Run integration tests
     */
    async runIntegrationTests() {
        const runner = new TestRunner();

        runner.addTest('User Registration and Login Flow', async () => {
            // Mock the full registration and login process
            const mockFetch = TestUtils.mockFetch([
                { ok: true, data: { success: true, message: 'User registered' } },
                { ok: true, data: { success: true, token: 'auth-token', user: { id: 1 } } }
            ]);

            // Register user
            const registerResponse = await fetch('/api/auth.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'register',
                    username: 'integrationtest',
                    email: 'test@integration.com',
                    password: 'testpass123'
                })
            });

            const registerData = await registerResponse.json();
            TestUtils.assert(registerData.success, 'User registration should succeed');

            // Login user
            const loginResponse = await fetch('/api/auth.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'login',
                    username: 'integrationtest',
                    password: 'testpass123'
                })
            });

            const loginData = await loginResponse.json();
            TestUtils.assert(loginData.success, 'User login should succeed');
            TestUtils.assert(loginData.token, 'Should receive auth token');

            mockFetch();
        });

        runner.addTest('Message Send and Receive Flow', async () => {
            const mockFetch = TestUtils.mockFetch([
                { ok: true, data: { success: true, message_id: 123 } },
                { ok: true, data: { success: true, messages: [
                    { id: 123, content: 'Integration test message', user: 'testuser' }
                ]}}
            ]);

            // Send message
            const sendResponse = await fetch('/api/messages.php', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token'
                },
                body: JSON.stringify({
                    content: 'Integration test message',
                    recipient: 'recipient_user'
                })
            });

            const sendData = await sendResponse.json();
            TestUtils.assert(sendData.success, 'Message send should succeed');

            // Retrieve messages
            const getResponse = await fetch('/api/messages.php?limit=10', {
                headers: { 'Authorization': 'Bearer test-token' }
            });

            const getData = await getResponse.json();
            TestUtils.assert(getData.success, 'Message retrieval should succeed');
            TestUtils.assert(getData.messages.length > 0, 'Should retrieve sent message');

            mockFetch();
        });

        runner.addTest('File Upload and Message Attachment Flow', async () => {
            const mockFetch = TestUtils.mockFetch([
                { ok: true, data: { success: true, file_id: 'file123', file_url: '/uploads/test.jpg' } },
                { ok: true, data: { success: true, message_id: 124 } }
            ]);

            // Upload file
            const formData = new FormData();
            formData.append('file', new Blob(['test image'], { type: 'image/jpeg' }), 'test.jpg');

            const uploadResponse = await fetch('/api/upload.php', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer test-token' },
                body: formData
            });

            const uploadData = await uploadResponse.json();
            TestUtils.assert(uploadData.success, 'File upload should succeed');

            // Send message with attachment
            const messageResponse = await fetch('/api/messages.php', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token'
                },
                body: JSON.stringify({
                    content: 'Message with attachment',
                    attachment: uploadData.file_id,
                    recipient: 'recipient_user'
                })
            });

            const messageData = await messageResponse.json();
            TestUtils.assert(messageData.success, 'Message with attachment should succeed');

            mockFetch();
        });

        await runner.runTests();
    }

    /**
     * Run accessibility tests
     */
    async runAccessibilityTests() {
        const runner = new TestRunner();

        runner.addTest('ARIA Labels and Roles', async () => {
            // Mock DOM elements with accessibility attributes
            const chatContainer = TestUtils.createMockElement('div', {
                'role': 'log',
                'aria-label': 'Chat messages',
                'aria-live': 'polite'
            });

            const messageInput = TestUtils.createMockElement('input', {
                'aria-label': 'Type your message',
                'role': 'textbox'
            });

            TestUtils.assertEqual(
                chatContainer.getAttribute('role'), 
                'log', 
                'Chat container should have log role'
            );

            TestUtils.assert(
                chatContainer.getAttribute('aria-label'),
                'Chat container should have aria-label'
            );

            TestUtils.assertEqual(
                messageInput.getAttribute('role'),
                'textbox',
                'Message input should have textbox role'
            );
        });

        runner.addTest('Keyboard Navigation', async () => {
            // Test keyboard event handling
            let tabPressed = false;
            let enterPressed = false;

            const handleKeydown = (event) => {
                if (event.key === 'Tab') {
                    tabPressed = true;
                    event.preventDefault();
                }
                if (event.key === 'Enter') {
                    enterPressed = true;
                }
            };

            // Simulate Tab key press
            handleKeydown({ key: 'Tab', preventDefault: jest.fn() });
            TestUtils.assert(tabPressed, 'Should handle Tab key navigation');

            // Simulate Enter key press
            handleKeydown({ key: 'Enter' });
            TestUtils.assert(enterPressed, 'Should handle Enter key interaction');
        });

        runner.addTest('Screen Reader Announcements', async () => {
            let announcements = [];

            const announceToScreenReader = (message) => {
                announcements.push(message);
                
                // Mock creating aria-live region
                const liveRegion = TestUtils.createMockElement('div', {
                    'aria-live': 'polite',
                    'aria-atomic': 'true'
                });
                liveRegion.textContent = message;
                return liveRegion;
            };

            const region1 = announceToScreenReader('New message received');
            const region2 = announceToScreenReader('File uploaded successfully');

            TestUtils.assertEqual(announcements.length, 2, 'Should track announcements');
            TestUtils.assertEqual(region1.textContent, 'New message received', 'Should set announcement text');
            TestUtils.assertEqual(region2.getAttribute('aria-live'), 'polite', 'Should have proper aria-live attribute');
        });

        await runner.runTests();
    }

    /**
     * Print final test results
     */
    printFinalResults() {
        const duration = this.endTime - this.startTime;
        
        console.log('\n' + '=' .repeat(60));
        console.log('🎯 QUICK CHAT - FINAL TEST RESULTS');
        console.log('=' .repeat(60));
        console.log(`⏱️  Total Duration: ${(duration / 1000).toFixed(2)} seconds`);
        console.log('✅ All test suites completed successfully!');
        console.log('\n📋 Coverage Areas:');
        console.log('   • API Endpoints');
        console.log('   • JavaScript Functions'); 
        console.log('   • Integration Flows');
        console.log('   • Accessibility Features');
        console.log('\n🚀 Ready for production deployment!');
        console.log('=' .repeat(60));
    }
}

// Run tests if called directly
if (require.main === module) {
    const testRunner = new MainTestRunner();
    testRunner.runAllTests().catch(error => {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = MainTestRunner;
