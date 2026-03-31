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

/** GA4: leave empty — base tag is in index.html (avoids double-loading). Set only if you remove GA4 from HTML. */
window.ConvyGA4Id = '';

/** Google Ads conversion send_to (e.g. AW-18027401380/AbCdEfGh). Set when you create a conversion action in Google Ads. */
window.ConvyAdsConversionSendTo = '';
window.ConvyAdsPageViewSendTo = '';
window.ConvyAdsPlayClickSendTo = '';
