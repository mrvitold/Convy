# Google Ads Setup Guide for convy.lt

Step-by-step guide to launch your 60 EUR/week Search campaign.

---

## 1. Create Google Ads Account

1. Go to [ads.google.com](https://ads.google.com)
2. Sign in with your Google account
3. Create a new account (or use existing)
4. Select campaign goal: **Leads** or **Website traffic**

---

## 2. Campaign Settings

| Setting | Value |
|---------|-------|
| Campaign type | **Search** |
| Campaign name | convy_lt_search |
| Location | **Lithuania** only |
| Language | Lithuanian |
| Daily budget | **€8.50** (60 EUR ÷ 7 days) |
| Bidding | Start with **Maximize clicks** or **Manual CPC** (max CPC €2–3) |

---

## 3. Keywords

Add these keywords. Use **Exact** and **Phrase** match for cost efficiency.

### Exact match [keyword]
- `excel į i.SAF`
- `excel į iSAF`
- `excel į XML VMI`
- `PVM sąskaitos excel VMI`
- `i.SAF konverteris`
- `excel į i.SAF nemokamai`
- `PVM registras excel VMI teikimas`

### Phrase match "keyword"
- `"kaip pateikti PVM sąskaitas VMI"`
- `"excel konvertuoti į XML"`
- `"i.SAF XML generatorius"`

### Negative keywords (add at campaign level)
- `konsultas`
- `programavimas`
- `kursas`
- `mokymai`
- `darbas`
- `darbo`

---

## 4. Ad Group Structure

Create **1–2 ad groups**:

**Ad Group 1:** Excel i.SAF (keywords: excel į i.SAF, i.SAF konverteris, etc.)  
**Ad Group 2:** PVM VMI (keywords: PVM sąskaitos VMI, kaip pateikti PVM, etc.)

---

## 5. Landing Page & UTM

- **Final URL:** `https://convy.lt`
- **Final URL suffix** (in campaign or ad settings):  
  `utm_source=google&utm_medium=cpc&utm_campaign=convy_lt`

This ensures Inv3 links get the correct referrer when users arrive from Google Ads.

---

## 6. Conversion Tracking

### Step A: Google Analytics 4

1. Create a GA4 property at [analytics.google.com](https://analytics.google.com)
2. Get your Measurement ID (format: `G-XXXXXXXXXX`)
3. Add it to `js/config.js`:
   ```javascript
   window.ConvyGA4Id = 'G-XXXXXXXXXX';
   ```

### Step B: Google Ads Conversion

1. In Google Ads: **Tools & Settings** → **Conversions**
2. Click **+ New conversion action** → **Website**
3. Choose **Manually add a conversion**
4. Conversion name: `XML Download`
5. Category: **Download**
6. Value: Leave blank or set a value
7. Count: **One**
8. Attribution: **Data-driven** or **Last click**
9. In **Tag setup**, select **Use Google Tag Manager** or **Install the tag yourself**
10. If using GA4: Link your GA4 property in Google Ads (**Tools** → **Linked accounts** → **Google Analytics 4**)
11. Import the `xml_download` event as a conversion from GA4

### Alternative: gtag conversion (without GA4)

If you prefer direct Google Ads conversion:

1. Get your Google Ads conversion ID and label from **Conversions** → **Tag setup**
2. Add to `index.html` before `</head>`:
   ```html
   <script async src="https://www.googletagmanager.com/gtag/js?id=AW-XXXXXXXXX"></script>
   <script>
     window.dataLayer = window.dataLayer || [];
     function gtag(){dataLayer.push(arguments);}
     gtag('js', new Date());
     gtag('config', 'AW-XXXXXXXXX');
   </script>
   ```
3. Update `analytics.js` or add conversion call on XML download with the conversion ID.

---

## 7. Optimization Checklist

- [ ] Turn **OFF** Final URL Expansion (in campaign settings)
- [ ] Review **Search terms** report weekly; add irrelevant terms as negatives
- [ ] Run 2–3 ad variants for A/B testing
- [ ] After 2–4 weeks, pause low-performing keywords
- [ ] Consider **Maximize conversions** once you have 15+ conversions

---

## 8. Expected Timeline

| Week | Action |
|------|--------|
| 1–2 | Launch; let data accumulate |
| 3 | Review search terms; add negatives |
| 4 | Optimize bids; pause poor keywords |
| 5–6 | Consider scaling or testing new keywords |

---

## 9. Ad Copy Reference

See [google-ads-copy.md](google-ads-copy.md) for headlines and descriptions.
