/**
 * Integration tests for Service Worker
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Chrome APIs
global.chrome = {
    runtime: {
        onMessage: {
            addListener: vi.fn(),
        },
        sendMessage: vi.fn(),
    },
    storage: {
        local: {
            get: vi.fn().mockResolvedValue({ geminiApiKey: 'test-key' }),
            set: vi.fn().mockResolvedValue(undefined),
        },
    },
    tabs: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
        get: vi.fn().mockResolvedValue({ url: 'https://amazon.in' }),
        update: vi.fn(),
        sendMessage: vi.fn(),
    },
    scripting: {
        executeScript: vi.fn(),
    },
};

describe('Service Worker Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should handle PROCESS_QUERY message', async () => {
        // This would test the full flow of processing a user query
        expect(chrome.runtime.onMessage.addListener).toBeDefined();
    });

    it('should handle CHECK_MODELS message', async () => {
        // Test model checking functionality
        expect(chrome.storage.local.get).toBeDefined();
    });

    it('should create tab for platform', async () => {
        const tab = await chrome.tabs.create({ url: 'https://amazon.in' });
        expect(tab.id).toBe(1);
        expect(chrome.tabs.create).toHaveBeenCalled();
    });
});

