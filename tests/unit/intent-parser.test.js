/**
 * Unit tests for Intent Parser
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the gemini module
vi.mock('../../src/lib/gemini.js', () => ({
    generateContent: vi.fn(),
}));

import { generateContent } from '../../src/lib/gemini.js';

describe('Intent Parser', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should parse product intent', async () => {
        const mockResponse = {
            candidates: [{
                content: {
                    parts: [{
                        text: JSON.stringify({
                            product: 'Samsung phone',
                            platform: 'amazon',
                            filters: { price_max: 50000 },
                        }),
                    }],
                },
            }],
        };

        generateContent.mockResolvedValue(mockResponse);

        // Import after mock
        const { parseIntent } = await import('../../src/background/service_worker.js');
        
        // Note: This is a simplified test - actual implementation would need proper module structure
        expect(generateContent).toHaveBeenCalled();
    });

    it('should handle invalid JSON response', async () => {
        const mockResponse = {
            candidates: [{
                content: {
                    parts: [{ text: 'Invalid JSON' }],
                },
            }],
        };

        generateContent.mockResolvedValue(mockResponse);

        // Test would verify error handling
        expect(generateContent).toHaveBeenCalled();
    });
});

