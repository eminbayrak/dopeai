"use strict";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron');
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
    callOllama: (prompt, model) => ipcRenderer.invoke('call-ollama', prompt, model),
    extractWebsiteContent: (url) => ipcRenderer.invoke('extract-website-content', url),
    extractVideoInfo: (url) => ipcRenderer.invoke('extract-video-info', url),
    analyzeScreenshot: (imageData) => ipcRenderer.invoke('analyze-screenshot', imageData),
    analyzeContent: (content, contentType) => ipcRenderer.invoke('analyze-content', content, contentType),
    chatWithAI: (message, context, latestScreenshot) => ipcRenderer.invoke('chat-with-ai', message, context, latestScreenshot),
    cancelAllProcesses: () => ipcRenderer.invoke('cancel-all-processes'),
    testIPC: () => ipcRenderer.invoke('test-ipc'),
    // Event listeners
    onScreenshotCaptured: (callback) => {
        // @ts-expect-error - ipcRenderer event handler type mismatch
        ipcRenderer.on('screenshot-captured', (_event, data) => callback(data));
    },
    onScreenshotsCleared: (callback) => {
        ipcRenderer.on('screenshots-cleared', () => callback());
    },
    onWindowResized: (callback) => {
        // @ts-expect-error - ipcRenderer event handler type mismatch
        ipcRenderer.on('window-resized', (_event, isExpanded) => callback(isExpanded));
    },
    onMouseInteractionChanged: (callback) => {
        // @ts-expect-error - ipcRenderer event handler type mismatch
        ipcRenderer.on('mouse-interaction-changed', (_event, enabled) => callback(enabled));
    },
    onProcessesCancelled: (callback) => {
        ipcRenderer.on('processes-cancelled', () => callback());
    },
    // Remove event listeners
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    },
    // General event listener for flexibility
    on: (channel, callback) => {
        // @ts-expect-error - ipcRenderer event handler type mismatch
        ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
});
