interface ChatMessage {
	id: string;
	user: string;
	message: string;
	timestamp: number;
	type?: "user" | "system" | "ping" | "leave";
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
let isEditingName = false;

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

function getOrCreateDisplayName(): string {
	const stored = localStorage.getItem("chat-display-name");
	if (stored) {
		return stored.slice(0, 10); // Ensure stored name doesn't exceed 10 chars
	}

	const newName = generateDisplayName();
	localStorage.setItem("chat-display-name", newName);
	return newName;
}

function setDisplayName(name: string): void {
	const trimmedName = name.trim();
	if (trimmedName.length === 0) return;

	const truncatedName = trimmedName.slice(0, 10);
	userDisplayName = truncatedName;
	localStorage.setItem("chat-display-name", truncatedName);

	// Only update user list if not currently editing
	if (!isEditingName) {
		updateUsersList();
	}
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

	// Send leave message when user closes the page
	window.addEventListener("beforeunload", () => {
		sendLeaveMessage();
	});

	// Also handle page visibility change (tab switching, etc.)
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") {
			// Don't send leave message for tab switching - only for actual page unload
			// This is handled by beforeunload event
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
	} else if (data.type === "leave") {
		handleLeave(data);
	} else {
		addUserMessage(data.user, data.message, data.timestamp);
	}
}

function handlePing(data: ChatMessage): void {
	// Don't process our own ping
	if (data.user === userId) return;

	// Truncate display name to 10 characters
	const truncatedDisplayName = data.message.slice(0, 10);

	// Update or add user
	onlineUsers.set(data.user, {
		id: data.user,
		lastPing: data.timestamp,
		displayName: truncatedDisplayName, // displayName is sent in message field for pings
	});

	updateUsersList();
}

function handleLeave(data: ChatMessage): void {
	// Don't process our own leave message
	if (data.user === userId) return;

	// Remove user from online list
	const user = onlineUsers.get(data.user);
	if (user) {
		onlineUsers.delete(data.user);
		updateUsersList();
	}
}

function sendLeaveMessage(): void {
	if (ws && ws.readyState === WebSocket.OPEN) {
		const leaveMessage: ChatMessage = {
			id: Date.now().toString(),
			user: userId,
			message: userDisplayName,
			timestamp: Date.now(),
			type: "leave"
		};
		ws.send(JSON.stringify(leaveMessage));
	}
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
	
	// Hide status div when connected, show when disconnected
	if (status === "Connected") {
		statusDiv.style.display = "none";
	} else {
		statusDiv.style.display = "block";
	}
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

function startNameEdit(selfDiv: HTMLElement, nameSpan: HTMLElement, editBtn: HTMLElement): void {
	isEditingName = true;

	const input = document.createElement("input");
	input.className = "user-name-input";
	input.type = "text";
	input.value = userDisplayName;
	input.maxLength = 10;

	const finishEdit = () => {
		isEditingName = false;
		const newName = input.value.trim();
		if (newName.length > 0) {
			setDisplayName(newName);
		}
		// Always update the UI to show the current name (whether changed or not)
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

	input.addEventListener("keypress", (e) => {
		if (e.key === "Enter") {
			finishEdit();
		} else if (e.key === "Escape") {
			cancelEdit();
		}
	});

	input.addEventListener("blur", finishEdit);

	// Replace name span with input
	selfDiv.replaceChild(input, nameSpan);
	selfDiv.removeChild(editBtn);
	input.focus();
	input.select();
}

function updateUsersList(): void {
	const userCount = onlineUsers.size + 1; // +1 for self
	const userCountText = `Online (${userCount})`;

	if (isEditingName) return;

	// Update user count in status or create users list
	let usersList = document.createElement("div");
	usersList.innerHTML = `<div class="users-header">${userCountText}</div>`;

	// Add yourself first with edit functionality
	const selfDiv = document.createElement("div");
	selfDiv.className = "user-item self";

	const nameSpan = document.createElement("span");
	nameSpan.textContent = `${userDisplayName} (You)`;

	const editBtn = document.createElement("button");
	editBtn.className = "user-edit-btn";
	editBtn.textContent = "✏️";
	editBtn.title = "Edit name";

	editBtn.addEventListener("click", () => {
		startNameEdit(selfDiv, nameSpan, editBtn);
	});

	selfDiv.appendChild(nameSpan);
	selfDiv.appendChild(editBtn);
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
	userDisplayName = getOrCreateDisplayName();
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
