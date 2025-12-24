import { cache } from './cache.js';
import { logger } from './logger.js';

// Global function to send messages to chat (set by service worker)
let globalLogAction = null;

export function setLogAction(logActionFn) {
    globalLogAction = logActionFn;
}

// List of Gemini models to try in order (most capable first)
// This will be populated with available models from API
let GEMINI_MODELS = [
    'gemini-2.0-flash-exp',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-pro',
    'gemini-flash-latest'
];

// Cache for available models (per API key)
const availableModelsCache = new Map();

/**
 * Get available models for an API key
 */
export async function getAvailableModels(apiKey) {
    const cacheKey = `models:${apiKey.substring(0, 10)}`;
    
    if (availableModelsCache.has(cacheKey)) {
        return availableModelsCache.get(cacheKey);
    }
    
    try {
        const models = await listModels(apiKey);
        // Filter to only generation-capable models
        const generationModels = models
            .filter(m => m.name && m.supportedGenerationMethods?.includes('generateContent'))
            .map(m => m.name.replace('models/', ''))
            .sort((a, b) => {
                // Prioritize newer models
                if (a.includes('2.0')) return -1;
                if (b.includes('2.0')) return 1;
                if (a.includes('1.5')) return -1;
                if (b.includes('1.5')) return 1;
                return 0;
            });
        
        availableModelsCache.set(cacheKey, generationModels);
        console.log(`[Gemini] Found ${generationModels.length} available models:`, generationModels);
        return generationModels;
    } catch (error) {
        console.warn('[Gemini] Failed to fetch available models, using defaults', error.message);
        return GEMINI_MODELS;
    }
}

export async function generateContent(apiKey, prompt, systemInstruction = "", modelName = null) {
    // Check cache first (but don't cache across different models)
    const cacheKey = `gemini:${prompt}:${systemInstruction}:${modelName || 'default'}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        return cached;
    }

    // Get available models for this API key
    let availableModels = await getAvailableModels(apiKey);
    
    // Check for cached working model for today
    const today = new Date().toDateString();
    const modelCacheKey = `gemini_working_model:${apiKey.substring(0, 10)}:${today}`;
    
    try {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            const stored = await chrome.storage.local.get([modelCacheKey]);
            if (stored[modelCacheKey]) {
                const cachedModel = stored[modelCacheKey];
                logger.info(`Using cached working model: ${cachedModel.model}`);
                if (globalLogAction) {
                    globalLogAction(`Using cached working model: ${cachedModel.model}`, 'info');
                }
                // Put cached model first
                availableModels = [cachedModel.model, ...availableModels.filter(m => m !== cachedModel.model)];
            }
        }
    } catch (e) {
        logger.warn('Failed to check model cache', { error: e.message });
    }
    
    // Use provided model or try available models in order
    const modelsToTry = modelName ? [modelName] : availableModels;
    
    let lastError = null;
    const modelAttempts = [];
    
    for (let i = 0; i < modelsToTry.length; i++) {
        const model = modelsToTry[i];
        const attemptStart = Date.now();
        
        try {
            const attemptMsg = `Trying model ${i + 1}/${modelsToTry.length}: ${model}`;
            logger.info(`[Gemini] ${attemptMsg}`);
            // Send to chat via global logAction if available
            if (globalLogAction) {
                globalLogAction(attemptMsg, 'info');
            }
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

            // For gemini-pro (1.0), system instructions are best passed as part of the user prompt
            const finalPrompt = systemInstruction ? `${systemInstruction}\n\nUser Request: ${prompt}` : prompt;

            const payload = {
                contents: [{
                    role: "user",
                    parts: [{ text: finalPrompt }]
                }]
            };

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const attemptDuration = Date.now() - attemptStart;

            if (!response.ok) {
                const errorText = await response.text();
                let errorReason = 'Unknown error';
                
                try {
                    const errorJson = JSON.parse(errorText);
                    errorReason = errorJson.error?.message || errorText.substring(0, 200);
                } catch (e) {
                    errorReason = errorText.substring(0, 200);
                }
                
                const error = new Error(`Gemini API Error: ${response.status} - ${errorReason}`);
                error.status = response.status;
                error.model = model;
                
                // Log attempt failure
                modelAttempts.push({
                    model,
                    attempt: i + 1,
                    status: 'FAILED',
                    statusCode: response.status,
                    reason: errorReason,
                    duration: attemptDuration
                });
                
                const failMsg = `Model ${model} failed (${response.status}): ${errorReason.substring(0, 100)}`;
                logger.warn(`[Gemini] ${failMsg}`, {
                    status: response.status,
                    reason: errorReason,
                    duration: attemptDuration
                });
                
                // Send to chat
                if (globalLogAction) {
                    globalLogAction(failMsg, 'warn');
                }
                
                // If it's a quota/rate limit error, try next model
                if (response.status === 429 || response.status === 403) {
                    lastError = error;
                    // Continue to next model
                    continue;
                }
                // For other errors, throw immediately
                throw error;
            }

            const data = await response.json();
            const attemptDuration2 = Date.now() - attemptStart;
            
            // Cache successful responses (shorter TTL for API responses)
            cache.set(cacheKey, data, 2 * 60 * 1000); // 2 minutes
            
            // Log successful attempt
            modelAttempts.push({
                model,
                attempt: i + 1,
                status: 'SUCCESS',
                duration: attemptDuration2
            });
            
            const successMsg = `Model ${model} succeeded (${attemptDuration2}ms)`;
            logger.info(`[Gemini] ${successMsg}`, {
                attempt: i + 1,
                duration: attemptDuration2,
                allAttempts: modelAttempts
            });
            
            // Send to chat
            if (globalLogAction) {
                globalLogAction(successMsg, 'info');
            }
            
            // Cache working model for today
            try {
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    const today = new Date().toDateString();
                    const modelCacheKey = `gemini_working_model:${apiKey.substring(0, 10)}:${today}`;
                    // Calculate TTL until end of day
                    const now = new Date();
                    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                    const ttl = endOfDay.getTime() - now.getTime();
                    
                    await chrome.storage.local.set({
                        [modelCacheKey]: {
                            model: model,
                            timestamp: Date.now(),
                            ttl: ttl
                        }
                    });
                    logger.info(`Cached working model: ${model} until end of day`);
                }
            } catch (e) {
                logger.warn('Failed to cache working model', { error: e.message });
            }
            
            return data;
        } catch (error) {
            const attemptDuration = Date.now() - attemptStart;
            
            // If it's a network error or non-quota API error, don't try other models
            if (error.status !== 429 && error.status !== 403) {
                modelAttempts.push({
                    model,
                    attempt: i + 1,
                    status: 'FAILED',
                    reason: error.message,
                    duration: attemptDuration
                });
                
                logger.error(`[Gemini] Model ${model} failed with non-quota error`, {
                    error: error.message,
                    duration: attemptDuration,
                    allAttempts: modelAttempts
                });
                throw error;
            }
            // Otherwise, continue to next model
            lastError = error;
        }
    }
    
    // All models failed
    logger.error(`[Gemini] All ${modelsToTry.length} models failed`, {
        totalAttempts: modelAttempts.length,
        attempts: modelAttempts
    });
    throw lastError || new Error('All Gemini models failed');
}

export async function listModels(apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(response.statusText);
        const data = await response.json();
        return data.models || [];
    } catch (error) {
        console.error("Failed to list models", error);
        throw error;
    }
}
