// Chat Widget - Embeddable version
// This creates a self-contained chat widget that can be embedded in any website

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

interface ChatWidgetOptions {
	container?: string | HTMLElement;
	wsUrl?: string;
}

class ChatWidget {
	private ws: WebSocket | null = null;
	private container: HTMLElement;
	private messagesDiv!: HTMLElement;
	private messageInput!: HTMLInputElement;
	private sendBtn!: HTMLButtonElement;
	private statusDiv!: HTMLElement;
	private usersDiv!: HTMLElement;
	private userId: string;
	private userDisplayName: string;
	private reconnectAttempts = 0;
	private readonly maxReconnectAttempts = 5;
	private isEditingName = false;
	private isOpen = false;
	private chatButton!: HTMLElement;
	private chatContainer!: HTMLElement;

	// User tracking
	private onlineUsers: Map<string, OnlineUser> = new Map();
	private pingInterval: number | null = null;
	private cleanupInterval: number | null = null;
	private readonly PING_INTERVAL = 3000;
	private readonly USER_TIMEOUT = 10000;

	// Options
	private wsUrl: string;

	constructor(options: ChatWidgetOptions = {}) {
		this.wsUrl = options.wsUrl || "wss://relay.js13kgames.com/black-cat-chat";
		this.userId = this.generateUserId();
		this.userDisplayName = this.getOrCreateDisplayName();

		// Create container
		if (typeof options.container === "string") {
			this.container = document.querySelector(options.container) as HTMLElement;
		} else if (options.container instanceof HTMLElement) {
			this.container = options.container;
		} else {
			this.container = document.body;
		}

		if (!this.container) {
			throw new Error("Chat widget container not found");
		}

		this.createWidget();
		this.setupEventListeners();
		this.connect();
	}

	private createWidget(): void {
		// Inject styles
		this.injectStyles();

		// Create widget HTML with button and toggleable container
		const widgetHTML = `
			<div class="chat-widget-wrapper">
				<button class="chat-toggle-btn" id="chat-toggle-${this.userId}">
					<span class="chat-btn-icon">💬</span>
					<span class="chat-btn-text">Chat</span>
				</button>
				<div class="chat-widget-container" id="chat-container-${this.userId}" style="display: none;">
					<div class="chat-widget">
						<div class="chat-main">
							<div class="chat-header">
								<span class="chat-title">JS13K Chat</span>
								<button class="chat-close-btn" id="chat-close-${this.userId}">×</button>
							</div>
							<div class="chat-content">
								<div class="chat-messages" id="chat-messages-${this.userId}"></div>
								<div class="chat-input-area">
									<input type="text" class="chat-message-input" placeholder="Type your message..." maxlength="200" id="chat-input-${this.userId}">
									<button class="chat-send-btn" id="chat-send-${this.userId}">Send</button>
								</div>
							</div>
						</div>
						<div class="chat-sidebar">
							<div class="chat-status" id="chat-status-${this.userId}">Disconnected</div>
							<div class="chat-users" id="chat-users-${this.userId}"></div>
						</div>
					</div>
				</div>
			</div>
		`;

		this.container.innerHTML = widgetHTML;

		// Get element references
		this.chatButton = document.getElementById(`chat-toggle-${this.userId}`)!;
		this.chatContainer = document.getElementById(`chat-container-${this.userId}`)!;
		this.messagesDiv = document.getElementById(`chat-messages-${this.userId}`)!;
		this.messageInput = document.getElementById(`chat-input-${this.userId}`) as HTMLInputElement;
		this.sendBtn = document.getElementById(`chat-send-${this.userId}`) as HTMLButtonElement;
		this.statusDiv = document.getElementById(`chat-status-${this.userId}`)!;
		this.usersDiv = document.getElementById(`chat-users-${this.userId}`)!;

		// Set up toggle functionality
		this.setupToggleListeners();
	}

