import { app, BrowserWindow, globalShortcut, ipcMain, desktopCapturer, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import axios from 'axios';
import * as cheerio from 'cheerio';
import youtubedl from 'youtube-dl-exec';
import { fileURLToPath } from 'url';
import Tesseract from 'tesseract.js';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

let mainWindow: BrowserWindow;
let isWindowVisible = true;
let isExpanded = false;
let isMouseInteractionEnabled = true; // Enable mouse by default
const stealthMode = false; // Disable stealth mode by default

// Global abort controller for cancelling API calls
let currentAbortController: AbortController | null = null;

// Define window dimensions - ChitKode style
const smallSize = { width: 400, height: 500 };
const largeSize = { width: 800, height: 700 };

// Ollama API configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

/**
 * Call Ollama API for text generation
 */
async function callOllamaAPI(prompt: string, model: string = DEFAULT_MODEL): Promise<string> {
    try {
        console.log(`Calling Ollama API with model: ${model}`);

        // Cancel previous request if any
        if (currentAbortController) {
            currentAbortController.abort();
        }

        // Create a new abort controller for this request
        currentAbortController = new AbortController();
        const { signal } = currentAbortController;

        const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
            model: model,
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.7,
                num_predict: 2000  // Changed from max_tokens to num_predict for Ollama
            }
        }, {
            timeout: 60000,  // 60 second timeout
            headers: {
                'Content-Type': 'application/json'
            },
            signal: signal // Attach the abort signal to the request
        });

        if (response.data && response.data.response) {
            return response.data.response;
        } else {
            throw new Error('Invalid response from Ollama API');
        }
    } catch (error) {
        console.error('Error calling Ollama API:', error);
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNREFUSED') {
                throw new Error('Cannot connect to Ollama. Please make sure Ollama is running on http://localhost:11434');
            }
            throw new Error(`Ollama API error: ${error.message}`);
        }
        throw error;
    }
}

/**
 * Extract content from a website URL
 */
async function extractWebsiteContent(url: string): Promise<string> {
    try {
        console.log(`Extracting content from: ${url}`);

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 30000
        });

        const $ = cheerio.load(response.data);

        // Remove script and style elements
        $('script, style, nav, footer, header, aside').remove();

        // Extract main content
        let content = '';

        // Try to find main content areas
        const mainSelectors = ['main', 'article', '.content', '.post-content', '.entry-content', '#content'];
        let mainContent = '';

        for (const selector of mainSelectors) {
            const element = $(selector);
            if (element.length > 0) {
                mainContent = element.text().trim();
                if (mainContent.length > 200) {
                    content = mainContent;
                    break;
                }
            }
        }

        // Fallback to body content if no main content found
        if (!content) {
            content = $('body').text().trim();
        }

        // Clean up the content
        content = content
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, '\n')
            .trim();

        // Limit content length
        if (content.length > 8000) {
            content = content.substring(0, 8000) + '...';
        }

        console.log(`Extracted ${content.length} characters from website`);
        return content;

    } catch (error) {
        console.error('Error extracting website content:', error);
        throw new Error(`Failed to extract content from website: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Extract information from a video URL
 */
async function extractVideoInfo(url: string): Promise<{ title: string; description: string; transcript?: string; }> {
    try {
        console.log(`Extracting video info from: ${url}`);

        interface VideoInfo {
            title?: string;
            description?: string;
        }

        // Get video metadata
        const info = await youtubedl(url, {
            dumpSingleJson: true,
            noWarnings: true,
            callHome: false,
            noCheckCertificates: true,
            preferFreeFormats: true,
            youtubeSkipDashManifest: true,
        });

        const videoInfo = info as VideoInfo;
        const result = {
            title: videoInfo.title || 'Unknown Title',
            description: videoInfo.description || 'No description available',
        };

        console.log(`Extracted video info: ${result.title}`);
        return result;

    } catch (error) {
        console.error('Error extracting video info:', error);
        throw new Error(`Failed to extract video information: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Capture screenshot
 */
async function captureScreenshot(): Promise<string> {
    try {
        console.log('Capturing screenshot...');

        // Hide window temporarily if visible
        let wasVisible = false;
        if (isWindowVisible && !stealthMode) {
            wasVisible = true;
            mainWindow.hide();
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 1920, height: 1080 }
        });

        // Show window again if it was hidden
        if (wasVisible && !stealthMode) {
            mainWindow.show();
        }

        const primaryDisplay = sources[0];
        if (!primaryDisplay) {
            throw new Error('No display found');
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const screenshotsDir = path.join(app.getPath('userData'), 'screenshots');

        if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
        }

        const filePath = path.join(screenshotsDir, `screenshot-${timestamp}.png`);
        const buffer = primaryDisplay.thumbnail.toPNG();
        fs.writeFileSync(filePath, buffer);

        const dataURL = primaryDisplay.thumbnail.toDataURL();

        // Send screenshot to renderer
        mainWindow.webContents.send('screenshot-captured', {
            path: filePath,
            dataURL: dataURL,
            timestamp: new Date().toISOString()
        });

        console.log('Screenshot captured successfully');
        return dataURL;

    } catch (error) {
        console.error('Error capturing screenshot:', error);
        throw error;
    }
}

