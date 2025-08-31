/**
 * Black Cat Chat Widget
 * A standalone chat widget that can be embedded in any project
 * 
 * Usage:
 * 1. Include this file in your project
 * 2. Call initChat() to add the chat button to your page
 * 3. Users can click the button to open/close the full-screen chat
 */

(function() {
    'use strict';
    
    let chatButton = null;
    let chatOverlay = null;
    let isOpen = false;
    
    // Chat state variables
    let ws = null;
    let messagesDiv = null;
    let messageInput = null;
    let sendBtn = null;
    let statusDiv = null;
    let usersDiv = null;
    let userId = null;
    let userDisplayName = null;
    let reconnectAttempts = 0;
    let isEditingName = false;
    let onlineUsers = new Map();
    let pingInterval = null;
    let cleanupInterval = null;
    
    const maxReconnectAttempts = 5;
    const PING_INTERVAL = 3000;
    const USER_TIMEOUT = 10000;
    
    // CSS styles for the chat
    const chatStyles = `
        .chat-widget-button {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, #0f8, #0a6);
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .chat-widget-button:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(0, 255, 136, 0.4);
        }
        
        .chat-widget-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: #111;
            z-index: 10000;
            display: none;
            font-family: monospace;
            color: #fff;
        }
        
        .chat-widget-overlay.open {
            display: block;
        }
        
        .chat-widget-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            background: #1a1a1a;
            border-bottom: 1px solid #333;
        }
        
        .chat-widget-title {
            font-size: 18px;
            font-weight: bold;
            color: #0f8;
        }
        
        .chat-widget-close {
            background: none;
            border: none;
            color: #f44;
            font-size: 24px;
            cursor: pointer;
            padding: 5px;
            border-radius: 3px;
        }
        
        .chat-widget-close:hover {
            background: #333;
        }
        
        .chat-widget-app {
            display: flex;
            height: calc(100vh - 70px);
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .chat-widget-main {
            display: flex;
            flex-direction: column;
            flex: 1;
            padding: 10px;
            box-sizing: border-box;
            min-width: 0;
        }
        
        .chat-widget-sidebar {
            width: 200px;
            background: #1a1a1aaa;
            border-left: 1px solid #333;
            padding: 10px;
            box-sizing: border-box;
        }
        
        .chat-widget-messages {
            flex: 1;
            overflow-y: auto;
            padding: 10px;
            border: 1px solid #333;
            background: #222222aa;
            margin-bottom: 10px;
            border-radius: 4px;
        }
        
        .chat-widget-message {
            margin: 8px 0;
            padding: 8px;
            border-left: 3px solid #0f8;
            background: #333;
            border-radius: 3px;
        }
        
        .chat-widget-message.own {
            border-left-color: #08f;
            background: #2a2a3a;
            margin-left: 20px;
        }
        
        .chat-widget-message.system {
            border-left-color: #f80;
            font-style: italic;
        }
        
        .chat-widget-message-header {
            display: flex;
            justify-content: flex-start;
            align-items: center;
            margin-bottom: 4px;
            gap: 8px;
        }
        
        .chat-widget-message-time {
            font-size: 11px;
            color: #888;
            font-weight: normal;
        }
        
        .chat-widget-message-content {
            line-height: 1.3;
            color: #ccc;
        }
        
        .chat-widget-input-area {
            display: flex;
            gap: 10px;
            margin-bottom: 5px;
        }
        
        .chat-widget-message-input {
            flex: 1;
            padding: 10px;
            background: #333;
            border: 1px solid #555;
            color: #fff;
            border-radius: 4px;
            font-family: monospace;
        }
        
        .chat-widget-send-btn {
            padding: 10px 20px;
            background: #0f8;
            color: #000;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-family: monospace;
            font-weight: bold;
        }
        
        .chat-widget-send-btn:hover {
            background: #0a6;
        }
        
        .chat-widget-send-btn:disabled {
            background: #555;
            cursor: not-allowed;
        }
        
        .chat-widget-status {
            text-align: center;
            padding: 8px;
            font-size: 12px;
            color: #f80;
            background: #2a2a2a;
            border-radius: 4px;
            margin-bottom: 10px;
            border: 1px solid #444;
        }
        
        .chat-widget-users-header {
            font-weight: bold;
            margin-bottom: 10px;
            padding: 8px;
            background: #333;
            border-radius: 4px;
            text-align: center;
            color: #0f8;
        }
        
        .chat-widget-user-item {
            padding: 5px 8px;
            margin: 2px 0;
            background: #2a2a2a;
            border-radius: 3px;
            border-left: 3px solid #555;
            font-size: 12px;
        }
        
        .chat-widget-user-item.self {
            border-left-color: #08f;
            background: #2a2a3a;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        
        .chat-widget-user-edit-btn {
            background: none;
            border: none;
            color: #08f;
            cursor: pointer;
            font-size: 10px;
            padding: 2px 4px;
            border-radius: 2px;
            margin-left: 5px;
        }
        
        .chat-widget-user-edit-btn:hover {
            background: #333;
        }
        
        .chat-widget-user-name-input {
            background: #333;
            border: 1px solid #08f;
            color: #fff;
            border-radius: 2px;
            font-family: monospace;
            font-size: 12px;
            padding: 2px 4px;
            width: 80px;
        }
        
        .chat-background {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 0;
            overflow: hidden;
        }
        
        .chat-silhouette {
            position: absolute;
            width: 80px;
            height: 80px;
            opacity: 1;
            pointer-events: none;
        }
        
        @media (max-width: 768px) {
            .chat-widget-app {
                flex-direction: column;
            }
            
            .chat-widget-sidebar {
                width: 100%;
                height: 150px;
                border-left: none;
                border-top: 1px solid #333;
                order: 2;
            }
            
            .chat-widget-main {
                order: 1;
            }
        }
    `;
    
    function generateUserId() {
        return 'user_' + Math.random().toString(36).substring(2, 11);
    }
    
    function generateDisplayName() {
        const adjectives = ["Shadow", "Midnight", "Silent", "Swift", "Dark", "Sleek", "Mystic", "Sneaky"];
        const nouns = ["Cat", "Kitten", "Feline", "Paws", "Whiskers", "Panther", "Lynx", "Tiger"];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        return adj + noun;
    }
    
    function getOrCreateDisplayName() {
        const stored = localStorage.getItem('chat-display-name');
        if (stored) {
            return stored.slice(0, 10);
        }
        
        const newName = generateDisplayName();
        localStorage.setItem('chat-display-name', newName);
        return newName;
    }
    
    function setDisplayName(name) {
        const trimmedName = name.trim();
        if (trimmedName.length === 0) return;
        
        const truncatedName = trimmedName.slice(0, 10);
        userDisplayName = truncatedName;
        localStorage.setItem('chat-display-name', truncatedName);
        
        if (!isEditingName) {
            updateUsersList();
        }
    }
    
    function createCatBackground() {
        if (document.querySelector('.chat-background')) return;
        
        const backgroundDiv = document.createElement('div');
        backgroundDiv.className = 'chat-background';
        chatOverlay.appendChild(backgroundDiv);
        
        const catSvg = "m463 37-30 51-7-3c-27-8-72-7-98 1l-7 2-28-49c-34 69-33 118-15 149 18 33 57 49 99 48 49-1 89-20 107-54 17-32 16-81-21-145zM324 138c18 0 29 15 31 36-37 18-54 4-61-26 12-7 22-10 30-10zm109 0c9 0 19 3 30 10-7 30-24 44-61 26 2-21 13-36 31-36zm-293 51h-4c-30 0-56 10-76 26-43 36-57 101-13 166 21 34 45 55 71 65 33 12 67 8 100 4 33-5 66-11 97-9s62 10 91 41c19 22 46-1 23-24-35-34-72-47-109-50-37-2-72 5-104 9-32 5-60 7-85-2-14-6-28-15-41-31h351c14-53 15-107 2-142-19 8-42 12-66 13-30 0-59-7-83-23a426 426 0 0 0-14 10l-6 4-5-5c-47-37-91-52-129-52z";
        
        const placedCats = [];
        const minDistance = 120;
        const maxAttempts = 50;
        const numCats = 40;
        
        for (let i = 0; i < numCats; i++) {
            let placed = false;
            let attempts = 0;
            let x = 0, y = 0, scale = 1;
            
            while (!placed && attempts < maxAttempts) {
                x = Math.random() * (window.innerWidth - 160);
                y = Math.random() * (window.innerHeight - 160);
                scale = 1 + Math.random();
                
                const effectiveRadius = (80 * scale) / 2;
                let overlaps = false;
                
                for (const existing of placedCats) {
                    const existingRadius = (80 * existing.scale) / 2;
                    const distance = Math.sqrt(Math.pow(x - existing.x, 2) + Math.pow(y - existing.y, 2));
                    
                    if (distance < minDistance + effectiveRadius + existingRadius) {
                        overlaps = true;
                        break;
                    }
                }
                
                if (!overlaps) {
                    placed = true;
                    placedCats.push({x, y, scale});
                }
                attempts++;
            }
            
            if (!placed) continue;
            
            const catElement = document.createElement('div');
            catElement.className = 'chat-silhouette';
            
            const rotation = (Math.random() - 0.5) * 30;
            
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 512 512');
            svg.style.width = '100%';
            svg.style.height = '100%';
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('fill', '#222');
            path.setAttribute('d', catSvg);
            path.setAttribute('transform', 'translate(0 1)');
            
            svg.appendChild(path);
            catElement.appendChild(svg);
            
            catElement.style.left = `${x}px`;
            catElement.style.top = `${y}px`;
            catElement.style.transform = `rotate(${rotation}deg) scale(${scale})`;
            
            backgroundDiv.appendChild(catElement);
        }
    }
    
    function connect() {
        try {
            const wsUrl = location.protocol === 'https:' 
                ? 'wss://relay.js13kgames.com/cat-chat'
                : 'ws://localhost:8080/cat-chat';
            
            ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                updateStatus('Connected', '#0f8');
                reconnectAttempts = 0;
                sendBtn.disabled = false;
                addSystemMessage('Connected to chat server');
                addTestMessages();
                startPingSystem();
            };
            
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    handleMessage(data);
                } catch (e) {
                    console.error('Failed to parse message:', e);
                }
            };
            
            ws.onclose = () => {
                updateStatus('Disconnected', '#f80');
                sendBtn.disabled = true;
                addSystemMessage('Disconnected from server');
                stopPingSystem();
                onlineUsers.clear();
                updateUsersList();
                attemptReconnect();
            };
            
            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                addSystemMessage('Connection error occurred');
            };
            
        } catch (error) {
            console.error('Failed to connect:', error);
            updateStatus('Connection Failed', '#f44');
            addSystemMessage('Failed to connect to server');
        }
    }
    
    function startPingSystem() {
        pingInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                const pingMessage = {
                    id: Date.now().toString(),
                    user: userId,
                    message: userDisplayName,
                    timestamp: Date.now(),
                    type: 'ping'
                };
                ws.send(JSON.stringify(pingMessage));
            }
        }, PING_INTERVAL);
        
        cleanupInterval = setInterval(() => {
            cleanupInactiveUsers();
        }, 2000);
    }
    
    function stopPingSystem() {
        if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
        }
        if (cleanupInterval) {
            clearInterval(cleanupInterval);
            cleanupInterval = null;
        }
    }
    
    function cleanupInactiveUsers() {
        const now = Date.now();
        let usersRemoved = false;
        
        for (const [userId, user] of onlineUsers) {
            if (now - user.lastPing > USER_TIMEOUT) {
                onlineUsers.delete(userId);
                usersRemoved = true;
            }
        }
        
        if (usersRemoved) {
            updateUsersList();
        }
    }
    
    function sendMessage() {
        const text = messageInput.value.trim();
        if (!text || !ws || ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        const message = {
            id: Date.now().toString(),
            user: userId,
            message: text,
            timestamp: Date.now(),
            type: 'user'
        };
        
        addUserMessage(message.user, message.message, message.timestamp);
        ws.send(JSON.stringify(message));
        messageInput.value = '';
    }
    
    function handleMessage(data) {
        if (data.type === 'system') {
            addSystemMessage(data.message);
        } else if (data.type === 'ping') {
            handlePing(data);
        } else if (data.type === 'leave') {
            handleLeave(data);
        } else {
            addUserMessage(data.user, data.message, data.timestamp);
        }
    }
    
    function handlePing(data) {
        if (data.user === userId) return;
        
        const truncatedDisplayName = data.message.slice(0, 10);
        
        onlineUsers.set(data.user, {
            id: data.user,
            lastPing: data.timestamp,
            displayName: truncatedDisplayName
        });
        
        updateUsersList();
    }
    
    function handleLeave(data) {
        if (data.user === userId) return;
        
        const user = onlineUsers.get(data.user);
        if (user) {
            onlineUsers.delete(data.user);
            updateUsersList();
        }
    }
    
    function sendLeaveMessage() {
        if (ws && ws.readyState === WebSocket.OPEN) {
            const leaveMessage = {
                id: Date.now().toString(),
                user: userId,
                message: userDisplayName,
                timestamp: Date.now(),
                type: 'leave'
            };
            ws.send(JSON.stringify(leaveMessage));
        }
    }
    
    function addUserMessage(user, message, timestamp) {
        const messageDiv = document.createElement('div');
        const isOwnMessage = user === userId;
        messageDiv.className = isOwnMessage ? 'chat-widget-message own' : 'chat-widget-message';
        
        const time = new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        
        const truncatedMessage = message.length > 200 ? message.slice(0, 200) + '...' : message;
        
        let displayName;
        if (isOwnMessage) {
            displayName = 'You';
        } else {
            const onlineUser = onlineUsers.get(user);
            displayName = onlineUser ? onlineUser.displayName : user.split('_')[1] || user;
        }
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'chat-widget-message-header';
        headerDiv.innerHTML = `<strong>${displayName}</strong> <span class="chat-widget-message-time">${time}</span>`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'chat-widget-message-content';
        contentDiv.textContent = truncatedMessage;
        
        messageDiv.appendChild(headerDiv);
        messageDiv.appendChild(contentDiv);
        
        messagesDiv.appendChild(messageDiv);
        scrollToBottom();
    }
    
    function addSystemMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-widget-message system';
        messageDiv.textContent = message;
        
        messagesDiv.appendChild(messageDiv);
        scrollToBottom();
    }
    
    function updateStatus(status, color) {
        statusDiv.textContent = status;
        statusDiv.style.color = color;
        
        if (status === 'Connected') {
            statusDiv.style.display = 'none';
        } else {
            statusDiv.style.display = 'block';
        }
    }
    
    function scrollToBottom() {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function addTestMessages() {
        const testMessages = [
            "Purr-fect! How's everyone's game development prowling along? 🐾",
            "Just implemented some cat-like stealth mechanics!",
            "Anyone know how to squeeze more into the 13KB limit? Every byte counts!",
            "This chat has such sleek, dark vibes 🌙",
            "Working on a sneaky puzzle game, very cat-like!",
            "Canvas rendering can be as tricky as catching a laser pointer",
            "Love the midnight aesthetic of this interface",
            "Has anyone tried adding feline grace to their animations?",
            "13KB is like fitting a whole cat into a tiny box - challenging but doable!"
        ];
        
        const testUsers = ["NightProwler", "WhiskerDev", "ShadowCoder", "MidnightHacker", "StealthyCat"];
        
        const messageCount = 3 + Math.floor(Math.random() * 3);
        const now = Date.now();
        
        for (let i = 0; i < messageCount; i++) {
            let user;
            let randomMessage;
            const timestamp = now - (messageCount - i) * 60000;
            
            if (i === Math.floor(messageCount / 2)) {
                user = userId;
                randomMessage = testMessages[Math.floor(Math.random() * testMessages.length)];
            } else {
                const randomUser = testUsers[Math.floor(Math.random() * testUsers.length)];
                user = `user_${randomUser}`;
                randomMessage = testMessages[Math.floor(Math.random() * testMessages.length)];
                
                onlineUsers.set(user, {
                    id: user,
                    lastPing: timestamp,
                    displayName: randomUser
                });
            }
            
            addUserMessage(user, randomMessage, timestamp);
        }
        
        updateUsersList();
    }
    
    function startNameEdit(selfDiv, nameSpan, editBtn) {
        isEditingName = true;
        
        const input = document.createElement('input');
        input.className = 'chat-widget-user-name-input';
        input.type = 'text';
        input.value = userDisplayName;
        input.maxLength = 10;
        
        const finishEdit = () => {
            isEditingName = false;
            const newName = input.value.trim();
            if (newName.length > 0) {
                setDisplayName(newName);
            }
            nameSpan.textContent = `${userDisplayName} (You)`;
            selfDiv.replaceChild(nameSpan, input);
            selfDiv.appendChild(editBtn);
            updateUsersList();
        };
        
        const cancelEdit = () => {
            isEditingName = false;
            nameSpan.textContent = `${userDisplayName} (You)`;
            selfDiv.replaceChild(nameSpan, input);
            selfDiv.appendChild(editBtn);
        };
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                finishEdit();
            } else if (e.key === 'Escape') {
                cancelEdit();
            }
        });
        
        input.addEventListener('blur', finishEdit);
        
        selfDiv.replaceChild(input, nameSpan);
        selfDiv.removeChild(editBtn);
        input.focus();
        input.select();
    }
    
    function updateUsersList() {
        if (isEditingName) return;
        
        const userCount = onlineUsers.size + 1;
        const userCountText = `Online (${userCount})`;
        
        let usersList = document.createElement('div');
        usersList.innerHTML = `<div class="chat-widget-users-header">${userCountText}</div>`;
        
        const selfDiv = document.createElement('div');
        selfDiv.className = 'chat-widget-user-item self';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${userDisplayName} (You)`;
        
        const editBtn = document.createElement('button');
        editBtn.className = 'chat-widget-user-edit-btn';
        editBtn.textContent = '✏️';
        editBtn.title = 'Edit name';
        
        editBtn.addEventListener('click', () => {
            startNameEdit(selfDiv, nameSpan, editBtn);
        });
        
        selfDiv.appendChild(nameSpan);
        selfDiv.appendChild(editBtn);
        usersList.appendChild(selfDiv);
        
        const sortedUsers = Array.from(onlineUsers.values()).sort((a, b) => 
            a.displayName.localeCompare(b.displayName)
        );
        
        for (const user of sortedUsers) {
            const userDiv = document.createElement('div');
            userDiv.className = 'chat-widget-user-item';
            userDiv.textContent = user.displayName;
            usersList.appendChild(userDiv);
        }
        
        usersDiv.innerHTML = '';
        usersDiv.appendChild(usersList);
    }
    
    function attemptReconnect() {
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            updateStatus(`Reconnecting... (${reconnectAttempts}/${maxReconnectAttempts})`, '#ff0');
            
            setTimeout(() => {
                connect();
            }, 2000 * reconnectAttempts);
        } else {
            updateStatus('Connection Failed', '#f44');
            addSystemMessage('Max reconnection attempts reached');
        }
    }
    
    function setupEventListeners() {
        sendBtn.addEventListener('click', () => sendMessage());
        
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        window.addEventListener('beforeunload', () => {
            sendLeaveMessage();
        });
    }
    
    function createChatButton() {
        // Add styles to document
        const styleSheet = document.createElement('style');
        styleSheet.textContent = chatStyles;
        document.head.appendChild(styleSheet);
        
        // Create chat button
        chatButton = document.createElement('button');
        chatButton.className = 'chat-widget-button';
        chatButton.innerHTML = '🐱';
        chatButton.title = 'Open Black Cat Chat';
        chatButton.addEventListener('click', toggleChat);
        
        document.body.appendChild(chatButton);
    }
    
    function createChatOverlay() {
        chatOverlay = document.createElement('div');
        chatOverlay.className = 'chat-widget-overlay';
        
        chatOverlay.innerHTML = `
            <div class="chat-widget-header">
                <div class="chat-widget-title">Black Cat Chat 🐾</div>
                <button class="chat-widget-close">×</button>
            </div>
            <div class="chat-widget-app">
                <div class="chat-widget-main">
                    <div class="chat-widget-messages" id="chat-messages"></div>
                    <div class="chat-widget-input-area">
                        <input type="text" class="chat-widget-message-input" id="chat-message-input" placeholder="Type your message..." maxlength="200">
                        <button class="chat-widget-send-btn" id="chat-send-btn">Send</button>
                    </div>
                </div>
                <div class="chat-widget-sidebar">
                    <div class="chat-widget-status" id="chat-status">Disconnected</div>
                    <div id="chat-users-list"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(chatOverlay);
        
        // Get references to elements
        messagesDiv = chatOverlay.querySelector('#chat-messages');
        messageInput = chatOverlay.querySelector('#chat-message-input');
        sendBtn = chatOverlay.querySelector('#chat-send-btn');
        statusDiv = chatOverlay.querySelector('#chat-status');
        usersDiv = chatOverlay.querySelector('#chat-users-list');
        
        const closeBtn = chatOverlay.querySelector('.chat-widget-close');
        closeBtn.addEventListener('click', toggleChat);
        
        // Initialize chat functionality
        userId = generateUserId();
        userDisplayName = getOrCreateDisplayName();
        
        setupEventListeners();
        updateUsersList();
    }
    
    function toggleChat() {
        if (isOpen) {
            chatOverlay.classList.remove('open');
            chatButton.innerHTML = '🐱';
            chatButton.title = 'Open Black Cat Chat';
            isOpen = false;
            
            // Clean up WebSocket
            if (ws) {
                sendLeaveMessage();
                ws.close();
                ws = null;
            }
            stopPingSystem();
        } else {
            chatOverlay.classList.add('open');
            chatButton.innerHTML = '✕';
            chatButton.title = 'Close Black Cat Chat';
            isOpen = true;
            
            // Create background and connect
            createCatBackground();
            connect();
        }
    }
    
    // Public API
    window.initChat = function() {
        if (chatButton) {
            console.warn('Chat is already initialized');
            return;
        }
        
        createChatButton();
        createChatOverlay();
        
        console.log('Black Cat Chat initialized! Click the 🐱 button to open.');
    };
    
})();