	private injectStyles(): void {
		const styleId = "chat-widget-styles";
		if (document.getElementById(styleId)) return;

		const styles = `
			.chat-widget-wrapper {
				position: fixed;
				bottom: 20px;
				right: 20px;
				z-index: 10000;
				font-family: monospace;
			}
			.chat-toggle-btn {
				background: #0f8;
				color: #000;
				border: none;
				border-radius: 50px;
				padding: 12px 16px;
				cursor: pointer;
				font-family: monospace;
				font-weight: bold;
				font-size: 14px;
				display: flex;
				align-items: center;
				gap: 8px;
				box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3);
				transition: all 0.2s ease;
			}
			.chat-toggle-btn:hover {
				background: #0a6;
				transform: translateY(-2px);
				box-shadow: 0 6px 16px rgba(0, 255, 136, 0.4);
			}
			.chat-btn-icon {
				font-size: 18px;
			}
			.chat-widget-container {
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				width: 100vw;
				height: 100vh;
				background: #111;
				z-index: 9999;
				overflow: hidden;
			}
			.chat-widget {
				display: flex;
				width: 100%;
				height: 100%;
				overflow: hidden;
				box-sizing: border-box;
				color: #fff;
			}
			.chat-widget * {
				box-sizing: border-box;
			}
			.chat-main {
				display: flex;
				flex-direction: column;
				flex: 1;
				min-width: 0;
			}
			.chat-header {
				background: #1a1a1a;
				padding: 12px 16px;
				border-bottom: 1px solid #333;
				display: flex;
				justify-content: space-between;
				align-items: center;
			}
			.chat-title {
				font-weight: bold;
				color: #0f8;
				font-size: 14px;
			}
			.chat-close-btn {
				background: none;
				border: none;
				color: #888;
				cursor: pointer;
				font-size: 20px;
				width: 24px;
				height: 24px;
				display: flex;
				align-items: center;
				justify-content: center;
				border-radius: 4px;
				transition: all 0.2s ease;
			}
			.chat-close-btn:hover {
				background: #333;
				color: #fff;
			}
			.chat-content {
				display: flex;
				flex-direction: column;
				flex: 1;
				padding: 10px;
				min-height: 0;
			}
			.chat-sidebar {
				width: 180px;
				background: #1a1a1aaa;
				border-left: 1px solid #333;
				padding: 10px;
				flex-shrink: 0;
			}
			.chat-messages {
				flex: 1;
				overflow-y: auto;
				padding: 10px;
				border: 1px solid #333;
				background: #222222aa;
				margin-bottom: 10px;
				border-radius: 4px;
			}
			.chat-message {
				margin: 8px 0;
				padding: 8px;
				border-left: 3px solid #0f8;
				background: #333;
				border-radius: 3px;
			}
			.chat-message.own {
				border-left-color: #08f;
				background: #2a2a3a;
				margin-left: 20px;
			}
			.chat-message.system {
				border-left-color: #f80;
				font-style: italic;
			}
			.chat-message-header {
				display: flex;
				justify-content: flex-start;
				align-items: center;
				margin-bottom: 4px;
				gap: 8px;
			}
			.chat-message-time {
				font-size: 11px;
				color: #888;
				font-weight: normal;
			}
			.chat-message-content {
				line-height: 1.3;
				color: #ccc;
			}
			.chat-input-area {
				display: flex;
				gap: 10px;
				margin-bottom: 5px;
			}
			.chat-message-input {
				flex: 1;
				padding: 10px;
				background: #333;
				border: 1px solid #555;
				color: #fff;
				border-radius: 4px;
				font-family: monospace;
			}
			.chat-send-btn {
				padding: 10px 20px;
				background: #0f8;
				color: #000;
				border: none;
				border-radius: 4px;
				cursor: pointer;
				font-family: monospace;
				font-weight: bold;
			}
			.chat-send-btn:hover {
				background: #0a6;
			}
			.chat-send-btn:disabled {
				background: #555;
				cursor: not-allowed;
			}
			.chat-status {
				text-align: center;
				padding: 8px;
				font-size: 12px;
				color: #f80;
				background: #2a2a2a;
				border-radius: 4px;
				margin-bottom: 10px;
				border: 1px solid #444;
			}
			.chat-users-header {
				font-weight: bold;
				margin-bottom: 10px;
				padding: 8px;
				background: #333;
				border-radius: 4px;
				text-align: center;
				color: #0f8;
			}
			.chat-user-item {
				padding: 5px 8px;
				margin: 2px 0;
				background: #2a2a2a;
				border-radius: 3px;
				border-left: 3px solid #555;
				font-size: 12px;
			}
			.chat-user-item.self {
				border-left-color: #08f;
				background: #2a2a3a;
				font-weight: bold;
				display: flex;
				align-items: center;
				justify-content: space-between;
			}
			.chat-user-edit-btn {
				background: none;
				border: none;
				color: #08f;
				cursor: pointer;
				font-size: 10px;
				padding: 2px 4px;
				border-radius: 2px;
				margin-left: 5px;
			}
			.chat-user-edit-btn:hover {
				background: #333;
			}
			.chat-user-name-input {
				background: #333;
				border: 1px solid #08f;
				color: #fff;
				border-radius: 2px;
				font-family: monospace;
				font-size: 12px;
				padding: 2px 4px;
				width: 80px;
			}
			@media (max-width: 768px) {
				.chat-widget {
					flex-direction: column;
				}
				.chat-sidebar {
					width: 100%;
					height: 120px;
					border-left: none;
					border-top: 1px solid #333;
					order: 2;
				}
				.chat-main {
					order: 1;
				}
			}
		`;

		const styleSheet = document.createElement("style");
		styleSheet.id = styleId;
		styleSheet.textContent = styles;
		document.head.appendChild(styleSheet);
	}

