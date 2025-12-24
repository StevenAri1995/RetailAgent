/**
 * Login Manager - Handles OTP-based login for e-commerce platforms
 */

import { logger } from './logger.js';
import { configManager } from './config.js';
import { retryDOMOperation } from './retry.js';
import { findElement, safeClick, fillInput, waitForElement } from '../content/shared/selectors.js';

class LoginManager {
    constructor() {
        this.phoneNumber = null;
        this.loggedInPlatforms = new Set();
    }

    async initialize() {
        const phone = await configManager.get('phoneNumber');
        const platforms = await configManager.get('loggedInPlatforms') || [];
        this.phoneNumber = phone;
        this.loggedInPlatforms = new Set(platforms);
    }

    async savePhoneNumber(phoneNumber) {
        this.phoneNumber = phoneNumber;
        await configManager.set('phoneNumber', phoneNumber);
        logger.info('Phone number saved');
    }

    async markPlatformLoggedIn(platformName) {
        this.loggedInPlatforms.add(platformName);
        await configManager.set('loggedInPlatforms', Array.from(this.loggedInPlatforms));
        logger.info(`Platform ${platformName} marked as logged in`);
    }

    isPlatformLoggedIn(platformName) {
        return this.loggedInPlatforms.has(platformName);
    }

    async handleLogin(platformName, tabId) {
        try {
            logger.info(`Handling login for ${platformName}`, { tabId });
            
            if (!this.phoneNumber) {
                throw new Error('Phone number not configured. Please set it in settings.');
            }

            // Check if already logged in
            const isLoggedIn = await this.checkLoginStatus(platformName, tabId);
            if (isLoggedIn) {
                logger.info(`${platformName} already logged in`);
                await this.markPlatformLoggedIn(platformName);
                return true;
            }

            // We're already on login page (opened directly), just wait for it to load
            // Wait longer for Amazon as it might have redirects
            const waitTime = platformName === 'amazon' ? 5000 : 3000;
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Check if already logged in (might have been logged in before)
            const isStillLoggedIn = await this.checkLoginStatus(platformName, tabId);
            if (isStillLoggedIn) {
                logger.info(`${platformName} already logged in`);
                await this.markPlatformLoggedIn(platformName);
                return true;
            }

            // Enter phone number automatically
            await this.enterPhoneNumber(platformName, tabId);
            // Reduced wait time - phone entry already has delays built in
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Click "Get OTP" or "Send OTP" button
            await this.sendOTP(platformName, tabId);
            
            // Wait for user to enter OTP on platform website
            // Poll for login completion
            const loginCompleted = await this.waitForLoginCompletion(platformName, tabId);
            
            if (loginCompleted) {
                await this.markPlatformLoggedIn(platformName);
                logger.info(`Login completed for ${platformName}`);
                return true;
            } else {
                throw new Error('Login not completed. Please enter OTP on the platform website.');
            }
        } catch (error) {
            logger.error(`Login failed for ${platformName}`, error);
            throw error;
        }
    }

    async navigateToLogin(platformName, tabId) {
        // This method is no longer needed since we open login pages directly
        // But keeping it for backward compatibility
        logger.info(`Navigate to login called for ${platformName}, but we're already on login page`, { tabId });
        return true;
    }

    async clickLoginButton(platformName, tabId) {
        logger.info(`Clicking login button for ${platformName}`);
        try {
            await chrome.tabs.sendMessage(tabId, { 
                action: 'CLICK_LOGIN_BUTTON',
                platform: platformName 
            });
        } catch (error) {
            logger.warn('Click login button failed', { error: error.message });
        }
    }

