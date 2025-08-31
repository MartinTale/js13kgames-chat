# 🐾 Chat Widget - Embeddable Real-time Chat

A lightweight, self-contained chat widget that can be embedded in any website. Built for the JS13K game community but works for any real-time chat needs.

## ✨ Features

- **Real-time messaging** via WebSocket
- **User presence tracking** with automatic cleanup
- **Editable display names** with localStorage persistence
- **Dark theme** with automatic responsive design
- **Mobile-first** responsive layout
- **Self-contained** - no external dependencies
- **Tiny footprint** - Only 3.9KB gzipped

## 🚀 Quick Start

### Option 1: Auto-Initialize

```html
<script src="chat-widget.iife.js"></script>
<div style="width: 800px; height: 500px;">
	<div data-chat-widget-auto></div>
</div>
```

### Option 2: Manual JavaScript

```html
<script src="chat-widget.iife.js"></script>
<div id="my-chat" style="width: 800px; height: 500px;"></div>

<script>
	const widget = createChatWidget({
		container: "#my-chat",
	});
</script>
```

## 📋 Configuration Options

| Option      | Type            | Default                                     | Description                  |
| ----------- | --------------- | ------------------------------------------- | ---------------------------- |
| `container` | string\|Element | `document.body`                             | CSS selector or HTML element |
| `wsUrl`     | string          | `wss://relay.js13kgames.com/black-cat-chat` | WebSocket server URL         |

**Note:** The widget fills its container completely (100% width and height). Size the container element to control the chat dimensions.

## 🎨 Auto-Initialize Attributes

Use these `data-*` attributes for auto-initialization:

```html
<div style="width: 600px; height: 400px;">
	<div data-chat-widget-auto data-ws-url="wss://your-server.com/chat"></div>
</div>
```

## 🔧 Public Methods

```javascript
const widget = createChatWidget(options);

// Force reconnection
widget.reconnect();

// Clean up and remove widget
widget.destroy();
```

## 📱 Responsive Design

The widget automatically adapts to different screen sizes:

- **Desktop**: Side-by-side layout (chat + users)
- **Mobile**: Stacked layout (chat above, users below)
- **Flexible sizing**: Respects max-width/max-height constraints

## 🎯 Use Cases

- **Game Communities**: Perfect for JS13K games and other web games
- **Live Coding**: Real-time chat during coding sessions
- **Customer Support**: Lightweight support chat
- **Educational Platforms**: Student-teacher communication
- **Events**: Chat for livestreams and webinars

## 🛠️ Building from Source

```bash
# Build the widget
npm run build-widget

# Output: dist/widget/chat-widget.iife.js
```

## 📊 Size Information

- **Minified**: 14.82 KB
- **Gzipped**: 3.93 KB
- **Zero dependencies**

## 🔗 WebSocket Protocol

The widget uses a simple JSON message format:

```javascript
// User message
{
    id: "timestamp",
    user: "user_id",
    message: "Hello world!",
    timestamp: 1234567890,
    type: "user"
}

// Ping (presence)
{
    id: "timestamp",
    user: "user_id",
    message: "DisplayName", // Display name in message field
    timestamp: 1234567890,
    type: "ping"
}

// Leave notification
{
    id: "timestamp",
    user: "user_id",
    message: "DisplayName",
    timestamp: 1234567890,
    type: "leave"
}
```

## 🔐 Security Notes

- Messages are limited to 200 characters
- Display names are limited to 10 characters
- HTML content is automatically escaped
- No authentication required (anonymous chat)

## 🌐 Browser Support

- Modern browsers with ES2020 support
- WebSocket support required
- localStorage for name persistence

## 📄 License

Same as parent project (check main repository).