	private generateUserId(): string {
		return "user_" + Math.random().toString(36).substring(2, 11);
	}

	private generateDisplayName(): string {
		const adjectives = [
			"Shadow",
			"Midnight",
			"Silent",
			"Swift",
			"Dark",
			"Sleek",
			"Mystic",
			"Sneaky",
		];
		const nouns = ["Cat", "Kitten", "Feline", "Paws", "Whiskers", "Panther", "Lynx", "Tiger"];
		const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
		const noun = nouns[Math.floor(Math.random() * nouns.length)];
		return adj + noun;
	}

	private getOrCreateDisplayName(): string {
		const stored = localStorage.getItem("chat-widget-display-name");
		if (stored) {
			return stored.slice(0, 10);
		}

		const newName = this.generateDisplayName();
		localStorage.setItem("chat-widget-display-name", newName);
		return newName;
	}

	private setDisplayName(name: string): void {
		const trimmedName = name.trim();
		if (trimmedName.length === 0) return;

		const truncatedName = trimmedName.slice(0, 10);
		this.userDisplayName = truncatedName;
		localStorage.setItem("chat-widget-display-name", truncatedName);

		if (!this.isEditingName) {
			this.updateUsersList();
		}
	}

	private setupToggleListeners(): void {
		this.chatButton.addEventListener("click", () => this.toggleChat());

		const closeBtn = document.getElementById(`chat-close-${this.userId}`);
		closeBtn?.addEventListener("click", () => this.closeChat());
	}

	private setupEventListeners(): void {
		this.sendBtn.addEventListener("click", () => this.sendMessage());

		this.messageInput.addEventListener("keypress", (e) => {
			if (e.key === "Enter") {
				this.sendMessage();
			}
		});

		window.addEventListener("beforeunload", () => {
			this.sendLeaveMessage();
		});
	}

	private toggleChat(): void {
		this.isOpen = !this.isOpen;
		this.chatContainer.style.display = this.isOpen ? "block" : "none";

		if (this.isOpen) {
			this.messageInput.focus();
		}
	}

	private closeChat(): void {
		this.isOpen = false;
		this.chatContainer.style.display = "none";
	}

	private connect(): void {
		try {
			this.ws = new WebSocket(this.wsUrl);

			this.ws.onopen = () => {
				this.updateStatus("Connected", "#0f8");
				this.reconnectAttempts = 0;
				this.sendBtn.disabled = false;
				this.addSystemMessage("Connected to chat server");
				this.startPingSystem();
			};

			this.ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					this.handleMessage(data);
				} catch (e) {
					console.error("Failed to parse message:", e);
				}
			};

			this.ws.onclose = () => {
				this.updateStatus("Disconnected", "#f80");
				this.sendBtn.disabled = true;
				this.addSystemMessage("Disconnected from server");
				this.stopPingSystem();
				this.onlineUsers.clear();
				this.updateUsersList();
				this.attemptReconnect();
			};

