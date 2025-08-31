interface ChatMessage {
	id: string;
	user: string;
	message: string;
	timestamp: number;
	type?: "user" | "system" | "ping";
}

interface OnlineUser {
	id: string;
	lastPing: number;
	displayName: string;
}

let ws: WebSocket | null = null;
let messagesDiv: HTMLElement;
let messageInput: HTMLInputElement;
let sendBtn: HTMLButtonElement;
let statusDiv: HTMLElement;
let usersDiv: HTMLElement;
let userId: string;
let userDisplayName: string;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// User tracking
let onlineUsers: Map<string, OnlineUser> = new Map();
let pingInterval: number | null = null;
let cleanupInterval: number | null = null;
const PING_INTERVAL = 3000; // 3 seconds
const USER_TIMEOUT = 10000; // 10 seconds

function generateUserId(): string {
	return "user_" + Math.random().toString(36).substr(2, 9);
}

function generateDisplayName(): string {
	const adjectives = ["Cool", "Fast", "Smart", "Brave", "Quick", "Wise", "Bold", "Calm"];
	const nouns = ["Cat", "Fox", "Wolf", "Bear", "Lion", "Tiger", "Eagle", "Shark"];
	const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
	const noun = nouns[Math.floor(Math.random() * nouns.length)];
	return adj + noun;
}

function startPingSystem(): void {
	// Send ping every PING_INTERVAL
	pingInterval = setInterval(() => {
		if (ws && ws.readyState === WebSocket.OPEN) {
			const pingMessage: ChatMessage = {
				id: Date.now().toString(),
				user: userId,
				message: userDisplayName,
				timestamp: Date.now(),
				type: "ping",
			};
			ws.send(JSON.stringify(pingMessage));
		}
	}, PING_INTERVAL);

	// Clean up inactive users every few seconds
	cleanupInterval = setInterval(() => {
		cleanupInactiveUsers();
	}, 2000);
}

function stopPingSystem(): void {
	if (pingInterval) {
		clearInterval(pingInterval);
		pingInterval = null;
	}
	if (cleanupInterval) {
		clearInterval(cleanupInterval);
		cleanupInterval = null;
	}
}

function cleanupInactiveUsers(): void {
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

function setupEventListeners(): void {
	sendBtn.addEventListener("click", () => sendMessage());

	messageInput.addEventListener("keypress", (e) => {
		if (e.key === "Enter") {
			sendMessage();
		}
	});
}

function connect(): void {
	try {
		// Use wss for production, ws for local development
		const wsUrl = "wss://relay.js13kgames.com/cat-chat";

		ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			updateStatus("Connected", "#0f8");
			reconnectAttempts = 0;
			sendBtn.disabled = false;
			addSystemMessage("Connected to chat server");
			addTestMessages();
			startPingSystem();
		};

		ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				handleMessage(data);
			} catch (e) {
				console.error("Failed to parse message:", e);
			}
		};

		ws.onclose = () => {
			updateStatus("Disconnected", "#f80");
			sendBtn.disabled = true;
			addSystemMessage("Disconnected from server");
			stopPingSystem();
			onlineUsers.clear();
			updateUsersList();
			attemptReconnect();
		};

		ws.onerror = (error) => {
			console.error("WebSocket error:", error);
			addSystemMessage("Connection error occurred");
		};
	} catch (error) {
		console.error("Failed to connect:", error);
		updateStatus("Connection Failed", "#f44");
		addSystemMessage("Failed to connect to server");
	}
}

function attemptReconnect(): void {
	if (reconnectAttempts < maxReconnectAttempts) {
		reconnectAttempts++;
		updateStatus(`Reconnecting... (${reconnectAttempts}/${maxReconnectAttempts})`, "#ff0");

		setTimeout(() => {
			connect();
		}, 2000 * reconnectAttempts);
	} else {
		updateStatus("Connection Failed", "#f44");
		addSystemMessage("Max reconnection attempts reached");
	}
}

function sendMessage(): void {
	const text = messageInput.value.trim();
	if (!text || !ws || ws.readyState !== WebSocket.OPEN) {
		return;
	}

	const message: ChatMessage = {
		id: Date.now().toString(),
		user: userId,
		message: text,
		timestamp: Date.now(),
		type: "user",
	};

	// Add message locally immediately
	addUserMessage(message.user, message.message, message.timestamp);

	ws.send(JSON.stringify(message));
	messageInput.value = "";
}

function handleMessage(data: ChatMessage): void {
	if (data.type === "system") {
		addSystemMessage(data.message);
	} else if (data.type === "ping") {
		handlePing(data);
	} else {
		addUserMessage(data.user, data.message, data.timestamp);
	}
}

