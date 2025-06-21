<?php
/**
 * Web Routes
 * 
 * Defines the web routes for the application
 * 
 * @var FastRoute\RouteCollector $r
 */

// Home page
$r->addRoute('GET', '/', 'HomeController@index');

// Authentication routes
$r->addRoute('GET', '/login', 'AuthController@showLogin');
$r->addRoute('POST', '/login', 'AuthController@login');
$r->addRoute('GET', '/register', 'AuthController@showRegister');
$r->addRoute('POST', '/register', 'AuthController@register');
$r->addRoute('GET', '/logout', 'AuthController@logout');
$r->addRoute('GET', '/password/forgot', 'AuthController@showForgotPassword');
$r->addRoute('POST', '/password/forgot', 'AuthController@forgotPassword');
$r->addRoute('GET', '/password/reset/{token}', 'AuthController@showResetPassword');
$r->addRoute('POST', '/password/reset', 'AuthController@resetPassword');

// Dashboard
$r->addRoute('GET', '/dashboard', 'DashboardController@index');

// User profile
$r->addRoute('GET', '/profile', 'ProfileController@show');
$r->addRoute('GET', '/profile/{username}', 'ProfileController@showUser');
$r->addRoute('GET', '/profile/edit', 'ProfileController@edit');
$r->addRoute('POST', '/profile/update', 'ProfileController@update');

// Chat routes
$r->addRoute('GET', '/chat', 'ChatController@index');
$r->addRoute('GET', '/chat/{id:\d+}', 'ChatController@show');

// Group chat routes
$r->addRoute('GET', '/group-chat', 'GroupChatController@index');
$r->addRoute('GET', '/group-chat/{id:\d+}', 'GroupChatController@show');
$r->addRoute('GET', '/group-chat/create', 'GroupChatController@create');
$r->addRoute('POST', '/group-chat/store', 'GroupChatController@store');
$r->addRoute('GET', '/group-chat/{id:\d+}/edit', 'GroupChatController@edit');
$r->addRoute('POST', '/group-chat/{id:\d+}/update', 'GroupChatController@update');
$r->addRoute('GET', '/join-group/{id:\d+}/{token}', 'GroupChatController@join');

// Admin routes
$r->addGroup('/admin', function(FastRoute\RouteCollector $r) {
    $r->addRoute('GET', '', 'AdminController@index');
    $r->addRoute('GET', '/users', 'AdminController@users');
    $r->addRoute('GET', '/users/{id:\d+}', 'AdminController@showUser');
    $r->addRoute('POST', '/users/{id:\d+}/update', 'AdminController@updateUser');
    $r->addRoute('GET', '/groups', 'AdminController@groups');
    $r->addRoute('GET', '/logs', 'AdminController@logs');
    $r->addRoute('GET', '/settings', 'AdminController@settings');
    $r->addRoute('POST', '/settings/update', 'AdminController@updateSettings');
});
