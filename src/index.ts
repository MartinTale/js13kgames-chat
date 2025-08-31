interface ChatMessage {
	id: string;
	user: string;
	message: string;
	timestamp: number;
	type?: "user" | "system";
}

let ws: WebSocket | null = null;
let messagesDiv: HTMLElement;
let messageInput: HTMLInputElement;
let sendBtn: HTMLButtonElement;
let statusDiv: HTMLElement;
let userId: string;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

function generateUserId(): string {
	return "user_" + Math.random().toString(36).substr(2, 9);
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
	} else {
		addUserMessage(data.user, data.message, data.timestamp);
	}
}

function addUserMessage(user: string, message: string, timestamp: number): void {
	const messageDiv = document.createElement("div");
	messageDiv.className = "message";

	const time = new Date(timestamp).toLocaleTimeString();
	const isOwnMessage = user === userId;
	const displayName = isOwnMessage ? "You" : user.split("_")[1] || user;

	messageDiv.innerHTML = `<strong>${displayName}</strong> [${time}]: ${escapeHtml(message)}`;

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

function init(): void {
	userId = generateUserId();
	messagesDiv = document.getElementById("messages")!;
	messageInput = document.getElementById("message-input") as HTMLInputElement;
	sendBtn = document.getElementById("send-btn") as HTMLButtonElement;
	statusDiv = document.getElementById("connection-status")!;

	setupEventListeners();
	connect();
}

// Initialize chat when DOM is loaded
document.addEventListener("DOMContentLoaded", init);
