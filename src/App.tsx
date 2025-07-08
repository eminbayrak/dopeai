import React, { useState, useEffect, useRef } from 'react';
import './App.css';

interface Message {
  id: string;
  type: 'user' | 'ai' | 'system' | 'screenshot' | 'url';
  content: string;
  timestamp: Date;
  metadata?: {
    screenshotData?: string;
    url?: string;
    contentType?: 'website' | 'video';
  };
}

interface ScreenshotData {
  path: string;
  dataURL: string;
  timestamp: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [windowState, setWindowState] = useState({
    isExpanded: false,
    isMouseInteractionEnabled: true,
    stealthMode: false
  });
  const [screenshots, setScreenshots] = useState<ScreenshotData[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const addSystemMessage = (content: string) => {
      const message: Message = {
        id: Date.now().toString(),
        type: 'system',
        content,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, message]);
    };

    // Load initial window state
    loadWindowState();

    // Set up event listeners
    window.electronAPI.onScreenshotCaptured((data: ScreenshotData) => {
      setScreenshots(prev => [...prev, data]);
      // Show a subtle notification instead of a system message
      addSystemMessage(`📸 Screenshot captured (${new Date(data.timestamp).toLocaleTimeString()}) - Ask me about it!`);
    });

    window.electronAPI.onScreenshotsCleared(() => {
      setScreenshots([]);
      addSystemMessage('Screenshots cleared');
    });

    window.electronAPI.onWindowResized((isExpanded: boolean) => {
      setWindowState(prev => ({ ...prev, isExpanded }));
    });

    window.electronAPI.onMouseInteractionChanged((enabled: boolean) => {
      setWindowState(prev => ({ ...prev, isMouseInteractionEnabled: enabled }));
    });

    // Initial welcome message
    addSystemMessage(`🚀 AI Assistant Pro initialized!

📋 How to use:
• 📸 Capture: Ctrl+H or click Screenshot button (silent capture)
• � Analyze: Ask "what do you see?" or "analyze this screenshot"
• 🌐 URLs: Paste any YouTube/website URL for analysis
• � Context: I remember our conversation and screenshots
• 🗑️ Clear: Ctrl+R to clear screenshots

Just chat naturally - I'll help you with screenshots, videos, and more!`);