/**
 * Clear all screenshots
 */
function clearScreenshots(): void {
    try {
        const screenshotsDir = path.join(app.getPath('userData'), 'screenshots');

        if (!fs.existsSync(screenshotsDir)) {
            return;
        }

        const files = fs.readdirSync(screenshotsDir);
        let deletedCount = 0;

        for (const file of files) {
            if (file.startsWith('screenshot-')) {
                const filePath = path.join(screenshotsDir, file);
                fs.unlinkSync(filePath);
                deletedCount++;
            }
        }

        console.log(`Deleted ${deletedCount} screenshot files`);
        mainWindow.webContents.send('screenshots-cleared');

    } catch (error) {
        console.error('Error clearing screenshots:', error);
    }
}

/**
 * Cancel all ongoing API calls and clear screenshots
 */
function cancelAllProcesses(): void {
    if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
        console.log('All API calls cancelled');
    }

    // Clear screenshots as well
    clearScreenshots();

    // Notify renderer that processes were cancelled
    mainWindow.webContents.send('processes-cancelled');
}

/**
 * Toggle window visibility
 */
function toggleWindowVisibility(): void {
    if (isWindowVisible) {
        mainWindow.hide();
    } else {
        mainWindow.show();
        mainWindow.focus();
    }
    isWindowVisible = !isWindowVisible;
}

/**
 * Toggle window size
 */
function toggleWindowSize(): void {
    try {
        if (isExpanded) {
            mainWindow.setSize(smallSize.width, smallSize.height, true);
        } else {
            mainWindow.setSize(largeSize.width, largeSize.height, true);
        }

        mainWindow.center();
        isExpanded = !isExpanded;

        mainWindow.webContents.send('window-resized', isExpanded);
        console.log(`Window ${isExpanded ? 'expanded' : 'collapsed'}`);

    } catch (error) {
        console.error('Error toggling window size:', error);
    }
}

/**
 * Toggle mouse interaction
 */
function toggleMouseInteraction(): void {
    isMouseInteractionEnabled = !isMouseInteractionEnabled;
    mainWindow.setIgnoreMouseEvents(!isMouseInteractionEnabled);

    mainWindow.webContents.send('mouse-interaction-changed', isMouseInteractionEnabled);
    console.log(`Mouse interaction ${isMouseInteractionEnabled ? 'enabled' : 'disabled'}`);
}

/**
 * Create the main window
 */
