# 🐾 JS13K Black Cat Chat

A real-time chat application and embeddable chat widget built for the JS13K game development community. Features both a standalone chat app and a lightweight widget that can be embedded in any website.

## 🚀 Live Demo

**Try the chat widget live:** https://codepen.io/MartintTale/full/WbeLBEO

## 📦 What's Included

This project contains two main components:

1. **Standalone Chat App** - A full-featured chat application with cat-themed design
2. **Embeddable Chat Widget** - A lightweight, self-contained widget for websites

---

## 🌟 Standalone Chat App

### Quick Start

Install dependencies: `npm install`

Run Server: `npm run serve`

### Building

For building, `npm run build`:

- Minifies your html file and embeds css
- Strips html/css from your html and prepends your transpiled js code with a `document.write` call that writes your html and css.
- Runs Terser on your code
- Runs RoadRoller on the Terser minified code
- Creates `dist/index.html` with only a script tag and the RoadRollered JS
- Any external assets (images, data files, etc) are also copied to `dist/`
- Zips everything up and places it in `dist/index.zip`

---

## 🔗 Embeddable Chat Widget

A lightweight, self-contained chat widget that can be embedded in any website. Perfect for adding real-time chat to your projects!

### ✨ Widget Features

- **🎯 Floating Chat Button** - Appears as a stylish floating button in bottom-right corner
- **🖥️ Fullscreen Chat** - Opens a fullscreen chat interface when clicked
- **💬 Real-time messaging** via WebSocket
- **👥 User presence tracking** with automatic cleanup
- **✏️ Editable display names** with localStorage persistence
- **🌙 Dark theme** with automatic responsive design
- **📱 Mobile responsive** layout
- **📦 Self-contained** - no external dependencies
- **⚡ Tiny footprint** - Only ~4.2KB gzipped

### 🚀 Quick Start

#### Option 1: Auto-Initialize

```html
<script src="dist/widget/chat-widget.iife.js"></script>
<div data-chat-widget-auto></div>
```

#### Option 2: Manual JavaScript

```html
<script src="dist/widget/chat-widget.iife.js"></script>

<script>
	const widget = window.createChatWidget({
		container: document.body, // optional
		wsUrl: 'wss://relay.js13kgames.com/black-cat-chat' // optional
	});
</script>
```

### 📋 Configuration Options

| Option      | Type            | Default                                     | Description                  |
| ----------- | --------------- | ------------------------------------------- | ---------------------------- |
| `container` | string\|Element | `document.body`                             | CSS selector or HTML element |
| `wsUrl`     | string          | `wss://relay.js13kgames.com/black-cat-chat` | WebSocket server URL         |

### 🎨 Auto-Initialize Attributes

Use these `data-*` attributes for auto-initialization:

```html
<div data-chat-widget-auto data-ws-url="wss://your-server.com/chat"></div>
```

### 🔧 Public Methods

```javascript
const widget = window.createChatWidget(options);

// Force reconnection
widget.reconnect();

// Clean up and remove widget
widget.destroy();
```

### 🛠️ Building the Widget

```bash
# Build the widget
npm run build-widget

# Output: dist/widget/chat-widget.iife.js
```

### 📊 Widget Size Information

- **Minified**: ~16.3 KB
- **Gzipped**: ~4.2 KB
- **Zero dependencies**

### 📱 Widget Responsive Design

The widget automatically adapts to different screen sizes:

- **Desktop**: Side-by-side layout (chat + users sidebar)
- **Mobile/Tablet**: Stacked layout (chat above, users below)
- **Fullscreen**: Always takes full viewport when opened

### 🎯 Widget Use Cases

- **Game Communities**: Perfect for JS13K games and other web games
- **Live Coding**: Real-time chat during coding sessions  
- **Customer Support**: Lightweight support chat
- **Educational Platforms**: Student-teacher communication
- **Events**: Chat for livestreams and webinars
- **Website Engagement**: Visitor chat for any website

---

## 🔗 WebSocket Protocol

Both the app and widget use a simple JSON message format:

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

MIT License - feel free to use in your projects!
