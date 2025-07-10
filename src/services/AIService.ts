import { createWorker, type Worker } from 'tesseract.js';

/**
 * AI Service for OCR text extraction and AI processing
 * Based on ChitKode's approach: Extract text from screenshots using OCR, then send to AI
 */
export class AIService {
    private static instance: AIService | null = null;
    private ocrWorker: Worker | null = null;
    private isInitialized = false;

    private constructor() { }

    public static getInstance(): AIService {
        if (!AIService.instance) {
            AIService.instance = new AIService();
        }
        return AIService.instance;
    }

    /**
     * Initialize OCR worker
     */
    public async initializeOCR(): Promise<boolean> {
        if (this.isInitialized && this.ocrWorker) {
            return true;
        }

        try {
            console.log('Initializing OCR worker...');
            this.ocrWorker = await createWorker('eng', 1, {
                logger: (m: { status: string; progress?: number; }) => {
                    console.log(`OCR: ${m.status} ${m.progress ? `(${Math.round(m.progress * 100)}%)` : ''}`);
                },
                errorHandler: (e: Error) => console.error('OCR Error:', e),
            });

            this.isInitialized = true;
            console.log('OCR worker initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing OCR:', error);
            this.isInitialized = false;
            return false;
        }
    }

    /**
     * Extract text from image using OCR
     */
    public async extractTextFromImage(imageData: string): Promise<string> {
        if (!this.ocrWorker) {
            console.log('OCR worker not initialized, initializing now...');
            const success = await this.initializeOCR();
            if (!success) {
                throw new Error('Failed to initialize OCR worker');
            }
        }

        try {
            console.log('Extracting text from image using OCR...');
            const result = await this.ocrWorker!.recognize(imageData);
            const extractedText = result.data.text.trim();

            console.log(`OCR completed. Extracted ${extractedText.length} characters`);
            console.log('OCR Result Preview:', extractedText.substring(0, 200) + (extractedText.length > 200 ? '...' : ''));

            return extractedText;
        } catch (error) {
            console.error('Error extracting text from image:', error);
            throw new Error('Failed to extract text from image using OCR');
        }
    }

    /**
     * Clean up OCR resources
     */
    public async cleanup(): Promise<void> {
        if (this.ocrWorker) {
            console.log('Cleaning up OCR worker...');
            await this.ocrWorker.terminate();
            this.ocrWorker = null;
            this.isInitialized = false;
        }
    }

    /**
     * Check if OCR is ready
     */
    public isOCRReady(): boolean {
        return this.isInitialized && this.ocrWorker !== null;
    }
}
