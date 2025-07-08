// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron');

// Define types for screenshot data
interface ScreenshotData {
    path: string;
    dataURL: string;
    timestamp: string;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Screenshot functionality
    takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
    clearScreenshots: () => ipcRenderer.invoke('clear-screenshots'),

    // Window controls
    toggleWindowSize: () => ipcRenderer.invoke('toggle-window-size'),
    toggleMouseInteraction: () => ipcRenderer.invoke('toggle-mouse-interaction'),
    getWindowState: () => ipcRenderer.invoke('get-window-state'),

    // AI functionality
    callOllama: (prompt: string, model?: string) => ipcRenderer.invoke('call-ollama', prompt, model),
    extractWebsiteContent: (url: string) => ipcRenderer.invoke('extract-website-content', url),
    extractVideoInfo: (url: string) => ipcRenderer.invoke('extract-video-info', url),
    analyzeScreenshot: (imageData: string) => ipcRenderer.invoke('analyze-screenshot', imageData),
    analyzeContent: (content: string, contentType: 'website' | 'video') =>
        ipcRenderer.invoke('analyze-content', content, contentType),
    chatWithAI: (message: string, context?: string) => ipcRenderer.invoke('chat-with-ai', message, context),

    // Event listeners
    onScreenshotCaptured: (callback: (data: ScreenshotData) => void) => {
        // @ts-expect-error - ipcRenderer event handler type mismatch
        ipcRenderer.on('screenshot-captured', (_event, data) => callback(data));
    },
    onScreenshotsCleared: (callback: () => void) => {
        ipcRenderer.on('screenshots-cleared', () => callback());
    },
    onWindowResized: (callback: (isExpanded: boolean) => void) => {
        // @ts-expect-error - ipcRenderer event handler type mismatch
        ipcRenderer.on('window-resized', (_event, isExpanded) => callback(isExpanded));
    },
    onMouseInteractionChanged: (callback: (enabled: boolean) => void) => {
        // @ts-expect-error - ipcRenderer event handler type mismatch
        ipcRenderer.on('mouse-interaction-changed', (_event, enabled) => callback(enabled));
    },

    // Remove event listeners
    removeAllListeners: (channel: string) => {
        ipcRenderer.removeAllListeners(channel);
    }
});
