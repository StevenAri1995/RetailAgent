/**
 * Shared login handlers for e-commerce platforms
 */

import { logger } from '../../lib/logger.js';
import { findElement, fillInput, safeClick, waitForElement } from './selectors.js';

/**
 * Amazon login handler - Navigate to login by clicking sign-in link
 * NOTE: This is no longer needed since we open login page directly, but keeping for compatibility
 */
export async function navigateToAmazonLogin() {
    try {
        logger.info('=== navigateToAmazonLogin called ===');
        logger.info('Current URL:', window.location.href);
        
        // Check if we're already on login page
        if (window.location.href.includes('/ap/signin')) {
            logger.info('Already on Amazon login page');
            return { success: true };
        }
        
        // Check if already logged in
        const accountLink = document.querySelector('#nav-link-accountList, #nav-orders');
        if (accountLink && !accountLink.textContent.includes('Sign in') && !accountLink.textContent.includes('Hello')) {
            logger.info('Amazon: Already logged in');
            return { alreadyLoggedIn: true };
        }

        // If we're on homepage, navigate directly to login URL
        logger.info('Navigating directly to Amazon login URL');
        window.location.href = 'https://www.amazon.in/ap/signin?openid.pape.max_auth_age=0&openid.return_to=https%3A%2F%2Fwww.amazon.in%2F%3Fref_%3Dnav_signin&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=inflex&openid.mode=checkid_setup&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0';
        await new Promise(resolve => setTimeout(resolve, 3000));
        return { success: true };
    } catch (error) {
        logger.error('Amazon navigate to login failed', error);
        throw error;
    }
}

/**
 * Amazon login handler - Click login button
 * NOTE: Not needed since we open login page directly, but keeping for compatibility
 */
export async function clickAmazonLoginButton() {
    try {
        logger.info('Clicking Amazon login button');
        
        // If already on login page, no need to click
        const url = window.location.href.toLowerCase();
        if (url.includes('/ap/signin') || url.includes('/ap/login')) {
            return { success: true };
        }

        return { success: true };
    } catch (error) {
        logger.error('Amazon click login button failed', error);
        throw error;
    }
}

/**
 * Amazon login handler - Enter phone number
 */
export async function enterAmazonPhoneNumber(phoneNumber) {
    try {
        logger.info('Entering phone number for Amazon', { phoneNumber });
        
        // Wait for login form to appear (reduced wait time)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Try multiple selectors for phone/email input
        let input = document.querySelector('#ap_email');
        if (!input) {
            input = document.querySelector('input[name="email"]');
        }
        if (!input) {
            input = document.querySelector('#ap_phone_number');
        }
        if (!input) {
            input = document.querySelector('input[name="phoneNumber"]');
        }
        if (!input) {
            input = document.querySelector('input[type="tel"]');
        }
        if (!input) {
            input = document.querySelector('input[type="text"][name*="phone"]');
        }
        if (!input) {
            input = document.querySelector('input[type="text"][name*="email"]');
        }
        if (!input) {
            // Last resort: find any input in the form
            const form = document.querySelector('form[name="signIn"]');
            if (form) {
                input = form.querySelector('input[type="text"], input[type="tel"], input[type="email"]');
            }
        }
        
        if (input) {
            // Simulate human-like typing to avoid detection
            logger.info('Simulating human typing for phone number');
            
            // Focus input
            input.focus();
            input.click();
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Clear existing value
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Type phone number character by character (human-like)
            for (let i = 0; i < phoneNumber.length; i++) {
                input.value += phoneNumber[i];
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new KeyboardEvent('keydown', { key: phoneNumber[i], bubbles: true }));
                input.dispatchEvent(new KeyboardEvent('keypress', { key: phoneNumber[i], bubbles: true }));
                input.dispatchEvent(new KeyboardEvent('keyup', { key: phoneNumber[i], bubbles: true }));
                // Random delay between 50-150ms to simulate human typing
                await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
            }
            
            // Final events
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('blur', { bubbles: true }));
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify value was set
            logger.info('Phone number entered', { 
                inputId: input.id, 
                inputName: input.name,
                value: input.value,
                expected: phoneNumber
            });
            
            if (input.value === phoneNumber) {
                logger.info('Phone number entered successfully');
                return { success: true };
            } else {
                throw new Error(`Phone number not set correctly. Expected: ${phoneNumber}, Got: ${input.value}`);
            }
        } else {
            logger.error('Phone number input not found', {
                availableInputs: Array.from(document.querySelectorAll('input')).map(inp => ({
                    id: inp.id,
                    name: inp.name,
                    type: inp.type,
                    placeholder: inp.placeholder
                }))
            });
            throw new Error('Phone number input not found');
        }
    } catch (error) {
        logger.error('Amazon enter phone number failed', error);
        throw error;
    }
}

