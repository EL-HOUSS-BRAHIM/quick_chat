// Entry point for Quick Chat frontend
import ChatWindow from './components/ChatWindow.js';
import MessageList from './components/MessageList.js';
import MessageInput from './components/MessageInput.js';
import Sidebar from './components/Sidebar.js';
import { apiClient } from './services/apiClient.js';
import { websocketManager } from './services/websocketManager.js';
import { store } from './state/store.js';
import { formatDate } from './utils/helpers.js';

// ...initialize app, mount components, etc...

console.log('Quick Chat frontend initialized');
