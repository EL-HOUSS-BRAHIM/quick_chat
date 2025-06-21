<?php
namespace QuickChat\Controllers\Api;

use QuickChat\Controllers\Controller;
use QuickChat\Services\Logger;

/**
 * API Controller
 * 
 * Base controller for API endpoints
 */
abstract class ApiController extends Controller
{
    /**
     * Return a success response
     * 
     * @param mixed $data The data to include in the response
     * @param int $statusCode The HTTP status code
     * @return void
     */
    protected function success($data = null, int $statusCode = 200): void
    {
        $response = [
            'status' => 'success',
            'data' => $data
        ];
        
        $this->json($response, $statusCode);
    }
    
    /**
     * Return an error response
     * 
     * @param string $message The error message
     * @param array $errors Detailed errors
     * @param int $statusCode The HTTP status code
     * @return void
     */
    protected function error(string $message, array $errors = [], int $statusCode = 400): void
    {
        $response = [
            'status' => 'error',
            'message' => $message
        ];
        
        if (!empty($errors)) {
            $response['errors'] = $errors;
        }
        
        // Log the error for server errors
        if ($statusCode >= 500) {
            Logger::error('API Error: ' . $message, [
                'errors' => $errors,
                'status_code' => $statusCode,
                'uri' => $_SERVER['REQUEST_URI'],
                'method' => $_SERVER['REQUEST_METHOD']
            ]);
        }
        
        $this->json($response, $statusCode);
    }
    
    /**
     * Return a validation error response
     * 
     * @param array $errors The validation errors
     * @return void
     */
    protected function validationError(array $errors): void
    {
        $this->error('Validation failed', $errors, 422);
    }
    
    /**
     * Return a not found error response
     * 
     * @param string $message The error message
     * @return void
     */
    protected function notFound(string $message = 'Resource not found'): void
    {
        $this->error($message, [], 404);
    }
    
    /**
     * Return an unauthorized error response
     * 
     * @param string $message The error message
     * @return void
     */
    protected function unauthorized(string $message = 'Unauthorized'): void
    {
        $this->error($message, [], 401);
    }
    
    /**
     * Return a forbidden error response
     * 
     * @param string $message The error message
     * @return void
     */
    protected function forbidden(string $message = 'Forbidden'): void
    {
        $this->error($message, [], 403);
    }
}