			this.ws.onerror = (error) => {
				console.error("WebSocket error:", error);
				this.addSystemMessage("Connection error occurred");
			};
		} catch (error) {
			console.error("Failed to connect:", error);
			this.updateStatus("Connection Failed", "#f44");
			this.addSystemMessage("Failed to connect to server");
		}
	}

	private attemptReconnect(): void {
		if (this.reconnectAttempts < this.maxReconnectAttempts) {
			this.reconnectAttempts++;
			this.updateStatus(
				`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
				"#ff0"
			);

			setTimeout(() => {
				this.connect();
			}, 2000 * this.reconnectAttempts);
		} else {
			this.updateStatus("Connection Failed", "#f44");
			this.addSystemMessage("Max reconnection attempts reached");
		}
	}

	private startPingSystem(): void {
		this.pingInterval = setInterval(() => {
			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
				const pingMessage: ChatMessage = {
					id: Date.now().toString(),
					user: this.userId,
					message: this.userDisplayName,
					timestamp: Date.now(),
					type: "ping",
				};
				this.ws.send(JSON.stringify(pingMessage));
			}
		}, this.PING_INTERVAL);

		this.cleanupInterval = setInterval(() => {
			this.cleanupInactiveUsers();
		}, 2000);
	}

	private stopPingSystem(): void {
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}
	}

	private cleanupInactiveUsers(): void {
		const now = Date.now();
		let usersRemoved = false;

		for (const [userId, user] of this.onlineUsers) {
			if (now - user.lastPing > this.USER_TIMEOUT) {
				this.onlineUsers.delete(userId);
				usersRemoved = true;
			}
		}

		if (usersRemoved) {
			this.updateUsersList();
		}
	}

	private sendMessage(): void {
		const text = this.messageInput.value.trim();
		if (!text || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
			return;
		}

		const message: ChatMessage = {
			id: Date.now().toString(),
			user: this.userId,
			message: text,
			timestamp: Date.now(),
			type: "user",
		};

		this.addUserMessage(message.user, message.message, message.timestamp);
		this.ws.send(JSON.stringify(message));
		this.messageInput.value = "";
	}

	private handleMessage(data: ChatMessage): void {
		if (data.type === "system") {
			this.addSystemMessage(data.message);
		} else if (data.type === "ping") {
			this.handlePing(data);
		} else if (data.type === "leave") {
			this.handleLeave(data);
		} else {
			this.addUserMessage(data.user, data.message, data.timestamp);
		}
	}

	private handlePing(data: ChatMessage): void {
		if (data.user === this.userId) return;

		const truncatedDisplayName = data.message.slice(0, 10);
		this.onlineUsers.set(data.user, {
			id: data.user,
			lastPing: data.timestamp,
			displayName: truncatedDisplayName,
		});

		this.updateUsersList();
	}

	private handleLeave(data: ChatMessage): void {
		if (data.user === this.userId) return;

		if (this.onlineUsers.has(data.user)) {
			this.onlineUsers.delete(data.user);
			this.updateUsersList();
		}
	}

	private sendLeaveMessage(): void {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			const leaveMessage: ChatMessage = {
				id: Date.now().toString(),
				user: this.userId,
				message: this.userDisplayName,
				timestamp: Date.now(),
				type: "leave",
			};
			this.ws.send(JSON.stringify(leaveMessage));
		}
	}

	private addUserMessage(user: string, message: string, timestamp: number): void {
		const messageDiv = document.createElement("div");
		const isOwnMessage = user === this.userId;
		messageDiv.className = isOwnMessage ? "chat-message own" : "chat-message";

		const time = new Date(timestamp).toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});

		const truncatedMessage = message.length > 200 ? message.slice(0, 200) + "..." : message;

		let displayName: string;
		if (isOwnMessage) {
			displayName = "You";
		} else {
			const onlineUser = this.onlineUsers.get(user);
			displayName = onlineUser ? onlineUser.displayName : user.split("_")[1] || user;
		}

		messageDiv.innerHTML = `
			<div class="chat-message-header">
				<strong>${displayName}</strong> <span class="chat-message-time">${time}</span>
			</div>
			<div class="chat-message-content">${this.escapeHtml(truncatedMessage)}</div>
		`;

		this.messagesDiv.appendChild(messageDiv);
		this.scrollToBottom();
	}

	private addSystemMessage(message: string): void {
		const messageDiv = document.createElement("div");
		messageDiv.className = "chat-message system";
		messageDiv.textContent = message;

		this.messagesDiv.appendChild(messageDiv);
		this.scrollToBottom();
	}

	private updateStatus(status: string, color: string): void {
		this.statusDiv.textContent = status;
		this.statusDiv.style.color = color;

		if (status === "Connected") {
			this.statusDiv.style.display = "none";
		} else {
			this.statusDiv.style.display = "block";
		}
	}

	private scrollToBottom(): void {
		this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;
	}

	private escapeHtml(text: string): string {
		const div = document.createElement("div");
		div.textContent = text;
		return div.innerHTML;
	}

	private updateUsersList(): void {
		const userCount = this.onlineUsers.size + 1;
		const userCountText = `Online (${userCount})`;

		if (this.isEditingName) return;

		let usersList = document.createElement("div");
		usersList.innerHTML = `<div class="chat-users-header">${userCountText}</div>`;

		// Add yourself first
		const selfDiv = document.createElement("div");
		selfDiv.className = "chat-user-item self";

		const nameSpan = document.createElement("span");
		nameSpan.textContent = `${this.userDisplayName} (You)`;

		const editBtn = document.createElement("button");
		editBtn.className = "chat-user-edit-btn";
		editBtn.textContent = "✏️";
		editBtn.title = "Edit name";

		editBtn.addEventListener("click", () => {
			this.startNameEdit(selfDiv, nameSpan, editBtn);
		});

		selfDiv.appendChild(nameSpan);
		selfDiv.appendChild(editBtn);
		usersList.appendChild(selfDiv);

		// Add other users
		const sortedUsers = Array.from(this.onlineUsers.values()).sort((a, b) =>
			a.displayName.localeCompare(b.displayName)
		);

		for (const user of sortedUsers) {
			const userDiv = document.createElement("div");
			userDiv.className = "chat-user-item";
			userDiv.textContent = user.displayName;
			usersList.appendChild(userDiv);
		}

		this.usersDiv.innerHTML = "";
		this.usersDiv.appendChild(usersList);
	}

	private startNameEdit(selfDiv: HTMLElement, nameSpan: HTMLElement, editBtn: HTMLElement): void {
		this.isEditingName = true;

		const input = document.createElement("input");
		input.className = "chat-user-name-input";
		input.type = "text";
		input.value = this.userDisplayName;
		input.maxLength = 10;

		const finishEdit = () => {
			this.isEditingName = false;
			const newName = input.value.trim();
			if (newName.length > 0) {
				this.setDisplayName(newName);
			}
			nameSpan.textContent = `${this.userDisplayName} (You)`;
			selfDiv.replaceChild(nameSpan, input);
			selfDiv.appendChild(editBtn);
			this.updateUsersList();
		};

		const cancelEdit = () => {
			this.isEditingName = false;
			nameSpan.textContent = `${this.userDisplayName} (You)`;
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

		selfDiv.replaceChild(input, nameSpan);
		selfDiv.removeChild(editBtn);
		input.focus();
		input.select();
	}

	// Public methods for external control
	public destroy(): void {
		this.stopPingSystem();
		this.sendLeaveMessage();
		if (this.ws) {
			this.ws.close();
		}
		this.container.innerHTML = "";
	}

	public reconnect(): void {
		this.reconnectAttempts = 0;
		this.connect();
	}
}

// Global function for easy initialization
declare global {
	interface Window {
		createChatWidget: (options?: ChatWidgetOptions) => ChatWidget;
	}
}

window.createChatWidget = (options: ChatWidgetOptions = {}) => {
	return new ChatWidget(options);
};

// Auto-initialize if data-auto-init is present
document.addEventListener("DOMContentLoaded", () => {
	const autoInitElements = document.querySelectorAll("[data-chat-widget-auto]");
	autoInitElements.forEach((element) => {
		const options: ChatWidgetOptions = {
			container: element as HTMLElement,
			wsUrl: element.getAttribute("data-ws-url") || undefined,
		};
		new ChatWidget(options);
	});
});

export { ChatWidget, type ChatWidgetOptions };
