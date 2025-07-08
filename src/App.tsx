import React, { useState, useEffect, useRef } from 'react';
import './App.css';

interface Message {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
}

interface ScreenshotData {
  path: string;
  dataURL: string;
  timestamp: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [windowState, setWindowState] = useState({
    isExpanded: false,
    isMouseInteractionEnabled: true,
    stealthMode: false
  });
  const [screenshots, setScreenshots] = useState<ScreenshotData[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'screenshot' | 'content'>('chat');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const addSystemMessage = (content: string) => {
      addMessage('system', content);
    };

    // Load initial window state
    loadWindowState();

    // Set up event listeners
    window.electronAPI.onScreenshotCaptured((data: ScreenshotData) => {
      setScreenshots(prev => [...prev, data]);
      addSystemMessage(`Screenshot captured: ${new Date(data.timestamp).toLocaleTimeString()}`);
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
    addSystemMessage('AI Assistant Pro initialized. Use Ctrl+H for screenshots, or interact directly with the interface.');

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

  const addMessage = (type: 'user' | 'ai' | 'system', content: string) => {
    const message: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

  const addSystemMessage = (content: string) => {
    addMessage('system', content);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    addMessage('user', userMessage);
    setIsLoading(true);

    try {
      // Get context from recent screenshots if available
      const context = screenshots.length > 0
        ? `Recent screenshots captured: ${screenshots.length} screenshots available for analysis.`
        : undefined;

      const response = await window.electronAPI.chatWithAI(userMessage, context);
      addMessage('ai', response);
    } catch (error) {
      addMessage('ai', `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTakeScreenshot = async () => {
    setIsLoading(true);
    try {
      await window.electronAPI.takeScreenshot();
    } catch (error) {
      addSystemMessage(`Screenshot error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
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
      addMessage('user', 'Analyze latest screenshot');

      const response = await window.electronAPI.analyzeScreenshot(latestScreenshot.dataURL);
      addMessage('ai', response);
    } catch (error) {
      addMessage('ai', `Analysis error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeUrl = async () => {
    if (!urlInput.trim() || isLoading) return;

    const url = urlInput.trim();
    setIsLoading(true);
    addMessage('user', `Analyze: ${url}`);

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
        addSystemMessage(`Video info extracted: ${videoInfo.title}`);
      } else {
        content = await window.electronAPI.extractWebsiteContent(url);
        contentType = 'website';
        addSystemMessage(`Website content extracted (${content.length} characters)`);
      }

      const analysis = await window.electronAPI.analyzeContent(content, contentType);
      addMessage('ai', analysis);

      setUrlInput('');
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

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          💬 Chat
        </button>
        <button
          className={`tab ${activeTab === 'screenshot' ? 'active' : ''}`}
          onClick={() => setActiveTab('screenshot')}
        >
          📸 Screenshots ({screenshots.length})
        </button>
        <button
          className={`tab ${activeTab === 'content' ? 'active' : ''}`}
          onClick={() => setActiveTab('content')}
        >
          🌐 Content Analysis
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'chat' && (
          <div className="chat-container">
            <div className="messages">
              {messages.map((message) => (
                <div key={message.id} className={`message ${message.type}`}>
                  <div className="message-content">{message.content}</div>
                  <div className="message-time">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="message ai loading">
                  <div className="message-content">AI is thinking...</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input">
              <input
                ref={chatInputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleSendMessage)}
                placeholder="Type your message... (Enter to send)"
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
        )}

        {activeTab === 'screenshot' && (
          <div className="screenshot-container">
            <div className="screenshot-controls">
              <button onClick={handleTakeScreenshot} disabled={isLoading} className="action-btn">
                📸 Take Screenshot (Ctrl+H)
              </button>
              <button
                onClick={handleAnalyzeLatestScreenshot}
                disabled={isLoading || screenshots.length === 0}
                className="action-btn"
              >
                🔍 Analyze Latest
              </button>
              <button onClick={clearScreenshots} disabled={isLoading} className="action-btn danger">
                🗑️ Clear All (Ctrl+R)
              </button>
            </div>

            <div className="screenshots-grid">
              {screenshots.length === 0 ? (
                <div className="empty-state">
                  <p>No screenshots captured yet</p>
                  <p>Press Ctrl+H or click the button above to capture</p>
                </div>
              ) : (
                screenshots.map((screenshot, index) => (
                  <div key={screenshot.timestamp} className="screenshot-item">
                    <img
                      src={screenshot.dataURL}
                      alt={`Screenshot ${index + 1}`}
                      className="screenshot-thumbnail"
                    />
                    <div className="screenshot-info">
                      <small>{new Date(screenshot.timestamp).toLocaleString()}</small>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'content' && (
          <div className="content-container">
            <div className="url-input">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleAnalyzeUrl)}
                placeholder="Enter URL (website or video)..."
                disabled={isLoading}
              />
              <button
                onClick={handleAnalyzeUrl}
                disabled={isLoading || !urlInput.trim()}
                className="action-btn"
              >
                🔍 Analyze
              </button>
            </div>

            <div className="content-info">
              <h3>Supported Content Types:</h3>
              <ul>
                <li>🌐 Websites - Extract and analyze text content</li>
                <li>📺 YouTube videos - Get title, description, and insights</li>
                <li>🎬 Vimeo videos - Extract video metadata</li>
                <li>📡 Other video platforms - Basic info extraction</li>
              </ul>
            </div>
          </div>
        )}
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
