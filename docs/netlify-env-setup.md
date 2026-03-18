# Netlify Environment Variables Setup

For convy.lt to work with AI features and GA4 tracking on the live site, add these environment variables in Netlify.

## Steps

1. Go to your Netlify dashboard: [app.netlify.com](https://app.netlify.com)
2. Select your site (**convy1** / convy.lt)
3. Go to **Site configuration** → **Environment variables**
4. Click **Add a variable** → **Add a single variable** (or **Add multiple variables**)

## Variables to Add

| Variable | Value | Required |
|----------|-------|----------|
| `CONVY_GEMINI_API_KEY` | Your Gemini API key from [aistudio.google.com](https://aistudio.google.com) | For AI features (sheet detection, column suggestions) |
| `CONVY_GA4_ID` | Your GA4 Measurement ID (e.g. `G-XXXXXXXXXX`) | For conversion tracking (optional – leave empty to disable) |
| `CONVY_ADS_CONVERSION_SENDTO` | Google Ads conversion `send_to` (e.g. `AW-18008044667/S89fCMvVlYscEPvo84pD`) | For XML download conversion (optional) |
| `CONVY_ADS_PAGEVIEW_SENDTO` | Google Ads Page view conversion `send_to` (e.g. `AW-18008044667/QFgMCK3IpYscEPvo84pD`) | For page view conversion (optional) |
| `CONVY_ADS_PLAYCLICK_SENDTO` | Google Ads Google Play click conversion `send_to` (e.g. `AW-18008044667/LABEL`) | For Inv3/Google Play button click (optional) |

## After Adding

1. Click **Save**
2. Trigger a new deploy: **Deploys** → **Trigger deploy** → **Deploy site**

The build script will generate `js/config.js` from these variables during each deploy. Your keys never appear in the GitHub repo.

## Local Development

For local testing, keep your `js/config.js` with real values. The build script only runs on Netlify. Your local `config.js` is gitignored and stays on your machine.