function handlePing(data: ChatMessage): void {
	// Don't process our own ping
	if (data.user === userId) return;

	// Update or add user
	onlineUsers.set(data.user, {
		id: data.user,
		lastPing: data.timestamp,
		displayName: data.message, // displayName is sent in message field for pings
	});

	updateUsersList();
}

function addUserMessage(user: string, message: string, timestamp: number): void {
	const messageDiv = document.createElement("div");
	const isOwnMessage = user === userId;
	messageDiv.className = isOwnMessage ? "message own" : "message";

	const time = new Date(timestamp).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

	// Truncate long messages to 200 characters
	const truncatedMessage = message.length > 200 ? message.slice(0, 200) + "..." : message;

	let displayName: string;
	if (isOwnMessage) {
		displayName = "You";
	} else {
		// Try to get display name from online users, fallback to user ID
		const onlineUser = onlineUsers.get(user);
		displayName = onlineUser ? onlineUser.displayName : user.split("_")[1] || user;
	}

	messageDiv.innerHTML = `
      <div class="message-header">
        <strong>${displayName}</strong> <span class="message-time">${time}</span>
      </div>
      <div class="message-content">${escapeHtml(truncatedMessage)}</div>
    `;

	messagesDiv.appendChild(messageDiv);
	scrollToBottom();
}

function addSystemMessage(message: string): void {
	const messageDiv = document.createElement("div");
	messageDiv.className = "message system";
	messageDiv.textContent = message;

	messagesDiv.appendChild(messageDiv);
	scrollToBottom();
}

function updateStatus(status: string, color: string): void {
	statusDiv.textContent = status;
	statusDiv.style.color = color;
}

function scrollToBottom(): void {
	messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function escapeHtml(text: string): string {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

function addTestMessages(): void {
	const testMessages = [
		"Hey everyone! How's the game development going?",
		"Just implemented a cool physics engine!",
		"Anyone know how to optimize for the 13KB limit?",
		"This chat system is pretty neat 🎮",
		"Working on a puzzle platformer, what about you?",
		"Canvas rendering can be tricky sometimes",
		"Love the minimalist design of this chat",
		"Has anyone tried the new WebGL features?",
		"13KB is such a fun constraint to work with!",
	];

	const testUsers = ["CodeNinja47", "PixelMaster", "GameDev2024", "RetroGamer", "ByteWizard"];

	// Add 3-5 random test messages
	const messageCount = 3 + Math.floor(Math.random() * 3);
	const now = Date.now();

	for (let i = 0; i < messageCount; i++) {
		let user: string;
		let randomMessage: string;
		const timestamp = now - (messageCount - i) * 60000; // Messages spread over past few minutes

		// Make one of the messages from yourself
		if (i === Math.floor(messageCount / 2)) {
			user = userId;
			randomMessage = testMessages[Math.floor(Math.random() * testMessages.length)];
		} else {
			const randomUser = testUsers[Math.floor(Math.random() * testUsers.length)];
			user = `user_${randomUser}`;
			randomMessage = testMessages[Math.floor(Math.random() * testMessages.length)];

			// Add to online users so they appear in the list
			onlineUsers.set(user, {
				id: user,
				lastPing: timestamp,
				displayName: randomUser,
			});
		}

		addUserMessage(user, randomMessage, timestamp);
	}

	updateUsersList();
}

function updateUsersList(): void {
	const userCount = onlineUsers.size + 1; // +1 for self
	const userCountText = `Online (${userCount})`;

	// Update user count in status or create users list
	let usersList = document.createElement("div");
	usersList.innerHTML = `<div class="users-header">${userCountText}</div>`;

	// Add yourself first
	const selfDiv = document.createElement("div");
	selfDiv.className = "user-item self";
	selfDiv.textContent = `${userDisplayName} (You)`;
	usersList.appendChild(selfDiv);

	// Add other users
	const sortedUsers = Array.from(onlineUsers.values()).sort((a, b) =>
		a.displayName.localeCompare(b.displayName)
	);

	for (const user of sortedUsers) {
		const userDiv = document.createElement("div");
		userDiv.className = "user-item";
		userDiv.textContent = user.displayName;
		usersList.appendChild(userDiv);
	}

	// Replace existing content
	usersDiv.innerHTML = "";
	usersDiv.appendChild(usersList);
}

function init(): void {
	userId = generateUserId();
	userDisplayName = generateDisplayName();
	messagesDiv = document.getElementById("messages")!;
	messageInput = document.getElementById("message-input") as HTMLInputElement;
	sendBtn = document.getElementById("send-btn") as HTMLButtonElement;
	statusDiv = document.getElementById("connection-status")!;
	usersDiv = document.getElementById("users-list")!;

	// Initialize users list with just yourself
	updateUsersList();

	setupEventListeners();
	connect();
}

// Initialize chat when DOM is loaded
document.addEventListener("DOMContentLoaded", init);
