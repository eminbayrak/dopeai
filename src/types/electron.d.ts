// Global type definitions for Electron API

interface ScreenshotData {
    path: string;
    dataURL: string;
    timestamp: string;
}

declare global {
    interface Window {
        electronAPI: {
            takeScreenshot: () => Promise<string>;
            clearScreenshots: () => Promise<boolean>;
            toggleWindowSize: () => Promise<boolean>;
            toggleMouseInteraction: () => Promise<boolean>;
            getWindowState: () => Promise<{
                isExpanded: boolean;
                isMouseInteractionEnabled: boolean;
                stealthMode: boolean;
            }>;
            callOllama: (prompt: string, model?: string) => Promise<string>;
            extractWebsiteContent: (url: string) => Promise<string>;
            extractVideoInfo: (url: string) => Promise<{ title: string; description: string; transcript?: string; }>;
            analyzeScreenshot: (imageData: string) => Promise<string>;
            analyzeContent: (content: string, contentType: 'website' | 'video') => Promise<string>;
            chatWithAI: (message: string, context?: string, latestScreenshot?: string) => Promise<string>;
            cancelAllProcesses: () => Promise<boolean>;
            testIPC: () => Promise<string>;
            onScreenshotCaptured: (callback: (data: ScreenshotData) => void) => void;
            onScreenshotsCleared: (callback: () => void) => void;
            onWindowResized: (callback: (isExpanded: boolean) => void) => void;
            onMouseInteractionChanged: (callback: (enabled: boolean) => void) => void;
            onProcessesCancelled: (callback: () => void) => void;
            removeAllListeners: (channel: string) => void;
            on: (channel: string, callback: (...args: unknown[]) => void) => void;
        };
    }
}

export { };
