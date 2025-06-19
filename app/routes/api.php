<?php
/**
 * API Routes
 * 
 * Defines the API routes for the application
 * 
 * @var FastRoute\RouteCollector $r
 */

// API version 1 routes
$r->addGroup('/api/v1', function(FastRoute\RouteCollector $r) {
    // Authentication
    $r->addRoute('POST', '/auth/login', 'Api\AuthController@login');
    $r->addRoute('POST', '/auth/register', 'Api\AuthController@register');
    $r->addRoute('POST', '/auth/logout', 'Api\AuthController@logout');
    $r->addRoute('POST', '/auth/refresh', 'Api\AuthController@refresh');
    $r->addRoute('GET', '/auth/user', 'Api\AuthController@user');
    
    // Users
    $r->addRoute('GET', '/users', 'Api\UsersController@index');
    $r->addRoute('GET', '/users/{id:\d+}', 'Api\UsersController@show');
    $r->addRoute('GET', '/users/search/{query}', 'Api\UsersController@search');
    $r->addRoute('PUT', '/users/{id:\d+}', 'Api\UsersController@update');
    $r->addRoute('POST', '/users/avatar', 'Api\UsersController@updateAvatar');
    
    // Messages
    $r->addRoute('GET', '/messages/{userId:\d+}', 'Api\MessagesController@index');
    $r->addRoute('POST', '/messages', 'Api\MessagesController@store');
    $r->addRoute('PUT', '/messages/{id:\d+}', 'Api\MessagesController@update');
    $r->addRoute('DELETE', '/messages/{id:\d+}', 'Api\MessagesController@destroy');
    $r->addRoute('GET', '/messages/paginated/{userId:\d+}', 'Api\MessagesController@paginated');
    
    // Message reactions
    $r->addRoute('POST', '/messages/{id:\d+}/reaction', 'Api\MessageReactionsController@store');
    $r->addRoute('DELETE', '/messages/{id:\d+}/reaction/{type}', 'Api\MessageReactionsController@destroy');
    
    // Groups
    $r->addRoute('GET', '/groups', 'Api\GroupsController@index');
    $r->addRoute('POST', '/groups', 'Api\GroupsController@store');
    $r->addRoute('GET', '/groups/{id:\d+}', 'Api\GroupsController@show');
    $r->addRoute('PUT', '/groups/{id:\d+}', 'Api\GroupsController@update');
    $r->addRoute('DELETE', '/groups/{id:\d+}', 'Api\GroupsController@destroy');
    $r->addRoute('POST', '/groups/{id:\d+}/members', 'Api\GroupsController@addMember');
    $r->addRoute('DELETE', '/groups/{id:\d+}/members/{userId:\d+}', 'Api\GroupsController@removeMember');
    
    // Group messages
    $r->addRoute('GET', '/groups/{id:\d+}/messages', 'Api\GroupMessagesController@index');
    $r->addRoute('POST', '/groups/{id:\d+}/messages', 'Api\GroupMessagesController@store');
    $r->addRoute('PUT', '/groups/{id:\d+}/messages/{messageId:\d+}', 'Api\GroupMessagesController@update');
    $r->addRoute('DELETE', '/groups/{id:\d+}/messages/{messageId:\d+}', 'Api\GroupMessagesController@destroy');
    
    // Group invites
    $r->addRoute('POST', '/groups/{id:\d+}/invites', 'Api\GroupInvitesController@store');
    $r->addRoute('GET', '/groups/invites', 'Api\GroupInvitesController@pending');
    $r->addRoute('POST', '/groups/invites/{id:\d+}/accept', 'Api\GroupInvitesController@accept');
    $r->addRoute('POST', '/groups/invites/{id:\d+}/reject', 'Api\GroupInvitesController@reject');
    
    // Group moderation
    $r->addRoute('POST', '/groups/{id:\d+}/moderate/mute/{userId:\d+}', 'Api\GroupModerationController@mute');
    $r->addRoute('POST', '/groups/{id:\d+}/moderate/unmute/{userId:\d+}', 'Api\GroupModerationController@unmute');
    $r->addRoute('POST', '/groups/{id:\d+}/moderate/ban/{userId:\d+}', 'Api\GroupModerationController@ban');
    $r->addRoute('POST', '/groups/{id:\d+}/moderate/unban/{userId:\d+}', 'Api\GroupModerationController@unban');
    
    // File uploads
    $r->addRoute('POST', '/upload/image', 'Api\UploadController@image');
    $r->addRoute('POST', '/upload/file', 'Api\UploadController@file');
    $r->addRoute('POST', '/upload/audio', 'Api\UploadController@audio');
    $r->addRoute('POST', '/upload/video', 'Api\UploadController@video');
    
    // WebRTC signaling
    $r->addRoute('GET', '/webrtc/turn', 'Api\WebRtcController@getTurnCredentials');
});
