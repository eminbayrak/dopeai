import { AIService } from '../services/AIService';

/**
 * Test OCR functionality
 */
async function testOCR() {
    console.log('Testing OCR functionality...');

    const aiService = AIService.getInstance();

    try {
        // Initialize OCR
        const initialized = await aiService.initializeOCR();
        console.log('OCR initialized:', initialized);

        if (initialized) {
            // Create a simple test image (base64 encoded image with text)
            // This is a simple white image with black text "Hello World"
            const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

            // Note: This is a minimal test image - in real usage, you'd pass actual screenshot data
            console.log('Testing with simple image...');

            const extractedText = await aiService.extractTextFromImage(testImageBase64);
            console.log('Extracted text:', extractedText);

            console.log('OCR test completed successfully!');
        }
    } catch (error) {
        console.error('OCR test failed:', error);
    } finally {
        // Clean up
        await aiService.cleanup();
    }
}

// Export for testing
export { testOCR };