async function createWindow(): Promise<void> {
    console.log('Creating main window...');

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    mainWindow = new BrowserWindow({
        width: smallSize.width,
        height: smallSize.height,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        frame: false,
        transparent: false,
        backgroundColor: '#141414',
        alwaysOnTop: true,
        skipTaskbar: false,
        resizable: true,
        maximizable: false,
        minimizable: true,
        show: false,
        titleBarStyle: 'hidden'
    });

    // Enable mouse interaction by default
    mainWindow.setIgnoreMouseEvents(false);

    // Position window
    mainWindow.center();
    mainWindow.show();
    mainWindow.focus();

    console.log(`Window created at position: ${mainWindow.getPosition()}`);
    console.log(`Screen dimensions: ${screenWidth}x${screenHeight}`);

    // Register global shortcuts
    registerGlobalShortcuts();

    // Load the app
    const isDev = process.env.NODE_ENV === 'development' && process.argv.includes('--dev');
    if (isDev) {
        console.log('Development mode: Loading from Vite dev server...');
        await loadViteDevServer();
    } else {
        console.log('Production mode: Loading from built files...');
        const indexPath = path.join(__dirname, '../dist/index.html');
        console.log(`Loading from: ${indexPath}`);
        mainWindow.loadFile(indexPath);
    }

    // Window event listeners
    mainWindow.on('ready-to-show', () => {
        console.log('Window ready to show');
        mainWindow.show();
        mainWindow.focus();
    });

    mainWindow.on('resize', () => {
        const [width, height] = mainWindow.getSize();
        console.log(`Window resized to: ${width}x${height}`);
    });

    mainWindow.webContents.on('did-finish-load', () => {
        console.log('Window content loaded');
        clearScreenshots(); // Clear old screenshots on startup
    });
}

/**
 * Dynamically detect the Vite dev server port
 */
async function loadViteDevServer(): Promise<void> {
    const defaultPort = parseInt(process.env.VITE_PORT || '5179', 10);
    const portsToTry = [defaultPort, 5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180];

    for (const port of portsToTry) {
        try {
            console.log(`Trying to connect to Vite dev server on port ${port}...`);
            await axios.get(`http://localhost:${port}`, { timeout: 1000 });
            console.log(`Found Vite dev server on port ${port}`);
            mainWindow.loadURL(`http://localhost:${port}`);
            mainWindow.webContents.openDevTools({ mode: 'detach' });
            return;
        } catch {
            console.log(`Port ${port} not available, trying next...`);
        }
    }

    console.error('Could not find Vite dev server on any of the expected ports');
    console.error('Make sure the dev server is running with "npm run dev"');

    // Fallback to default port
    const fallbackPort = defaultPort;
    console.log(`Falling back to default port ${fallbackPort}`);
    mainWindow.loadURL(`http://localhost:${fallbackPort}`);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
}

/**
 * Register global shortcuts
 */
function registerGlobalShortcuts(): void {
    // Screenshot shortcut
    globalShortcut.register('CommandOrControl+H', () => {
        console.log('Screenshot shortcut pressed');
        captureScreenshot();
    });

    // Clear screenshots shortcut - now cancels all processes
    globalShortcut.register('CommandOrControl+R', () => {
        console.log('Cancel all processes shortcut pressed');
        cancelAllProcesses();
    });

    // Toggle visibility shortcut
    globalShortcut.register('CommandOrControl+B', () => {
        console.log('Toggle visibility shortcut pressed');
        toggleWindowVisibility();
    });

    // Toggle window size shortcut
    globalShortcut.register('CommandOrControl+E', () => {
        console.log('Toggle window size shortcut pressed');
        toggleWindowSize();
    });

    // Toggle mouse interaction shortcut
    globalShortcut.register('CommandOrControl+M', () => {
        console.log('Toggle mouse interaction shortcut pressed');
        toggleMouseInteraction();
    });

    // Quit app shortcut
    globalShortcut.register('CommandOrControl+Q', () => {
        console.log('Quit app shortcut pressed');
        app.quit();
    });

    // Window movement shortcuts
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    globalShortcut.register('CommandOrControl+Up', () => {
        const [x, y] = mainWindow.getPosition();
        mainWindow.setPosition(x, Math.max(0, y - 50));
    });

    globalShortcut.register('CommandOrControl+Down', () => {
        const [x, y] = mainWindow.getPosition();
        mainWindow.setPosition(x, Math.min(screenHeight - 200, y + 50));
    });

    globalShortcut.register('CommandOrControl+Left', () => {
        const [x, y] = mainWindow.getPosition();
        mainWindow.setPosition(Math.max(0, x - 50), y);
    });

    globalShortcut.register('CommandOrControl+Right', () => {
        const [x, y] = mainWindow.getPosition();
        mainWindow.setPosition(Math.min(screenWidth - 400, x + 50), y);
    });
}

