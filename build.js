/**
 * Build script for Netlify deploy.
 * Generates js/config.js from environment variables so API keys stay out of the repo.
 */
const fs = require('fs');
const path = require('path');

const GEMINI_KEY = process.env.CONVY_GEMINI_API_KEY || '';
const GA4_ID = process.env.CONVY_GA4_ID || '';
const ADS_SEND_TO = process.env.CONVY_ADS_CONVERSION_SENDTO || '';
const ADS_PAGEVIEW_SEND_TO = process.env.CONVY_ADS_PAGEVIEW_SENDTO || '';
const ADS_PLAYCLICK_SEND_TO = process.env.CONVY_ADS_PLAYCLICK_SENDTO || '';

const configContent = `/**
 * Convy – konfigūracija. Generuojama build metu iš Netlify env kintamųjų.
 * Nekomituokite šio failo su key į viešą repozitoriją.
 */
window.ConvyGeminiApiKey = ${JSON.stringify(GEMINI_KEY)};

/** GA4 Measurement ID for conversion tracking (e.g. G-XXXXXXXXXX). Leave empty to disable. */
window.ConvyGA4Id = ${JSON.stringify(GA4_ID)};

/** Google Ads conversion send_to (e.g. AW-18008044667/LABEL). Set when you create a conversion action. */
window.ConvyAdsConversionSendTo = ${JSON.stringify(ADS_SEND_TO)};

/** Google Ads Page view conversion send_to (e.g. AW-18008044667/LABEL). Leave empty to disable. */
window.ConvyAdsPageViewSendTo = ${JSON.stringify(ADS_PAGEVIEW_SEND_TO)};

/** Google Ads Google Play click conversion send_to (e.g. AW-18008044667/LABEL). Leave empty to disable. */
window.ConvyAdsPlayClickSendTo = ${JSON.stringify(ADS_PLAYCLICK_SEND_TO)};
`;

const configPath = path.join(__dirname, 'js', 'config.js');
fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, configContent, 'utf8');
console.log('Generated js/config.js from environment variables.');
