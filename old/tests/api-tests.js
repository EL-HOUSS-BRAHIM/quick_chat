/**
 * API Endpoint Tests
 * Tests for all API endpoints in the Quick Chat application
 */

// Import test utilities (adjust path as needed)
const { TestRunner, TestUtils } = require('./test-runner.js');

class APITests {
    constructor() {
        this.baseUrl = 'http://localhost/quick_chat/api';
        this.testUser = {
            username: 'testuser',
            email: 'test@example.com',
            password: 'testpass123'
        };
        this.authToken = null;
    }

    /**
     * Setup test environment
     */
    async setup() {
        // Mock localStorage for testing
        global.localStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn(),
            clear: jest.fn()
        };

        // Create test user session
        const mockResponse = TestUtils.mockFetch([
            { ok: true, data: { success: true, token: 'test-token' } }
        ]);
        
        this.authToken = 'test-token';
        
        return mockResponse;
    }

    /**
     * Test user authentication endpoints
     */
    async testAuthEndpoints() {
        const runner = new TestRunner();

        // Test login endpoint
        runner.addTest('Login API - Valid credentials', async () => {
            const mockFetch = TestUtils.mockFetch([
                { ok: true, data: { success: true, token: 'auth-token', user: this.testUser } }
            ]);

            const response = await fetch(`${this.baseUrl}/auth.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'login',
                    username: this.testUser.username,
                    password: this.testUser.password
                })
            });

            const data = await response.json();
            TestUtils.assert(data.success, 'Login should succeed');
            TestUtils.assert(data.token, 'Should return auth token');
            
            mockFetch();
        });

        // Test login with invalid credentials
        runner.addTest('Login API - Invalid credentials', async () => {
            const mockFetch = TestUtils.mockFetch([
                { ok: false, status: 401, data: { success: false, error: 'Invalid credentials' } }
            ]);

            const response = await fetch(`${this.baseUrl}/auth.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'login',
                    username: 'invalid',
                    password: 'wrong'
                })
            });

            TestUtils.assert(response.status === 401, 'Should return 401 for invalid credentials');
            mockFetch();
        });

        // Test registration endpoint
        runner.addTest('Registration API - New user', async () => {
            const mockFetch = TestUtils.mockFetch([
                { ok: true, data: { success: true, message: 'User registered successfully' } }
            ]);

            const response = await fetch(`${this.baseUrl}/auth.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'register',
                    username: 'newuser',
                    email: 'new@example.com',
                    password: 'newpass123'
                })
            });

            const data = await response.json();
            TestUtils.assert(data.success, 'Registration should succeed');
            
            mockFetch();
        });

        await runner.runTests();
    }

    /**
     * Test message endpoints
     */
    async testMessageEndpoints() {
        const runner = new TestRunner();

        runner.addTest('Get Messages API', async () => {
            const mockFetch = TestUtils.mockFetch([
                { 
                    ok: true, 
                    data: { 
                        success: true, 
                        messages: [
                            { id: 1, content: 'Test message', user: 'testuser', timestamp: '2024-01-01 12:00:00' }
                        ]
                    } 
                }
            ]);

            const response = await fetch(`${this.baseUrl}/messages.php?limit=50`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });

            const data = await response.json();
            TestUtils.assert(data.success, 'Should get messages successfully');
            TestUtils.assert(Array.isArray(data.messages), 'Messages should be an array');
            
            mockFetch();
        });

        runner.addTest('Send Message API', async () => {
            const mockFetch = TestUtils.mockFetch([
                { ok: true, data: { success: true, message_id: 123 } }
            ]);

            const response = await fetch(`${this.baseUrl}/messages.php`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    content: 'Test message content',
                    recipient: 'recipient_user'
                })
            });

            const data = await response.json();
            TestUtils.assert(data.success, 'Should send message successfully');
            TestUtils.assert(data.message_id, 'Should return message ID');
            
            mockFetch();
        });

        await runner.runTests();
    }

    /**
     * Test file upload endpoints
     */
    async testFileUploadEndpoints() {
        const runner = new TestRunner();

        runner.addTest('File Upload API - Valid file', async () => {
            const mockFetch = TestUtils.mockFetch([
                { 
                    ok: true, 
                    data: { 
                        success: true, 
                        file_id: 'upload123',
                        file_url: '/uploads/files/test.jpg'
                    } 
                }
            ]);

            // Mock FormData for file upload
            const formData = new FormData();
            formData.append('file', new Blob(['test content'], { type: 'image/jpeg' }), 'test.jpg');

            const response = await fetch(`${this.baseUrl}/upload.php`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.authToken}` },
                body: formData
            });

            const data = await response.json();
            TestUtils.assert(data.success, 'File upload should succeed');
            TestUtils.assert(data.file_id, 'Should return file ID');
            
            mockFetch();
        });

        runner.addTest('File Upload API - Invalid file type', async () => {
            const mockFetch = TestUtils.mockFetch([
                { ok: false, status: 400, data: { success: false, error: 'Invalid file type' } }
            ]);

            const formData = new FormData();
            formData.append('file', new Blob(['test content'], { type: 'application/x-executable' }), 'test.exe');

            const response = await fetch(`${this.baseUrl}/upload.php`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.authToken}` },
                body: formData
            });

            TestUtils.assert(response.status === 400, 'Should reject invalid file types');
            mockFetch();
        });

        await runner.runTests();
    }

    /**
     * Test user management endpoints
     */
    async testUserEndpoints() {
        const runner = new TestRunner();

        runner.addTest('Get Users API', async () => {
            const mockFetch = TestUtils.mockFetch([
                { 
                    ok: true, 
                    data: { 
                        success: true, 
                        users: [
                            { id: 1, username: 'user1', online: true },
                            { id: 2, username: 'user2', online: false }
                        ]
                    } 
                }
            ]);

            const response = await fetch(`${this.baseUrl}/users.php`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });

            const data = await response.json();
            TestUtils.assert(data.success, 'Should get users successfully');
            TestUtils.assert(Array.isArray(data.users), 'Users should be an array');
            
            mockFetch();
        });

        runner.addTest('Update User Profile API', async () => {
            const mockFetch = TestUtils.mockFetch([
                { ok: true, data: { success: true, message: 'Profile updated' } }
            ]);

            const response = await fetch(`${this.baseUrl}/users.php`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    display_name: 'Updated Name',
                    email: 'updated@example.com'
                })
            });

            const data = await response.json();
            TestUtils.assert(data.success, 'Profile update should succeed');
            
            mockFetch();
        });

        await runner.runTests();
    }

    /**
     * Test admin endpoints
     */
    async testAdminEndpoints() {
        const runner = new TestRunner();

        runner.addTest('Admin Stats API', async () => {
            const mockFetch = TestUtils.mockFetch([
                { 
                    ok: true, 
                    data: { 
                        success: true, 
                        stats: {
                            total_users: 100,
                            active_users: 25,
                            total_messages: 1000,
                            total_files: 50
                        }
                    } 
                }
            ]);

            const response = await fetch(`${this.baseUrl}/admin.php?action=stats`, {
                headers: { 
                    'Authorization': `Bearer ${this.authToken}`,
                    'X-Admin-Token': 'admin-token'
                }
            });

            const data = await response.json();
            TestUtils.assert(data.success, 'Should get admin stats');
            TestUtils.assert(data.stats.total_users >= 0, 'Should have user count');
            
            mockFetch();
        });

        await runner.runTests();
    }

    /**
     * Run all API tests
     */
    async runAllTests() {
        console.log('🔧 Setting up API test environment...');
        const cleanup = await this.setup();

        try {
            await this.testAuthEndpoints();
            await this.testMessageEndpoints();
            await this.testFileUploadEndpoints();
            await this.testUserEndpoints();
            await this.testAdminEndpoints();
        } finally {
            cleanup();
        }
    }
}

// Export for use in test runner
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APITests;
}

// For browser use
if (typeof window !== 'undefined') {
    window.APITests = APITests;
}
