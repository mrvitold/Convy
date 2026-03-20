/**
 * Convy – konfigūracija. Nukopijuokite į config.js ir įrašykite savo API key.
 * Nekomituokite config.js su key į viešą repozitoriją.
 */
window.ConvyGeminiApiKey = '';

/**
 * Optional Gemini model id (https://ai.google.dev/gemini-api/docs/models/gemini).
 * Leave empty to use the built-in default (stable Flash). Set to gemini-flash-latest
 * to always use Google's rolling "latest Flash" alias (updates when Google retargets it;
 * may include preview-quality releases — test after API changes).
 */
window.ConvyGeminiModel = '';

/** GA4 Measurement ID for conversion tracking (e.g. G-XXXXXXXXXX). Leave empty to disable. */
window.ConvyGA4Id = '';

/** Google Ads conversion send_to (e.g. AW-18008044667/AbCdEfGh). Set when you create a conversion action in Google Ads. */
window.ConvyAdsConversionSendTo = '';
window.ConvyAdsPageViewSendTo = '';
window.ConvyAdsPlayClickSendTo = '';
