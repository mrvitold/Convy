/**
 * Build script for Netlify deploy.
 * Generates js/config.js from environment variables so API keys stay out of the repo.
 */
const fs = require('fs');
const path = require('path');

const GEMINI_KEY = process.env.CONVY_GEMINI_API_KEY || '';
const GA4_ID = process.env.CONVY_GA4_ID || '';

const configContent = `/**
 * Convy – konfigūracija. Generuojama build metu iš Netlify env kintamųjų.
 * Nekomituokite šio failo su key į viešą repozitoriją.
 */
window.ConvyGeminiApiKey = ${JSON.stringify(GEMINI_KEY)};

/** GA4 Measurement ID for conversion tracking (e.g. G-XXXXXXXXXX). Leave empty to disable. */
window.ConvyGA4Id = ${JSON.stringify(GA4_ID)};
`;

const configPath = path.join(__dirname, 'js', 'config.js');
fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, configContent, 'utf8');
console.log('Generated js/config.js from environment variables.');
