# AI Assistant Pro

A powerful Electron application that combines screenshot analysis, video/website content analysis, and AI chat functionality using local LLM through Ollama.

## Features

### 🖼️ Screenshot Analysis

- **Global Hotkeys**: Press `Ctrl+H` to capture screenshots instantly
- **AI Analysis**: Automatically analyze screenshots with local LLM
- **Screenshot Management**: View, organize, and clear screenshots
- **Visual Interface**: Thumbnail view of all captured screenshots

### 🌐 Content Analysis

- **Website Analysis**: Paste any website URL to extract and analyze content
- **Video Analysis**: Support for YouTube, Vimeo, and other video platforms
- **Smart Content Extraction**: Intelligent text extraction from web pages
- **AI Insights**: Get comprehensive summaries and key insights

### 💬 AI Chat Interface

- **Local LLM**: Powered by Ollama for privacy and speed
- **Context Awareness**: Chat with awareness of captured screenshots
- **Real-time Conversations**: Interactive chat with your AI assistant
- **Multiple Models**: Support for different Ollama models

### 🎮 Interactive Controls

- **Mouse & Keyboard**: Full interaction support (not just hotkeys)
- **Window Management**: Resizable, movable, always-on-top window
- **Compact/Expanded Views**: Toggle between compact and full interface
- **Stealth Mode**: Privacy-focused mode for sensitive environments

### 🔗 Connection Monitoring

- **Real-time Status**: Live connection status indicator for Ollama
- **Auto-retry**: Automatic connection checking every 30 seconds
- **Visual Feedback**: Color-coded status indicators (🟢 Connected, 🔴 Offline, 🟡 Checking)

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Electron 37 + Node.js
- **AI**: Ollama local LLM integration
- **Styling**: Modern CSS with glassmorphism design
- **Tools**: Axios, Cheerio, youtube-dl-exec

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Ollama** (v0.1.0 or higher)
   - Install from [https://ollama.ai](https://ollama.ai)
   - Pull a model: `ollama pull llama3.2`

## Installation

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd ai-assistant-pro
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment**

   ```bash
   cp .env.example .env
   # Edit .env with your Ollama settings
   ```

4. **Build and run**
   ```bash
   npm run start
   ```

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Development
NODE_ENV=development
```

### Ollama Setup

1. Install Ollama from [https://ollama.ai](https://ollama.ai)
2. Start Ollama: `ollama serve`
3. Pull a model: `ollama pull llama3.2`
4. Verify it's running: `curl http://localhost:11434/api/tags`

## Usage

### Global Hotkeys

| Hotkey       | Action                                |
| ------------ | ------------------------------------- |
| `Ctrl+H`     | Take screenshot                       |
| `Ctrl+R`     | Clear all screenshots                 |
| `Ctrl+B`     | Toggle window visibility              |
| `Ctrl+E`     | Toggle window size (compact/expanded) |
| `Ctrl+M`     | Toggle mouse interaction              |
| `Ctrl+Q`     | Quit application                      |
| `Arrow Keys` | Move window (with Ctrl)               |

### Interface Tabs

- **💬 Chat**: Interactive AI conversation interface
- **📸 Screenshots**: Screenshot capture and management
- **🌐 Content**: Website and video analysis tools

### Workflow Examples

1. **Screenshot Analysis**

   - Press `Ctrl+H` to capture
   - Switch to Screenshots tab
   - Click "Analyze Latest" for AI insights

2. **Website Analysis**

   - Go to Content tab
   - Paste any website URL
   - Click "Analyze" for AI summary

3. **AI Chat**
   - Use Chat tab for conversations
   - Context from screenshots automatically included
   - Ask questions about captured content

## Development

### Project Structure

```
ai-assistant-pro/
├── src/
│   ├── main/           # Electron main process
│   │   ├── main.ts     # Main process entry
│   │   └── preload.ts  # Preload script
│   ├── App.tsx         # React main component
│   ├── App.css         # Styles
│   └── main.tsx        # React entry point
├── dist-electron/      # Compiled Electron files
├── dist/              # Compiled React files
└── package.json
```

### Available Scripts

```bash
# Development
npm run dev              # Start Vite dev server
npm run electron-dev     # Start Electron with dev server
npm run start           # Build and start Electron

# Building
npm run build           # Build React app
npm run build-electron  # Build Electron main process
npm run dist           # Build and package for distribution

# Utilities
npm run lint           # Run ESLint
npm run preview        # Preview built app
```