// IPC Handlers
ipcMain.handle('take-screenshot', async () => {
    return await captureScreenshot();
});

ipcMain.handle('clear-screenshots', () => {
    clearScreenshots();
    return true;
});

ipcMain.handle('toggle-window-size', () => {
    toggleWindowSize();
    return isExpanded;
});

ipcMain.handle('toggle-mouse-interaction', () => {
    toggleMouseInteraction();
    return isMouseInteractionEnabled;
});

ipcMain.handle('get-window-state', () => {
    return {
        isExpanded,
        isMouseInteractionEnabled,
        stealthMode
    };
});

ipcMain.handle('call-ollama', async (_event, prompt: string, model?: string) => {
    return await callOllamaAPI(prompt, model);
});

ipcMain.handle('extract-website-content', async (_event, url: string) => {
    return await extractWebsiteContent(url);
});

ipcMain.handle('extract-video-info', async (_event, url: string) => {
    return await extractVideoInfo(url);
});

ipcMain.handle('analyze-content', async (_event, content: string, contentType: 'website' | 'video') => {
    const prompt = contentType === 'website'
        ? `Analyze this website content and provide a comprehensive summary, key insights, and main points:

${content}`
        : `Analyze this video information and provide insights about the content, main topics, and key takeaways:

${content}`;

    return await callOllamaAPI(prompt);
});