    async waitForLoginCompletion(platformName, tabId, maxWaitTime = 300000) {
        // Wait up to 5 minutes for user to complete login
        const startTime = Date.now();
        const pollInterval = 3000; // Check every 3 seconds
        
        logger.info(`Waiting for login completion on ${platformName}...`);
        
        while (Date.now() - startTime < maxWaitTime) {
            try {
                const isLoggedIn = await this.checkLoginStatus(platformName, tabId);
                if (isLoggedIn) {
                    logger.info(`Login completed for ${platformName}`);
                    return true;
                }
                
                // Check if OTP was entered (by checking if OTP input field is gone or page changed)
                const status = await chrome.tabs.sendMessage(tabId, { 
                    action: 'CHECK_LOGIN_PROGRESS',
                    platform: platformName 
                });
                
                if (status && status.loginCompleted) {
                    return true;
                }
                
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            } catch (error) {
                logger.warn('Error checking login status', { error: error.message });
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
        }
        
        logger.warn(`Login timeout for ${platformName}`);
        return false;
    }

    async checkLoginStatus(platformName, tabId) {
        try {
            const response = await chrome.tabs.sendMessage(tabId, { 
                action: 'CHECK_LOGIN_STATUS',
                platform: platformName 
            });
            return response && response.loggedIn === true;
        } catch (error) {
            logger.warn('Could not check login status', { error: error.message });
            return false;
        }
    }

    async detectLoginScreen(platformName, tabId) {
        try {
            const response = await chrome.tabs.sendMessage(tabId, { 
                action: 'DETECT_LOGIN_SCREEN',
                platform: platformName 
            });
            return response && response.loginScreenDetected === true;
        } catch (error) {
            logger.warn('Could not detect login screen', { error: error.message });
            return false;
        }
    }

    async enterPhoneNumber(platformName, tabId) {
        logger.info(`Entering phone number for ${platformName}`, { tabId, phoneNumber: this.phoneNumber });
        
        // Use chrome.scripting.executeScript to inject code directly into page context
        // This avoids message passing issues and works more reliably
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: async (platformName, phoneNumber) => {
                    // Import the function dynamically in page context
                    const { enterAmazonPhoneNumber } = await import(chrome.runtime.getURL('src/content/shared/login-handlers.js'));
                    return await enterAmazonPhoneNumber(phoneNumber);
                },
                args: [platformName, this.phoneNumber]
            });
            logger.info('Phone number entered successfully via script injection');
            return;
        } catch (scriptError) {
            logger.warn('Script injection failed, trying message passing', { error: scriptError.message });
        }
        
        // Fallback to message passing
        let lastError = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                if (attempt > 0) {
                    await new Promise(resolve => setTimeout(resolve, 500 * attempt));
                }
                
                logger.info(`Attempt ${attempt + 1}/3: Sending ENTER_PHONE_NUMBER message`, { tabId });
                
                const response = await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Timeout waiting for response'));
                    }, 8000);
                    
                    chrome.tabs.sendMessage(tabId, { 
                        action: 'ENTER_PHONE_NUMBER',
                        platform: platformName,
                        phoneNumber: this.phoneNumber 
                    }, (response) => {
                        clearTimeout(timeout);
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(response);
                        }
                    });
                });
                
                if (response && response.success) {
                    logger.info('Phone number entered successfully');
                    return;
                } else {
                    throw new Error(response?.error || 'Failed to enter phone number');
                }
            } catch (error) {
                lastError = error;
                logger.warn(`Attempt ${attempt + 1} failed`, { error: error.message });
                
                try {
                    await chrome.tabs.get(tabId);
                } catch (tabError) {
                    throw new Error(`Tab ${tabId} no longer exists`);
                }
            }
        }
        
        throw lastError || new Error('Failed to enter phone number after 3 attempts');
    }

    async sendOTP(platformName, tabId) {
        logger.info(`Sending OTP for ${platformName}`, { tabId });
        
        // Use message passing
        let lastError = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                if (attempt > 0) {
                    await new Promise(resolve => setTimeout(resolve, 500 * attempt));
                }
                
                logger.info(`Attempt ${attempt + 1}/3: Sending SEND_OTP message`, { tabId });
                
                const response = await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Timeout waiting for response'));
                    }, 8000);
                    
                    chrome.tabs.sendMessage(tabId, { 
                        action: 'SEND_OTP',
                        platform: platformName 
                    }, (response) => {
                        clearTimeout(timeout);
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(response);
                        }
                    });
                });
                
                if (response && response.success) {
                    logger.info('OTP sent successfully', { message: response.message });
                    return;
                } else {
                    throw new Error(response?.error || 'Failed to send OTP');
                }
            } catch (error) {
                lastError = error;
                logger.warn(`Attempt ${attempt + 1} failed`, { error: error.message });
                
                try {
                    await chrome.tabs.get(tabId);
                } catch (tabError) {
                    throw new Error(`Tab ${tabId} no longer exists`);
                }
            }
        }
        
        throw lastError || new Error('Failed to send OTP after 3 attempts');
    }

}

export const loginManager = new LoginManager();