/**
 * Amazon login handler - Send OTP
 */
export async function sendAmazonOTP() {
    try {
        logger.info('=== Starting Amazon Send OTP ===');
        
        // Wait a bit to ensure phone number is entered (reduced wait)
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Log all available buttons/inputs for debugging
        const allSubmitElements = Array.from(document.querySelectorAll('input[type="submit"], button[type="submit"], button, input[type="button"]'));
        logger.info('All submit elements on page:', allSubmitElements.map(btn => ({
            id: btn.id,
            value: btn.value,
            text: btn.textContent,
            type: btn.type,
            className: btn.className,
            visible: btn.offsetParent !== null
        })));
        
        // Try multiple selectors for Continue button
        // Amazon uses different structures - try to find the actual button element
        let continueBtn = document.querySelector('input[type="submit"][id="continue"]');
        logger.info('Button by input[type="submit"][id="continue"]:', { found: !!continueBtn });
        
        if (!continueBtn) {
            continueBtn = document.querySelector('button[id="continue"]');
            logger.info('Button by button[id="continue"]:', { found: !!continueBtn });
        }
        if (!continueBtn) {
            // Sometimes #continue is a span, find the parent button
            const continueSpan = document.querySelector('#continue');
            if (continueSpan) {
                continueBtn = continueSpan.closest('button') || continueSpan.closest('input[type="submit"]') || continueSpan.parentElement?.closest('button');
                logger.info('Button from #continue span parent:', { found: !!continueBtn });
            }
        }
        if (!continueBtn) {
            continueBtn = document.querySelector('input[type="submit"][value*="Continue" i]');
            logger.info('Button by input[type="submit"][value*="Continue"]:', { found: !!continueBtn });
        }
        if (!continueBtn) {
            continueBtn = document.querySelector('input[type="submit"]');
            logger.info('Button by input[type="submit"]:', { found: !!continueBtn });
        }
        if (!continueBtn) {
            continueBtn = document.querySelector('button[type="submit"]');
            logger.info('Button by button[type="submit"]:', { found: !!continueBtn });
        }
        if (!continueBtn) {
            // Find by text content - but make sure it's a button/input, not a span
            continueBtn = allSubmitElements.find(btn => {
                if (!btn.offsetParent) return false; // Must be visible
                if (btn.tagName === 'SPAN' || btn.tagName === 'DIV') return false; // Skip spans/divs
                const text = (btn.value || btn.textContent || '').toLowerCase().trim();
                return text.includes('continue') || text.includes('sign in') || text === 'continue';
            });
            logger.info('Button by text content:', { found: !!continueBtn });
        }
        
        if (continueBtn) {
            logger.info('Found Continue button!', { 
                id: continueBtn.id, 
                value: continueBtn.value,
                text: continueBtn.textContent,
                type: continueBtn.type,
                className: continueBtn.className,
                disabled: continueBtn.disabled,
                visible: continueBtn.offsetParent !== null,
                tagName: continueBtn.tagName
            });
            
            // Wait for button to be enabled and visible
            let attempts = 0;
            while ((continueBtn.disabled || !continueBtn.offsetParent) && attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
                logger.info(`Waiting for button to be enabled/visible, attempt ${attempts}`);
            }
            
            // Scroll into view
            continueBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Get button's position for realistic mouse events
            const rect = continueBtn.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            
            // If button is a SPAN, find the actual button element
            if (continueBtn.tagName === 'SPAN' || continueBtn.tagName === 'DIV') {
                logger.warn('Found SPAN/DIV instead of button, looking for actual button');
                const parentButton = continueBtn.closest('button') || continueBtn.closest('input[type="submit"]');
                if (parentButton) {
                    logger.info('Found parent button', { tagName: parentButton.tagName });
                    continueBtn = parentButton;
                } else {
                    // Try to find button by form
                    const form = continueBtn.closest('form');
                    if (form) {
                        const formButton = form.querySelector('input[type="submit"], button[type="submit"]');
                        if (formButton) {
                            logger.info('Found button in form', { tagName: formButton.tagName });
                            continueBtn = formButton;
                        }
                    }
                }
            }
            
            // Try to find the actual clickable element (might be a span inside button)
            let clickableElement = continueBtn;
            const innerSpan = continueBtn.querySelector('span, input[type="submit"]');
            if (innerSpan && continueBtn.tagName !== 'SPAN') {
                logger.info('Found inner clickable element', { tagName: innerSpan.tagName });
                // Don't use inner span, use the button itself
            }
            
            // Try multiple click methods - be more aggressive
            logger.info('Attempting all click methods on button', { tagName: continueBtn.tagName, type: continueBtn.type });
            
            // Method 1: Direct click on button (most reliable)
            try {
                logger.info('Method 1: Direct click');
                continueBtn.focus();
                continueBtn.click();
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (e) {
                logger.warn('Direct click failed', { error: e.message });
            }
            
            // Method 2: Realistic mouse events with coordinates
            try {
                logger.info('Method 2: Realistic mouse events');
                const mouseEvents = [
                    new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 }),
                    new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 }),
                    new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 })
                ];
                mouseEvents.forEach(event => continueBtn.dispatchEvent(event));
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (e) {
                logger.warn('Mouse events failed', { error: e.message });
            }
            
            // Method 3: Form submit (most reliable for form buttons)
            try {
                const form = continueBtn.form || continueBtn.closest('form');
                if (form) {
                    logger.info('Method 3: Form submit', { formId: form.id, formName: form.name });
                    // Find the actual submit button in the form
                    const submitBtn = form.querySelector('input[type="submit"][id="continue"], button[id="continue"], input[type="submit"], button[type="submit"]');
                    if (submitBtn) {
                        logger.info('Clicking submit button in form', { tagName: submitBtn.tagName });
                        submitBtn.focus();
                        submitBtn.click();
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    // Also try form.requestSubmit()
                    if (form.requestSubmit) {
                        form.requestSubmit();
                    } else {
                        form.submit();
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (e) {
                logger.warn('Form submit failed', { error: e.message });
            }
            
            // Method 4: Try clicking parent if button is nested
            try {
                const parent = continueBtn.parentElement;
                if (parent && (parent.tagName === 'BUTTON' || parent.tagName === 'INPUT')) {
                    logger.info('Method 4: Clicking parent element', { tagName: parent.tagName });
                    parent.click();
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (e) {
                logger.warn('Parent click failed', { error: e.message });
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            logger.info('Continue button click attempts completed');
            return { success: true, message: 'OTP sent. Please enter OTP on Amazon website.' };
        } else {
            logger.error('Continue button not found after trying all methods');
            throw new Error('Continue button not found');
        }
    } catch (error) {
        logger.error('Amazon send OTP failed', error);
        throw error;
    }
}

/**
 * Amazon login handler - Check login progress
 */
export function checkAmazonLoginProgress() {
    try {
        const url = window.location.href.toLowerCase();
        const accountLink = document.querySelector('#nav-link-accountList, #nav-orders');
        
        // Check if logged in
        if (accountLink && !accountLink.textContent.includes('Sign in')) {
            return { loginCompleted: true };
        }
        
        // Check if OTP input is visible (user hasn't entered OTP yet)
        const otpInput = document.querySelector('#auth-pv-enter-code, input[name="otpCode"], input[type="text"][maxlength="6"]');
        if (otpInput && otpInput.offsetParent !== null) {
            return { loginCompleted: false, waitingForOTP: true };
        }
        
        // Check if we're back on homepage or product page (login completed)
        if (!url.includes('/ap/signin') && !url.includes('/ap/login')) {
            return { loginCompleted: true };
        }
        
        return { loginCompleted: false };
    } catch (error) {
        logger.error('Amazon check login progress failed', error);
        return { loginCompleted: false };
    }
}

/**
 * Flipkart login handler - Navigate to login
 */
export async function navigateToFlipkartLogin() {
    try {
        logger.info('Navigating to Flipkart login');
        
        // Check if already logged in
        const accountLink = document.querySelector('._1_3w1N, [href*="/account"]');
        if (accountLink && !accountLink.textContent.includes('Login')) {
            logger.info('Flipkart: Already logged in');
            return { alreadyLoggedIn: true };
        }

        // Navigate to login page
        const loginButton = document.querySelector('._1_3w1N, [href*="/account/login"], a[href*="login"]');
        if (loginButton && loginButton.href) {
            window.location.href = loginButton.href;
        } else {
            window.location.href = 'https://www.flipkart.com/account/login';
        }
        await new Promise(resolve => setTimeout(resolve, 2000));

        return { success: true };
    } catch (error) {
        logger.error('Flipkart navigate to login failed', error);
        throw error;
    }
}

/**
 * Flipkart login handler - Click login button
 */
export async function clickFlipkartLoginButton() {
    try {
        logger.info('Clicking Flipkart login button');
        
        const url = window.location.href.toLowerCase();
        if (url.includes('/account/login')) {
            return { success: true };
        }

        const loginButton = document.querySelector('._1_3w1N, [href*="/account/login"]');
        if (loginButton) {
            await safeClick(loginButton);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        return { success: true };
    } catch (error) {
        logger.error('Flipkart click login button failed', error);
        throw error;
    }
}

/**
 * Flipkart login handler - Enter phone number
 */
export async function enterFlipkartPhoneNumber(phoneNumber) {
    try {
        logger.info('=== Starting Flipkart phone number entry ===', { phoneNumber });
        logger.info('Current URL:', window.location.href);
        
        // Wait for login form to appear (reduced wait time)
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check if we're on login page
        const url = window.location.href.toLowerCase();
        if (!url.includes('/account/login') && !url.includes('/account')) {
            logger.error('Not on Flipkart login page!', { url });
            throw new Error('Not on Flipkart login page. Current URL: ' + url);
        }
        
        // Log all available inputs for debugging
        const allInputs = Array.from(document.querySelectorAll('input'));
        logger.info('All inputs on page:', allInputs.map(inp => ({
            type: inp.type,
            name: inp.name,
            placeholder: inp.placeholder,
            maxlength: inp.maxLength,
            id: inp.id,
            className: inp.className,
            visible: inp.offsetParent !== null,
            value: inp.value,
            form: inp.form ? 'has form' : 'no form'
        })));
        
        // Try multiple selectors for phone input - Flipkart uses various patterns
        let phoneInput = null;
        
        // First, try to find login form specifically
        const loginForm = document.querySelector('form[action*="login"], form[action*="otp"], form');
        logger.info('Login form found:', { found: !!loginForm });
        
        // Try by type first
        phoneInput = document.querySelector('input[type="tel"]');
        logger.info('Input by type="tel":', { found: !!phoneInput });
        
        // Try by name
        if (!phoneInput) {
            phoneInput = document.querySelector('input[name="phone"]');
            logger.info('Input by name="phone":', { found: !!phoneInput });
        }
        
        // Try by placeholder (most reliable for Flipkart)
        if (!phoneInput) {
            phoneInput = allInputs.find(inp => {
                const placeholder = (inp.placeholder || '').toLowerCase();
                return (placeholder.includes('mobile') || placeholder.includes('phone')) && inp.offsetParent !== null;
            });
            logger.info('Input by placeholder (mobile/phone):', { found: !!phoneInput });
        }
        
        // Try by maxlength (Flipkart phone inputs are usually maxlength 10)
        if (!phoneInput) {
            phoneInput = document.querySelector('input[autocomplete="off"][maxlength="10"]');
            logger.info('Input by autocomplete="off" maxlength="10":', { found: !!phoneInput });
        }
        if (!phoneInput) {
            phoneInput = document.querySelector('input[type="text"][maxlength="10"]');
            logger.info('Input by type="text" maxlength="10":', { found: !!phoneInput });
        }
        
        // Try finding input in login form (exclude search inputs)
        if (!phoneInput && loginForm) {
            const formInputs = Array.from(loginForm.querySelectorAll('input[type="text"], input[type="tel"]'));
            phoneInput = formInputs.find(inp => {
                // Exclude search inputs
                const placeholder = (inp.placeholder || '').toLowerCase();
                const name = (inp.name || '').toLowerCase();
                const id = (inp.id || '').toLowerCase();
                return !placeholder.includes('search') && 
                       !name.includes('search') && 
                       !id.includes('search') &&
                       inp.offsetParent !== null;
            });
            logger.info('Input in login form (excluding search):', { found: !!phoneInput });
        }
        
        // Last resort: find first visible text input that's not a search box
        if (!phoneInput) {
            phoneInput = allInputs.find(inp => {
                if (inp.type !== 'text' && inp.type !== 'tel') return false;
                const placeholder = (inp.placeholder || '').toLowerCase();
                const name = (inp.name || '').toLowerCase();
                const id = (inp.id || '').toLowerCase();
                // Exclude search inputs
                if (placeholder.includes('search') || name.includes('search') || id.includes('search')) return false;
                const style = window.getComputedStyle(inp);
                return style.display !== 'none' && style.visibility !== 'hidden' && inp.offsetParent !== null;
            });
            logger.info('First visible text input (excluding search):', { found: !!phoneInput });
        }
        
        if (phoneInput) {
            logger.info('Found phone input!', { 
                id: phoneInput.id, 
                name: phoneInput.name,
                type: phoneInput.type,
                placeholder: phoneInput.placeholder,
                className: phoneInput.className
            });
            
            // Scroll into view
            phoneInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Focus and clear input
            phoneInput.focus();
            phoneInput.click(); // Sometimes needed for Flipkart
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Clear existing value
            phoneInput.value = '';
            phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Simulate human-like typing to avoid detection
            logger.info('Simulating human typing for phone number');
            
            // Type phone number character by character (human-like)
            for (let i = 0; i < phoneNumber.length; i++) {
                phoneInput.value += phoneNumber[i];
                phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
                phoneInput.dispatchEvent(new KeyboardEvent('keydown', { key: phoneNumber[i], bubbles: true }));
                phoneInput.dispatchEvent(new KeyboardEvent('keypress', { key: phoneNumber[i], bubbles: true }));
                phoneInput.dispatchEvent(new KeyboardEvent('keyup', { key: phoneNumber[i], bubbles: true }));
                // Random delay between 50-150ms to simulate human typing
                await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
            }
            
            // Final events
            phoneInput.dispatchEvent(new Event('change', { bubbles: true }));
            phoneInput.dispatchEvent(new Event('blur', { bubbles: true }));
            
            logger.info('Set phone number value:', phoneInput.value);
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify value was set
            logger.info('Final input value:', phoneInput.value);
            
            if (phoneInput.value === phoneNumber) {
                logger.info('Phone number entered successfully for Flipkart');
                return { success: true };
            } else {
                throw new Error(`Phone number not set correctly. Expected: ${phoneNumber}, Got: ${phoneInput.value}`);
            }
        } else {
            logger.error('Phone number input not found after trying all methods');
            throw new Error('Phone number input not found');
        }
    } catch (error) {
        logger.error('Flipkart enter phone number failed', error);
        throw error;
    }
}

/**
 * Flipkart login handler - Send OTP
 */
export async function sendFlipkartOTP() {
    try {
        logger.info('=== Starting Flipkart Send OTP ===');
        
        // Wait a bit to ensure phone number is entered and form is ready
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Log all available buttons for debugging
        const allButtons = Array.from(document.querySelectorAll('button'));
        logger.info('All buttons on page:', allButtons.map(btn => ({
            text: btn.textContent,
            classes: btn.className,
            type: btn.type,
            id: btn.id,
            visible: btn.offsetParent !== null
        })));
        
        // Try multiple selectors for Request OTP button
        let requestOTPBtn = null;
        
        // Try by type first
        requestOTPBtn = document.querySelector('button[type="submit"]');
        logger.info('Button by type="submit":', { found: !!requestOTPBtn });
        
        // Try Flipkart-specific classes
        if (!requestOTPBtn) {
            requestOTPBtn = document.querySelector('button._2KpZ6l._2HKlqd._3AWRsL');
            logger.info('Button by class _2KpZ6l._2HKlqd._3AWRsL:', { found: !!requestOTPBtn });
        }
        if (!requestOTPBtn) {
            requestOTPBtn = document.querySelector('button._2KpZ6l._2U9uOA._3g8HC-.R_RMP4');
            logger.info('Button by class _2KpZ6l._2U9uOA._3g8HC-.R_RMP4:', { found: !!requestOTPBtn });
        }
        if (!requestOTPBtn) {
            requestOTPBtn = document.querySelector('button._2KpZ6l');
            logger.info('Button by class _2KpZ6l:', { found: !!requestOTPBtn });
        }
        
        // Find button by text content (most reliable for Flipkart)
        if (!requestOTPBtn) {
            requestOTPBtn = allButtons.find(btn => {
                if (!btn.offsetParent) return false; // Must be visible
                const text = (btn.textContent || '').toLowerCase().trim();
                return text.includes('request otp') || 
                       text.includes('continue') || 
                       text.includes('send otp') || 
                       text.includes('get otp') ||
                       text === 'continue' ||
                       text === 'request otp';
            });
            logger.info('Button by text content:', { found: !!requestOTPBtn });
        }
        
        // Try finding button in form
        if (!requestOTPBtn) {
            const form = document.querySelector('form');
            logger.info('Form found:', { found: !!form });
            if (form) {
                requestOTPBtn = form.querySelector('button[type="submit"]');
                logger.info('Button in form:', { found: !!requestOTPBtn });
            }
        }
        
        if (requestOTPBtn) {
            logger.info('Found Request OTP button!', { 
                text: requestOTPBtn.textContent,
                classes: requestOTPBtn.className,
                type: requestOTPBtn.type,
                id: requestOTPBtn.id,
                disabled: requestOTPBtn.disabled,
                visible: requestOTPBtn.offsetParent !== null,
                tagName: requestOTPBtn.tagName
            });
            
            // Wait for button to be enabled and visible
            let attempts = 0;
            while ((requestOTPBtn.disabled || !requestOTPBtn.offsetParent) && attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
                logger.info(`Waiting for button to be enabled/visible, attempt ${attempts}`);
            }
            
            // Scroll into view
            requestOTPBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Simulate human-like delay before clicking
            await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
            
            logger.info('Clicking Request OTP button', { tagName: requestOTPBtn.tagName, type: requestOTPBtn.type });
            
            // Method 1: Direct click (most reliable)
            requestOTPBtn.focus();
            requestOTPBtn.click();
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Method 2: Form submit as backup
            const form = requestOTPBtn.form || requestOTPBtn.closest('form');
            if (form) {
                const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
                if (submitBtn && submitBtn !== requestOTPBtn) {
                    submitBtn.click();
                } else if (form.requestSubmit) {
                    form.requestSubmit();
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            logger.info('Request OTP button click attempts completed');
            return { success: true, message: 'OTP sent. Please enter OTP on Flipkart website.' };
        } else {
            logger.error('Request OTP button not found after trying all methods');
            throw new Error('Request OTP button not found');
        }
    } catch (error) {
        logger.error('Flipkart send OTP failed', error);
        throw error;
    }
}

/**
 * Flipkart login handler - Check login progress
 */
export function checkFlipkartLoginProgress() {
    try {
        const url = window.location.href.toLowerCase();
        const accountLink = document.querySelector('._1_3w1N, [href*="/account"]');
        
        // Check if logged in
        if (accountLink && !accountLink.textContent.includes('Login')) {
            return { loginCompleted: true };
        }
        
        // Check if OTP input is visible
        const otpInput = document.querySelector('input[type="text"][maxlength="6"], input[name="otp"]');
        if (otpInput && otpInput.offsetParent !== null) {
            return { loginCompleted: false, waitingForOTP: true };
        }
        
        // Check if we're back on homepage (login completed)
        if (!url.includes('/account/login')) {
            return { loginCompleted: true };
        }
        
        return { loginCompleted: false };
    } catch (error) {
        logger.error('Flipkart check login progress failed', error);
        return { loginCompleted: false };
    }
}

/**
 * Generic login detection
 */
export function detectLoginScreen(platformName) {
    const url = window.location.href.toLowerCase();
    const loginIndicators = {
        amazon: ['/ap/signin', '/ap/login', 'signin', 'login'],
        flipkart: ['/account/login', 'login'],
        ebay: ['/signin', '/login'],
        walmart: ['/account/login', 'signin']
    };

    const indicators = loginIndicators[platformName] || ['login', 'signin'];
    return indicators.some(indicator => url.includes(indicator)) ||
           document.querySelector('input[type="password"], input[name*="password"]') !== null;
}

