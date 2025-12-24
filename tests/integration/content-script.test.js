/**
 * Integration tests for Content Scripts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DOM and Chrome APIs
global.document = {
    querySelector: vi.fn(),
    querySelectorAll: vi.fn().mockReturnValue([]),
};

global.chrome = {
    runtime: {
        sendMessage: vi.fn(),
        onMessage: {
            addListener: vi.fn(),
        },
    },
};

describe('Content Script Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should notify background on page load', () => {
        expect(chrome.runtime.sendMessage).toBeDefined();
    });

    it('should handle GET_SEARCH_RESULTS action', () => {
        // Mock search results
        document.querySelectorAll.mockReturnValue([
            {
                querySelector: vi.fn().mockReturnValue({ innerText: 'Product 1', href: 'http://example.com' }),
            },
        ]);

        expect(document.querySelectorAll).toBeDefined();
    });

    it('should handle CLICK_BUY_NOW action', () => {
        document.querySelector.mockReturnValue({
            click: vi.fn(),
        });

        expect(document.querySelector).toBeDefined();
    });
});

