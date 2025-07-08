<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# AI Assistant Pro - Copilot Instructions

This is an Electron application called "AI Assistant Pro" that combines screenshot analysis, video/website content analysis, and AI chat functionality using local LLM through Ollama.

## Project Structure

- `src/main/` - Electron main process (TypeScript)
- `src/` - React renderer process (TypeScript)
- Uses Vite for development and building
- Integrates with Ollama for local AI processing

## Key Features

1. **Screenshot Capture & Analysis** - Capture screenshots and analyze them with AI
2. **Video/Website Content Analysis** - Extract and analyze content from URLs
3. **AI Chat Interface** - Interactive chat with local LLM
4. **Window Controls** - Resizable, movable, with stealth mode options
5. **Mouse & Keyboard Interaction** - Full interaction support

## Technologies Used

- Electron with TypeScript
- React with hooks
- Vite for build tooling
- Ollama for local LLM integration
- Axios for HTTP requests
- Cheerio for web scraping
- youtube-dl-exec for video processing

## Development Guidelines

- Use TypeScript strictly with proper type definitions
- Follow React best practices with functional components and hooks
- Implement proper error handling for all async operations
- Use IPC for secure communication between main and renderer processes
- Maintain responsive design that works in both compact and expanded window modes
- Ensure all Ollama API calls include proper error handling and user feedback

## API Integration

- All AI functionality goes through Ollama REST API
- Default model is llama3.2 but should be configurable
- Handle connection errors gracefully when Ollama is not running
- Provide clear user feedback for all operations

## Security Considerations

- Use contextBridge for secure IPC communication
- Disable node integration in renderer process
- Validate all user inputs before processing
- Handle file system operations safely in main process