    return () => {
      // Cleanup listeners
      window.electronAPI.removeAllListeners('screenshot-captured');
      window.electronAPI.removeAllListeners('screenshots-cleared');
      window.electronAPI.removeAllListeners('window-resized');
      window.electronAPI.removeAllListeners('mouse-interaction-changed');
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadWindowState = async () => {
    try {
      const state = await window.electronAPI.getWindowState();
      setWindowState(state);
    } catch (error) {
      console.error('Error loading window state:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addMessage = (type: 'user' | 'ai' | 'system' | 'screenshot' | 'url', content: string, metadata?: Message['metadata']) => {
    const message: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
      metadata
    };
    setMessages(prev => {
      const updated = [...prev, message];
      return updated;
    });
  };

  const addSystemMessage = (content: string) => {
    addMessage('system', content);
  };

  const buildChatContext = (): string => {
    let context = '';

    // Add recent conversation context
    if (messages.length > 0) {
      const recentMessages = messages.slice(-5); // Last 5 messages for context
      context += 'Recent conversation context:\n';
      recentMessages.forEach(msg => {
        if (msg.type !== 'system') {
          context += `${msg.type}: ${msg.content}\n`;
        }
      });
      context += '\n';
    }

    // Add screenshot context
    if (screenshots.length > 0) {
      context += `Available screenshots: ${screenshots.length} screenshots captured. `;
      context += `Latest screenshot taken at: ${new Date(screenshots[screenshots.length - 1].timestamp).toLocaleString()}.\n`;
      context += `The user can reference these screenshots in their questions.\n`;
    }

    // Add URL context from recent messages
    const urlMessages = messages.filter(msg => msg.type === 'url').slice(-3);
    if (urlMessages.length > 0) {
      context += `Recently analyzed URLs: ${urlMessages.map(msg => msg.metadata?.url).join(', ')}\n`;
    }

    return context;
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');

    // Check if this is a URL
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = userMessage.match(urlRegex);

    if (urls && urls.length > 0) {
      // Handle URL analysis
      await handleAnalyzeUrl(urls[0], userMessage);
      return;
    }

    addMessage('user', userMessage);
    setIsLoading(true);

    try {
      // Check if the message is asking about screenshots
      const askingAboutScreenshots = userMessage.toLowerCase().includes('screenshot') || 
                                   userMessage.toLowerCase().includes('image') ||
                                   userMessage.toLowerCase().includes('see') ||
                                   userMessage.toLowerCase().includes('analyze') ||
                                   userMessage.toLowerCase().includes('look');

      if (screenshots.length > 0 && askingAboutScreenshots) {
        // If asking about screenshots, analyze the latest one
        const latestScreenshot = screenshots[screenshots.length - 1];
        addMessage('screenshot', 'Analyzing screenshot...', {
          screenshotData: latestScreenshot.dataURL
        });

        const response = await window.electronAPI.analyzeScreenshot(latestScreenshot.dataURL);
        addMessage('ai', response);
      } else {
        // Regular chat with context
        const context = buildChatContext();
        const response = await window.electronAPI.chatWithAI(userMessage, context);
        addMessage('ai', response);
      }
    } catch (error) {
      addMessage('ai', `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTakeScreenshot = async () => {
    try {
      await window.electronAPI.takeScreenshot();
      // Don't add any message here - just capture silently
    } catch (error) {
      addSystemMessage(`Screenshot error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleAnalyzeLatestScreenshot = async () => {
    if (screenshots.length === 0) {
      addSystemMessage('No screenshots available to analyze');
      return;
    }

    setIsLoading(true);
    try {
      const latestScreenshot = screenshots[screenshots.length - 1];
      addMessage('screenshot', 'Analyzing latest screenshot...', {
        screenshotData: latestScreenshot.dataURL
      });

      const response = await window.electronAPI.analyzeScreenshot(latestScreenshot.dataURL);
      addMessage('ai', response);
    } catch (error) {
      addMessage('ai', `Analysis error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeUrl = async (url: string, originalMessage?: string) => {
    setIsLoading(true);

    if (originalMessage) {
      addMessage('user', originalMessage);
    }

    addMessage('url', `🔍 Analyzing: ${url}`, { url });

    try {
      // Determine if it's a video URL or website
      const isVideo = url.includes('youtube.com') || url.includes('youtu.be') ||
        url.includes('vimeo.com') || url.includes('twitch.tv');

      let content: string;
      let contentType: 'website' | 'video';

      if (isVideo) {
        const videoInfo = await window.electronAPI.extractVideoInfo(url);
        content = `Title: ${videoInfo.title}\n\nDescription: ${videoInfo.description}`;
        contentType = 'video';
        addSystemMessage(`✅ Video info extracted: ${videoInfo.title}`);
      } else {
        content = await window.electronAPI.extractWebsiteContent(url);
        contentType = 'website';
        addSystemMessage(`✅ Website content extracted (${content.length} characters)`);
      }

      // Add context about this URL for future reference
      const analysis = await window.electronAPI.analyzeContent(content, contentType);
      addMessage('ai', analysis);
    } catch (error) {
      addMessage('ai', `Error analyzing URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      action();
    }
  };

  const toggleWindowSize = async () => {
    try {
      const newState = await window.electronAPI.toggleWindowSize();
      setWindowState(prev => ({ ...prev, isExpanded: newState }));
    } catch (error) {
      addSystemMessage(`Error toggling window size: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const toggleMouseInteraction = async () => {
    try {
      const newState = await window.electronAPI.toggleMouseInteraction();
      setWindowState(prev => ({ ...prev, isMouseInteractionEnabled: newState }));
    } catch (error) {
      addSystemMessage(`Error toggling mouse interaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const clearScreenshots = async () => {
    try {
      await window.electronAPI.clearScreenshots();
    } catch (error) {
      addSystemMessage(`Error clearing screenshots: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const checkOllamaConnection = async () => {
    setConnectionStatus('checking');
    try {
      await window.electronAPI.chatWithAI('test', undefined);
      setConnectionStatus('connected');
    } catch {
      setConnectionStatus('disconnected');
    }
  };

  // Check connection on mount and periodically
  useEffect(() => {
    checkOllamaConnection();
    const interval = setInterval(checkOllamaConnection, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app">
      <div className="app-header">
        <h1>AI Assistant Pro</h1>
        <div className="connection-status">
          <span className={`status-indicator ${connectionStatus}`}>
            {connectionStatus === 'connected' ? '🟢' : connectionStatus === 'disconnected' ? '🔴' : '🟡'}
          </span>
          <span className="status-text">
            {connectionStatus === 'connected' ? 'Ollama Connected' :
              connectionStatus === 'disconnected' ? 'Ollama Offline' : 'Checking...'}
          </span>
        </div>
        <div className="window-controls">
          <button
            onClick={toggleWindowSize}
            className={`control-btn ${windowState.isExpanded ? 'active' : ''}`}
            title="Toggle window size (Ctrl+E)"
          >
            {windowState.isExpanded ? '🗗' : '🗖'}
          </button>
          <button
            onClick={toggleMouseInteraction}
            className={`control-btn ${windowState.isMouseInteractionEnabled ? 'active' : ''}`}
            title="Toggle mouse interaction (Ctrl+M)"
          >
            {windowState.isMouseInteractionEnabled ? '🖱️' : '🚫'}
          </button>
        </div>
      </div>

      <div className="unified-chat-container">
        {/* Quick Actions Bar */}
        <div className="quick-actions">
          <button
            onClick={handleTakeScreenshot}
            disabled={isLoading}
            className="action-btn screenshot-btn"
            title="Take Screenshot (Ctrl+H)"
          >
            📸 Screenshot
          </button>
          <button
            onClick={handleAnalyzeLatestScreenshot}
            disabled={isLoading || screenshots.length === 0}
            className="action-btn analyze-btn"
            title="Analyze Latest Screenshot"
          >
            🔍 Analyze Latest
          </button>
          <button
            onClick={clearScreenshots}
            disabled={isLoading}
            className="action-btn clear-btn"
            title="Clear Screenshots (Ctrl+R)"
          >
            🗑️ Clear ({screenshots.length})
          </button>
        </div>

        {/* Chat Messages */}
        <div className="chat-container">
          <div className="messages">
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.type}`}>
                <div className="message-content">
                  {message.type === 'screenshot' && message.metadata?.screenshotData && (
                    <div className="screenshot-preview">
                      <img
                        src={message.metadata.screenshotData}
                        alt="Screenshot"
                        className="screenshot-thumbnail-inline"
                      />
                    </div>
                  )}
                  {message.type === 'url' && message.metadata?.url && (
                    <div className="url-preview">
                      🔗 <a href={message.metadata.url} target="_blank" rel="noopener noreferrer">
                        {message.metadata.url}
                      </a>
                    </div>
                  )}
                  <div className="message-text">{message.content}</div>
                </div>
                <div className="message-time">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message ai loading">
                <div className="message-content">🤔 AI is thinking...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="chat-input">
            <input
              ref={chatInputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => handleKeyPress(e, handleSendMessage)}
              placeholder="Type a message, paste a URL, or ask about screenshots... (Enter to send)"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !inputValue.trim()}
              className="send-btn"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      <div className="status-bar">
        <span>Status: {isLoading ? '⏳ Processing...' : '✅ Ready'}</span>
        <span>Window: {windowState.isExpanded ? 'Expanded' : 'Compact'}</span>
        <span>Mouse: {windowState.isMouseInteractionEnabled ? 'Enabled' : 'Disabled'}</span>
        <span>Connection: {connectionStatus === 'checking' ? '⏳ Checking...' : connectionStatus === 'connected' ? '✅ Connected' : '❌ Disconnected'}</span>
      </div>
    </div>
  );
}

export default App;
