/**
 * Internationalization (i18n) Module
 */

import { logger } from './logger.js';
import { configManager } from './config.js';

const translations = {
    en: {
        'app.name': 'Retail Agent',
        'app.welcome': 'Hi! I can help you buy things on Amazon using your Gemini API Key. Try "Buy Samsung phone..."',
        'settings.title': 'Settings',
        'settings.apiKey': 'Gemini API Key:',
        'settings.save': 'Save',
        'settings.checkModels': 'Check Models',
        'settings.close': 'Close',
        'input.placeholder': 'Type your request...',
        'button.send': 'Send',
        'error.noApiKey': 'Error: No API Key found.',
        'error.parseFailed': 'Could not understand the product to buy.',
        'status.analyzing': 'Analyzing your request...',
        'status.searching': 'Searching for "{product}"...',
    },
    es: {
        'app.name': 'Agente de Compras',
        'app.welcome': '¡Hola! Puedo ayudarte a comprar cosas en Amazon usando tu clave API de Gemini. Prueba "Comprar teléfono Samsung..."',
        'settings.title': 'Configuración',
        'settings.apiKey': 'Clave API de Gemini:',
        'settings.save': 'Guardar',
        'settings.checkModels': 'Verificar Modelos',
        'settings.close': 'Cerrar',
        'input.placeholder': 'Escribe tu solicitud...',
        'button.send': 'Enviar',
        'error.noApiKey': 'Error: No se encontró la clave API.',
        'error.parseFailed': 'No se pudo entender el producto a comprar.',
        'status.analyzing': 'Analizando tu solicitud...',
        'status.searching': 'Buscando "{product}"...',
    },
    fr: {
        'app.name': 'Agent de Vente',
        'app.welcome': 'Salut! Je peux vous aider à acheter des choses sur Amazon en utilisant votre clé API Gemini. Essayez "Acheter téléphone Samsung..."',
        'settings.title': 'Paramètres',
        'settings.apiKey': 'Clé API Gemini:',
        'settings.save': 'Enregistrer',
        'settings.checkModels': 'Vérifier les Modèles',
        'settings.close': 'Fermer',
        'input.placeholder': 'Tapez votre demande...',
        'button.send': 'Envoyer',
        'error.noApiKey': 'Erreur: Clé API introuvable.',
        'error.parseFailed': 'Impossible de comprendre le produit à acheter.',
        'status.analyzing': 'Analyse de votre demande...',
        'status.searching': 'Recherche de "{product}"...',
    },
    hi: {
        'app.name': 'रिटेल एजेंट',
        'app.welcome': 'नमस्ते! मैं आपकी Gemini API Key का उपयोग करके Amazon पर चीजें खरीदने में आपकी मदद कर सकता हूं। "Samsung फोन खरीदें..." आज़माएं',
        'settings.title': 'सेटिंग्स',
        'settings.apiKey': 'Gemini API Key:',
        'settings.save': 'सहेजें',
        'settings.checkModels': 'मॉडल जांचें',
        'settings.close': 'बंद करें',
        'input.placeholder': 'अपना अनुरोध टाइप करें...',
        'button.send': 'भेजें',
        'error.noApiKey': 'त्रुटि: API Key नहीं मिली।',
        'error.parseFailed': 'खरीदने के लिए उत्पाद समझ नहीं आया।',
        'status.analyzing': 'आपके अनुरोध का विश्लेषण कर रहे हैं...',
        'status.searching': '"{product}" खोज रहे हैं...',
    },
};

class I18n {
    constructor() {
        this.currentLocale = 'en';
        this.fallbackLocale = 'en';
    }

    /**
     * Initialize i18n
     */
    async initialize() {
        // Get locale from config or browser
        const configLocale = await configManager.get('locale');
        const browserLocale = navigator.language.split('-')[0];
        this.currentLocale = configLocale || browserLocale || this.fallbackLocale;

        // Fallback to English if locale not supported
        if (!translations[this.currentLocale]) {
            logger.warn(`Locale ${this.currentLocale} not supported, falling back to ${this.fallbackLocale}`);
            this.currentLocale = this.fallbackLocale;
        }

        logger.info(`i18n initialized with locale: ${this.currentLocale}`);
    }

    /**
     * Set locale
     */
    async setLocale(locale) {
        if (!translations[locale]) {
            logger.warn(`Locale ${locale} not supported`);
            return false;
        }

        this.currentLocale = locale;
        await configManager.set('locale', locale);
        logger.info(`Locale changed to: ${locale}`);

        // Trigger locale change event
        window.dispatchEvent(new CustomEvent('localechange', { detail: { locale } }));

        return true;
    }

    /**
     * Get translation
     */
    t(key, params = {}) {
        const translation = translations[this.currentLocale]?.[key] || 
                          translations[this.fallbackLocale]?.[key] || 
                          key;

        // Replace parameters
        return translation.replace(/\{(\w+)\}/g, (match, paramKey) => {
            return params[paramKey] !== undefined ? params[paramKey] : match;
        });
    }

    /**
     * Get current locale
     */
    getLocale() {
        return this.currentLocale;
    }

    /**
     * Get available locales
     */
    getAvailableLocales() {
        return Object.keys(translations);
    }
}

// Export singleton instance
export const i18n = new I18n();

// Initialize on load
i18n.initialize().catch(error => {
    logger.error('Failed to initialize i18n', error);
});

