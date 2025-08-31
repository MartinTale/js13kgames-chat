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
	const adjectives = ["Shadow", "Midnight", "Silent", "Swift", "Dark", "Sleek", "Mystic", "Sneaky"];
	const nouns = ["Cat", "Kitten", "Feline", "Paws", "Whiskers", "Panther", "Lynx", "Tiger"];
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
			type: "leave",
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
		"Purr-fect! How's everyone's game development prowling along? 🐾",
		"Just implemented some cat-like stealth mechanics!",
		"Anyone know how to squeeze more into the 13KB limit? Every byte counts!",
		"This chat has such sleek, dark vibes 🌙",
		"Working on a sneaky puzzle game, very cat-like!",
		"Canvas rendering can be as tricky as catching a laser pointer",
		"Love the midnight aesthetic of this interface",
		"Has anyone tried adding feline grace to their animations?",
		"13KB is like fitting a whole cat into a tiny box - challenging but doable!",
	];

	const testUsers = ["NightProwler", "WhiskerDev", "ShadowCoder", "MidnightHacker", "StealthyCat"];

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

function createCatBackground(): void {
	const backgroundDiv = document.createElement("div");
	backgroundDiv.className = "cat-background";
	document.body.appendChild(backgroundDiv);

	const catSvg =
		"m463 37-30 51-7-3c-27-8-72-7-98 1l-7 2-28-49c-34 69-33 118-15 149 18 33 57 49 99 48 49-1 89-20 107-54 17-32 16-81-21-145zM324 138c18 0 29 15 31 36-37 18-54 4-61-26 12-7 22-10 30-10zm109 0c9 0 19 3 30 10-7 30-24 44-61 26 2-21 13-36 31-36zm-293 51h-4c-30 0-56 10-76 26-43 36-57 101-13 166 21 34 45 55 71 65 33 12 67 8 100 4 33-5 66-11 97-9s62 10 91 41c19 22 46-1 23-24-35-34-72-47-109-50-37-2-72 5-104 9-32 5-60 7-85-2-14-6-28-15-41-31h351c14-53 15-107 2-142-19 8-42 12-66 13-30 0-59-7-83-23a426 426 0 0 0-14 10l-6 4-5-5c-47-37-91-52-129-52z";

	// Keep track of placed cat positions
	const placedCats: Array<{ x: number; y: number; scale: number }> = [];
	const minDistance = 120; // Minimum distance between cats
	const maxAttempts = 50; // Maximum attempts to place each cat

	// Create scattered cats
	const numCats = 40;
	for (let i = 0; i < numCats; i++) {
		let placed = false;
		let attempts = 0;
		let x = 0,
			y = 0,
			scale = 1;

		// Try to find a non-overlapping position
		while (!placed && attempts < maxAttempts) {
			x = Math.random() * (window.innerWidth - 160);
			y = Math.random() * (window.innerHeight - 160);
			scale = 1 + Math.random();

			// Check if this position overlaps with existing cats
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
				placedCats.push({ x, y, scale });
			}
			attempts++;
		}

		// If we couldn't find a good spot, place it anyway (fallback)
		if (!placed) {
			continue;
		}

		const catElement = document.createElement("div");
		catElement.className = "cat-silhouette";

		// Random rotation (-15 to 15 degrees)
		const rotation = (Math.random() - 0.5) * 30;

		// Create SVG
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("viewBox", "0 0 512 512");
		svg.style.width = "100%";
		svg.style.height = "100%";

		const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
		path.setAttribute("fill", "#222");
		path.setAttribute("d", catSvg);
		path.setAttribute("transform", "translate(0 1)");

		svg.appendChild(path);
		catElement.appendChild(svg);

		// Apply transforms
		catElement.style.left = `${x}px`;
		catElement.style.top = `${y}px`;
		catElement.style.transform = `rotate(${rotation}deg) scale(${scale})`;

		backgroundDiv.appendChild(catElement);
	}
}

function init(): void {
	userId = generateUserId();
	userDisplayName = getOrCreateDisplayName();
	messagesDiv = document.getElementById("messages")!;
	messageInput = document.getElementById("message-input") as HTMLInputElement;
	sendBtn = document.getElementById("send-btn") as HTMLButtonElement;
	statusDiv = document.getElementById("connection-status")!;
	usersDiv = document.getElementById("users-list")!;

	// Create cat background
	createCatBackground();

	// Initialize users list with just yourself
	updateUsersList();

	setupEventListeners();
	connect();
}

// Initialize chat when DOM is loaded
document.addEventListener("DOMContentLoaded", init);
