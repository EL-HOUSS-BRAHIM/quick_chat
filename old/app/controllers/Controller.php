<?php
namespace QuickChat\Controllers;

use QuickChat\Services\Config;
use QuickChat\Services\Session;

/**
 * Base Controller
 * 
 * All controllers should extend this class
 */
abstract class Controller
{
    /**
     * Render a view
     * 
     * @param string $view The view name
     * @param array $data Data to pass to the view
     * @return void
     */
    protected function view(string $view, array $data = []): void
    {
        // Extract data to make variables available to the view
        extract($data);
        
        // Get the view path
        $viewPath = APP_ROOT . '/app/views/' . $view . '.php';
        
        // Check if view exists
        if (!file_exists($viewPath)) {
            throw new \RuntimeException("View not found: {$view}.php");
        }
        
        // Include the view
        require $viewPath;
    }
    
    /**
     * Redirect to a URL
     * 
     * @param string $url The URL to redirect to
     * @param int $statusCode The HTTP status code
     * @return void
     */
    protected function redirect(string $url, int $statusCode = 302): void
    {
        header("Location: {$url}", true, $statusCode);
        exit;
    }
    
    /**
     * Return a JSON response
     * 
     * @param mixed $data The data to encode as JSON
     * @param int $statusCode The HTTP status code
     * @return void
     */
    protected function json($data, int $statusCode = 200): void
    {
        // Set content type header
        header('Content-Type: application/json');
        
        // Set status code
        http_response_code($statusCode);
        
        // Encode and output the data
        echo json_encode($data);
        exit;
    }
    
    /**
     * Get request input
     * 
     * @param string $key The input key
     * @param mixed $default The default value if key doesn't exist
     * @return mixed The input value
     */
    protected function input(string $key, $default = null)
    {
        // Check POST data
        if (isset($_POST[$key])) {
            return $_POST[$key];
        }
        
        // Check GET data
        if (isset($_GET[$key])) {
            return $_GET[$key];
        }
        
        // Check JSON input
        $json = $this->getJsonInput();
        if (isset($json[$key])) {
            return $json[$key];
        }
        
        return $default;
    }
    
    /**
     * Get JSON input data
     * 
     * @return array The JSON data
     */
    protected function getJsonInput(): array
    {
        static $jsonData = null;
        
        if ($jsonData === null) {
            $input = file_get_contents('php://input');
            $jsonData = json_decode($input, true) ?? [];
        }
        
        return $jsonData;
    }
    
    /**
     * Validate input data
     * 
     * @param array $rules The validation rules
     * @return array The validation errors
     */
    protected function validate(array $rules): array
    {
        $errors = [];
        
        foreach ($rules as $field => $rule) {
            $value = $this->input($field);
            
            // Split rules
            $rulesList = explode('|', $rule);
            
            foreach ($rulesList as $ruleItem) {
                // Check for rule with parameters
                if (strpos($ruleItem, ':') !== false) {
                    list($ruleName, $ruleParam) = explode(':', $ruleItem, 2);
                } else {
                    $ruleName = $ruleItem;
                    $ruleParam = null;
                }
                
                // Apply rule
                switch ($ruleName) {
                    case 'required':
                        if ($value === null || $value === '') {
                            $errors[$field][] = "The {$field} field is required.";
                        }
                        break;
                        
                    case 'email':
                        if ($value !== null && $value !== '' && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                            $errors[$field][] = "The {$field} must be a valid email address.";
                        }
                        break;
                        
                    case 'min':
                        if ($value !== null && $value !== '' && strlen($value) < (int)$ruleParam) {
                            $errors[$field][] = "The {$field} must be at least {$ruleParam} characters.";
                        }
                        break;
                        
                    case 'max':
                        if ($value !== null && $value !== '' && strlen($value) > (int)$ruleParam) {
                            $errors[$field][] = "The {$field} may not be greater than {$ruleParam} characters.";
                        }
                        break;
                        
                    case 'alpha':
                        if ($value !== null && $value !== '' && !ctype_alpha($value)) {
                            $errors[$field][] = "The {$field} may only contain letters.";
                        }
                        break;
                        
                    case 'alphanumeric':
                        if ($value !== null && $value !== '' && !ctype_alnum($value)) {
                            $errors[$field][] = "The {$field} may only contain letters and numbers.";
                        }
                        break;
                        
                    case 'numeric':
                        if ($value !== null && $value !== '' && !is_numeric($value)) {
                            $errors[$field][] = "The {$field} must be a number.";
                        }
                        break;
                }
            }
        }
        
        return $errors;
    }
}
