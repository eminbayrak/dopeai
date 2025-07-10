import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { default as MarkdownRenderer } from './components/MarkdownRenderer';

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
  const initializedRef = useRef(false);

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

      // Add screenshot as a visual message in chat (ChitKode style - screenshot ready for processing)
      const screenshotMessage: Message = {
        id: Date.now().toString(),
        type: 'screenshot',
        content: `📸 Screenshot captured and ready for analysis`,
        timestamp: new Date(),
        metadata: {
          screenshotData: data.dataURL
        }
      };
      setMessages(prev => [...prev, screenshotMessage]);
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

    // Handle process cancellation
    window.electronAPI.onProcessesCancelled(() => {
      setIsLoading(false);
      setConnectionStatus('connected');
      const message: Message = {
        id: Date.now().toString(),
        type: 'system',
        content: '⏹️ All processes cancelled',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, message]);
    });

    // Initial welcome message - only show once
    if (!initializedRef.current) {
      addSystemMessage(`🚀 AI Assistant Pro initialized with ChitKode-style screenshot processing!

📋 How to use:
• 📸 Capture: Ctrl+H or click Screenshot button
• 💬 Chat: Type your question and click Send - I'll analyze any screenshots using OCR
• 🔍 Analysis: Screenshots are processed using text extraction (OCR) when you send a message
• 🌐 URLs: Paste any YouTube/website URL for analysis
• 🔄 Context: I remember our conversation history
• ⏹️ Cancel: Ctrl+R to cancel all processes and clear screenshots

📌 Key difference: Screenshots are analyzed only when you click Send, not automatically!`);
      initializedRef.current = true;
    }

    return () => {
      // Cleanup listeners
      window.electronAPI.removeAllListeners('screenshot-captured');
      window.electronAPI.removeAllListeners('screenshots-cleared');
      window.electronAPI.removeAllListeners('window-resized');
      window.electronAPI.removeAllListeners('mouse-interaction-changed');
      window.electronAPI.removeAllListeners('processes-cancelled');
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
    const userMessage = inputValue.trim();
    const hasScreenshot = screenshots.length > 0;

    // Allow sending if there's either text or a screenshot
    if ((!userMessage && !hasScreenshot) || isLoading) return;

    setInputValue('');

    // Check if this is a URL
    if (userMessage) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = userMessage.match(urlRegex);

      if (urls && urls.length > 0) {
        // Handle URL analysis
        await handleAnalyzeUrl(urls[0], userMessage);
        return;
      }
    }

    // Add user message if there is text
    if (userMessage) {
      addMessage('user', userMessage);
    }

    setIsLoading(true);

    try {
      // Build context for the AI
      const context = buildChatContext();

      // Get the latest screenshot if available
      const latestScreenshot = hasScreenshot ? screenshots[screenshots.length - 1].dataURL : undefined;

      // Debug logging
      console.log('=== RENDERER DEBUG ===');
      console.log('User message:', userMessage);
      console.log('Has screenshot:', !!latestScreenshot);
      console.log('Screenshots array length:', screenshots.length);
      if (latestScreenshot) {
        console.log('Screenshot data length:', latestScreenshot.length);
        console.log('Screenshot prefix:', latestScreenshot.substring(0, 50));
      }

      // Use appropriate message for AI
      const messageForAI = userMessage || "Please analyze this screenshot and tell me what you see.";

      console.log('About to call chatWithAI with:', {
        message: messageForAI,
        hasContext: !!context,
        hasScreenshot: !!latestScreenshot
      });

      // Always include screenshot context if available
      const response = await window.electronAPI.chatWithAI(messageForAI, context, latestScreenshot);

      console.log('Received response from chatWithAI:', response.substring(0, 100));
      addMessage('ai', response);
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

      const response = await window.electronAPI.chatWithAI(
        'Analyze this screenshot and provide insights about what you see.',
        undefined,
        latestScreenshot.dataURL
      );
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

  const cancelAllProcesses = async () => {
    try {
      await window.electronAPI.cancelAllProcesses();
    } catch (error) {
      addSystemMessage(`Error cancelling processes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const checkOllamaConnection = async () => {
    setConnectionStatus('checking');
    try {
      // Test IPC first
      console.log('Testing IPC...');
      const ipcTest = await window.electronAPI.testIPC();
      console.log('IPC test result:', ipcTest);

      console.log('Testing chatWithAI...');
      await window.electronAPI.chatWithAI('test', undefined);
      setConnectionStatus('connected');
    } catch (error) {
      console.error('Connection test failed:', error);
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
            onClick={cancelAllProcesses}
            disabled={isLoading}
            className="action-btn clear-btn"
            title="Cancel All Processes & Clear Screenshots (Ctrl+R)"
          >
            ⏹️ Cancel ({screenshots.length})
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
                  <div className="message-text">
                    {message.type === 'ai' ? (
                      <MarkdownRenderer content={message.content} />
                    ) : (
                      message.content
                    )}
                  </div>
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
              placeholder="Ask about screenshots, paste URLs, or just hit Send to analyze the latest screenshot..."
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || (!inputValue.trim() && screenshots.length === 0)}
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