ipcMain.handle('chat-with-ai', async (_event, message: string, context?: string, latestScreenshot?: string) => {
    console.log('🔴🔴🔴 CHAT-WITH-AI HANDLER CALLED! 🔴🔴🔴');
    console.log('🔴🔴🔴 Message received:', message);
    console.log('🔴🔴🔴 Has context:', !!context);
    console.log('🔴🔴🔴 Has screenshot:', !!latestScreenshot);

    // Handle connection test
    if (message === 'test') {
        console.log('🔴🔴🔴 Connection test requested');
        try {
            await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 3000 });
            return 'Connection successful';
        } catch {
            throw new Error('Ollama server not available');
        }
    }

    // Debug logging
    console.log('=== CHAT WITH AI DEBUG ===');
    console.log('Message:', message);
    console.log('Context length:', context ? context.length : 'no context');
    console.log('Has screenshot:', !!latestScreenshot);
    if (latestScreenshot) {
        console.log('Screenshot data length:', latestScreenshot.length);
        console.log('Screenshot starts with:', latestScreenshot.substring(0, 50));
    }

    // Check if we have a screenshot to analyze - ChitKode style OCR processing
    if (latestScreenshot) {
        console.log('Processing screenshot with OCR (ChitKode style)...');
        try {
            // Cancel previous request if any
            if (currentAbortController) {
                currentAbortController.abort();
            }

            // Create a new abort controller for this request
            currentAbortController = new AbortController();
            const { signal } = currentAbortController;

            console.log('Step 1: Extracting text using OCR...');

            // Convert base64 to buffer for OCR
            const base64Data = latestScreenshot.includes(',') ? latestScreenshot.split(',')[1] : latestScreenshot;
            const imageBuffer = Buffer.from(base64Data, 'base64');

            // Use Tesseract.js for OCR (same as ChitKode)
            const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng', {
                logger: (m: { status: string; progress?: number; }) => {
                    console.log(`OCR Progress: ${m.status} ${m.progress ? `(${Math.round(m.progress * 100)}%)` : ''}`);
                }
            });

            const extractedText = text.trim();
            console.log('OCR extraction completed');
            console.log('Extracted text length:', extractedText.length);
            console.log('Extracted text preview:', extractedText.substring(0, 200) + (extractedText.length > 200 ? '...' : ''));

            if (extractedText && extractedText.length > 10) {
                // Step 2: Use text model to analyze the extracted text with user's question
                console.log('Step 2: Analyzing extracted text with AI...');

                // Create a focused prompt for coding problems
                const analysisPrompt = `I need help with a coding problem. Here's the extracted text from a screenshot:

${extractedText.substring(0, 800)}${extractedText.length > 800 ? '...' : ''}

User asked: "${message}"

Please provide a complete solution for this coding problem. Focus on:
1. Problem understanding
2. Solution approach
3. Working code
4. Time/space complexity

Response:`;

                const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
                    model: DEFAULT_MODEL,
                    prompt: analysisPrompt,
                    stream: false,
                    options: {
                        temperature: 0.3,
                        num_predict: 1500
                    }
                }, {
                    timeout: 120000, // Increased to 2 minutes
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    signal: signal
                });

                if (response.data && response.data.response) {
                    const result = response.data.response;
                    console.log('AI analysis completed');
                    return result;
                } else {
                    console.warn('No response from AI model, falling back to extracted text');
                    return `I extracted this text from the screenshot:\n\n${extractedText.substring(0, 500)}${extractedText.length > 500 ? '...' : ''}\n\nRegarding your question: "${message}"\n\nPlease let me know if you need help with anything specific from this content.`;
                }
            } else {
                console.warn('No meaningful text extracted from OCR');
                return `I was unable to extract meaningful text from the screenshot. The image might contain mostly graphics, be unclear, or have very little text. Please try one of the following:

1. Take a clearer screenshot
2. Describe what you're seeing in the image
3. Ask your question without referencing the screenshot

Your question: "${message}"`;
            }
        } catch (error) {
            console.error('Error using OCR for chat:', error);

            // More specific error handling
            if (error instanceof Error) {
                if (error.message.includes('timeout')) {
                    return `⏱️ The AI took too long to respond. This might be because:
1. The Ollama server is slow or overloaded
2. The extracted text is complex to analyze
3. The model needs more time to process

Try asking a more specific question or restart Ollama with: \`ollama serve\``;
                } else if (error.message.includes('ECONNREFUSED')) {
                    return `🔌 Cannot connect to Ollama server. Please make sure:
1. Ollama is running: \`ollama serve\`
2. The server is accessible at: ${OLLAMA_BASE_URL}
3. The model '${DEFAULT_MODEL}' is installed

You can install the model with: \`ollama pull ${DEFAULT_MODEL}\``;
                }
            }

            return `❌ Error processing screenshot: ${error instanceof Error ? error.message : 'Unknown error'}

Please try again or describe what you're seeing in the image.`;
        }
    } else {
        console.log('No screenshot provided, using text-only chat');
    }

    // Fallback to text-only chat when no screenshot
    const systemPrompt = `You are an AI Assistant Pro - a helpful desktop assistant that can analyze screenshots, videos, and websites. You have access to the following capabilities:

1. Screenshot analysis using OCR text extraction
2. Website content extraction and analysis  
3. YouTube and video content analysis
4. Contextual conversation based on previous interactions

You should:
- Provide detailed, helpful responses
- Reference previous screenshots or URLs when relevant  
- Ask clarifying questions when needed
- Maintain conversation context across interactions
- Be concise but comprehensive in your analysis
- When users ask about screenshots, let them know they can capture one using Ctrl+H

Guidelines:
- Always be helpful and descriptive in your responses
- If users mention screenshots but none are provided, guide them to take one
- Focus on practical, actionable advice

`;

    let prompt = '';
    if (context) {
        prompt = `${systemPrompt}

Conversation Context:
${context}

Current User Message: ${message}

AI Assistant Response:`;
    } else {
        prompt = `${systemPrompt}

User: ${message}

AI Assistant Response:`;
    }

    return await callOllamaAPI(prompt);
});

ipcMain.handle('cancel-all-processes', () => {
    cancelAllProcesses();
    return true;
});

// Test handler to verify IPC is working
ipcMain.handle('test-ipc', () => {
    console.log('🟢 TEST-IPC HANDLER CALLED! 🟢');
    return 'IPC is working!';
});

// App event handlers
app.whenReady().then(async () => {
    console.log('App ready, creating window...');
    await createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        await createWindow();
    }
});

app.on('will-quit', () => {
    // Unregister all shortcuts
    globalShortcut.unregisterAll();
});
