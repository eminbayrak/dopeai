import { app, BrowserWindow, globalShortcut, ipcMain, desktopCapturer, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import axios from 'axios';
import * as cheerio from 'cheerio';
import youtubedl from 'youtube-dl-exec';
import { fileURLToPath } from 'url';
// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load environment variables
dotenv.config();
let mainWindow;
let isWindowVisible = true;
let isExpanded = false;
let isMouseInteractionEnabled = true; // Enable mouse by default
const stealthMode = false; // Disable stealth mode by default
// Define window dimensions
const smallSize = { width: 520, height: 400 };
const largeSize = { width: 1200, height: 800 };
// Ollama API configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
/**
 * Call Ollama API for text generation
 */
async function callOllamaAPI(prompt, model = DEFAULT_MODEL) {
    try {
        console.log(`Calling Ollama API with model: ${model}`);
        const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
            model: model,
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.7,
                num_predict: 2000 // Changed from max_tokens to num_predict for Ollama
            }
        }, {
            timeout: 60000, // 60 second timeout
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (response.data && response.data.response) {
            return response.data.response;
        }
        else {
            throw new Error('Invalid response from Ollama API');
        }
    }
    catch (error) {
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
async function extractWebsiteContent(url) {
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
    }
    catch (error) {
        console.error('Error extracting website content:', error);
        throw new Error(`Failed to extract content from website: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Extract information from a video URL
 */
async function extractVideoInfo(url) {
    try {
        console.log(`Extracting video info from: ${url}`);
        // Get video metadata
        const info = await youtubedl(url, {
            dumpSingleJson: true,
            noWarnings: true,
            callHome: false,
            noCheckCertificates: true,
            preferFreeFormats: true,
            youtubeSkipDashManifest: true,
        });
        const videoInfo = info;
        const result = {
            title: videoInfo.title || 'Unknown Title',
            description: videoInfo.description || 'No description available',
        };
        console.log(`Extracted video info: ${result.title}`);
        return result;
    }
    catch (error) {
        console.error('Error extracting video info:', error);
        throw new Error(`Failed to extract video information: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Capture screenshot
 */
async function captureScreenshot() {
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
    }
    catch (error) {
        console.error('Error capturing screenshot:', error);
        throw error;
    }
}
/**
 * Clear all screenshots
 */
function clearScreenshots() {
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
    }
    catch (error) {
        console.error('Error clearing screenshots:', error);
    }
}
/**
 * Toggle window visibility
 */
function toggleWindowVisibility() {
    if (isWindowVisible) {
        mainWindow.hide();
    }
    else {
        mainWindow.show();
        mainWindow.focus();
    }
    isWindowVisible = !isWindowVisible;
}
/**
 * Toggle window size
 */
function toggleWindowSize() {
    try {
        if (isExpanded) {
            mainWindow.setSize(smallSize.width, smallSize.height, true);
        }
        else {
            mainWindow.setSize(largeSize.width, largeSize.height, true);
        }
        mainWindow.center();
        isExpanded = !isExpanded;
        mainWindow.webContents.send('window-resized', isExpanded);
        console.log(`Window ${isExpanded ? 'expanded' : 'collapsed'}`);
    }
    catch (error) {
        console.error('Error toggling window size:', error);
    }
}
/**
 * Toggle mouse interaction
 */
function toggleMouseInteraction() {
    isMouseInteractionEnabled = !isMouseInteractionEnabled;
    mainWindow.setIgnoreMouseEvents(!isMouseInteractionEnabled);
    mainWindow.webContents.send('mouse-interaction-changed', isMouseInteractionEnabled);
    console.log(`Mouse interaction ${isMouseInteractionEnabled ? 'enabled' : 'disabled'}`);
}
/**
 * Create the main window
 */
async function createWindow() {
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
        transparent: true,
        backgroundColor: '#00000000',
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: true,
        maximizable: false,
        minimizable: false,
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
    }
    else {
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
async function loadViteDevServer() {
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
        }
        catch {
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
function registerGlobalShortcuts() {
    // Screenshot shortcut
    globalShortcut.register('CommandOrControl+H', () => {
        console.log('Screenshot shortcut pressed');
        captureScreenshot();
    });
    // Clear screenshots shortcut
    globalShortcut.register('CommandOrControl+R', () => {
        console.log('Clear screenshots shortcut pressed');
        clearScreenshots();
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
ipcMain.handle('call-ollama', async (_event, prompt, model) => {
    return await callOllamaAPI(prompt, model);
});
ipcMain.handle('extract-website-content', async (_event, url) => {
    return await extractWebsiteContent(url);
});
ipcMain.handle('extract-video-info', async (_event, url) => {
    return await extractVideoInfo(url);
});
ipcMain.handle('analyze-screenshot', async (_event, imageData) => {
    try {
        // Check available models first
        const modelsResponse = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 5000 });
        const availableModels = modelsResponse.data.models?.map((m) => m.name) || [];
        // Try to find a vision model
        const visionModels = ['llava:latest', 'llava:13b', 'llava:7b', 'llava', 'bakllava:latest', 'bakllava'];
        const visionModel = visionModels.find(model => availableModels.includes(model));
        if (!visionModel) {
            console.error('No vision model available. Available models:', availableModels);
            throw new Error('No vision model available for screenshot analysis. Please install llava with: ollama pull llava');
        }
        const prompt = `You are an AI assistant analyzing a screenshot. I have provided you with a screenshot image. Please analyze it and provide a detailed response covering:

1. What type of interface or application is shown
2. Key UI elements and their layout  
3. Any text content visible
4. Potential usability issues or improvements
5. Overall design and functionality assessment

Be specific and actionable in your analysis. This is a real screenshot that I have captured.`;
        // Extract base64 data from data URL (remove data:image/png;base64, prefix)
        const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
        console.log(`Analyzing screenshot with vision model: ${visionModel}`);
        console.log(`Image data length: ${base64Data.length} characters`);
        const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
            model: visionModel,
            prompt: prompt,
            images: [base64Data],
            stream: false,
            options: {
                temperature: 0.3, // Lower temperature for more focused analysis
                num_predict: 1500
            }
        }, {
            timeout: 120000, // 2 minute timeout for vision analysis
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (response.data && response.data.response) {
            // Check if the response seems like a proper analysis
            const responseText = response.data.response;
            if (responseText.toLowerCase().includes('upload') || responseText.toLowerCase().includes('please provide')) {
                console.warn('Vision model seems to not see the image, retrying...');
                // Retry once with a different prompt
                const retryPrompt = `I have uploaded a screenshot image. Analyze this image and describe what you see in detail.`;
                const retryResponse = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
                    model: visionModel,
                    prompt: retryPrompt,
                    images: [base64Data],
                    stream: false,
                    options: {
                        temperature: 0.1,
                        num_predict: 1000
                    }
                }, { timeout: 60000 });
                if (retryResponse.data && retryResponse.data.response) {
                    return retryResponse.data.response;
                }
            }
            return responseText;
        }
        else {
            throw new Error('Invalid response from vision model');
        }
    }
    catch (error) {
        console.error('Error analyzing screenshot with vision model:', error);
        throw new Error(`Screenshot analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}. Make sure llava model is installed: ollama pull llava`);
    }
});
ipcMain.handle('analyze-content', async (_event, content, contentType) => {
    const prompt = contentType === 'website'
        ? `Analyze this website content and provide a comprehensive summary, key insights, and main points:

${content}`
        : `Analyze this video information and provide insights about the content, main topics, and key takeaways:

${content}`;
    return await callOllamaAPI(prompt);
});
ipcMain.handle('chat-with-ai', async (_event, message, context) => {
    // Handle connection test
    if (message === 'test') {
        try {
            await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 3000 });
            return 'Connection successful';
        }
        catch {
            throw new Error('Ollama server not available');
        }
    }
    const systemPrompt = `You are an AI Assistant Pro - a helpful desktop assistant that can analyze screenshots, videos, and websites. You have access to the following capabilities:

1. Screenshot analysis using vision models
2. Website content extraction and analysis  
3. YouTube and video content analysis
4. Contextual conversation based on previous interactions

You should:
- Provide detailed, helpful responses
- Reference previous screenshots or URLs when relevant  
- Ask clarifying questions when needed
- Maintain conversation context across interactions
- Be concise but comprehensive in your analysis
- When users ask about screenshots, let them know they can be more specific about what they want to know

Guidelines for screenshot analysis:
- If users ask general questions about "what you see" or "analyze this", provide a comprehensive overview
- If users ask specific questions, focus on those aspects
- Always be helpful and descriptive in your analysis

`;
    let prompt = '';
    if (context) {
        prompt = `${systemPrompt}

Conversation Context:
${context}

Current User Message: ${message}

AI Assistant Response:`;
    }
    else {
        prompt = `${systemPrompt}

User: ${message}

AI Assistant Response:`;
    }
    return await callOllamaAPI(prompt);
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
