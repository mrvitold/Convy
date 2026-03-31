/**
 * Convy – GA4 and Google Ads conversion tracking.
 * GA4: Set window.ConvyGA4Id (e.g. G-XXXXXXXXXX) in config.js.
 * Google Ads: Set window.ConvyAdsConversionSendTo (e.g. AW-XXXXX/LABEL) for XML download.
 * Google Ads: Set window.ConvyAdsPageViewSendTo (e.g. AW-XXXXX/LABEL) for page view conversion.
 * Google Ads: Set window.ConvyAdsPlayClickSendTo (e.g. AW-XXXXX/LABEL) for Google Play button click.
 */
(function () {
  var GA4_ID = (typeof window !== 'undefined' && window.ConvyGA4Id) ? String(window.ConvyGA4Id || '').trim() : '';
  var ADS_SEND_TO = (typeof window !== 'undefined' && window.ConvyAdsConversionSendTo) ? String(window.ConvyAdsConversionSendTo || '').trim() : '';
  var ADS_PAGEVIEW_SEND_TO = (typeof window !== 'undefined' && window.ConvyAdsPageViewSendTo) ? String(window.ConvyAdsPageViewSendTo || '').trim() : '';
  var ADS_PLAYCLICK_SEND_TO = (typeof window !== 'undefined' && window.ConvyAdsPlayClickSendTo) ? String(window.ConvyAdsPlayClickSendTo || '').trim() : '';

  if (GA4_ID) {
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') {
      (function (w, d, s, l, i) {
        w[l] = w[l] || [];
        w[l].push({ 'gtag': function () { w[l].push(arguments); } });
        var f = d.getElementsByTagName(s)[0], j = d.createElement(s);
        j.async = true;
        j.src = 'https://www.googletagmanager.com/gtag/js?id=' + i;
        f.parentNode.insertBefore(j, f);
      })(window, document, 'script', 'dataLayer', GA4_ID);
      function gtag() { window.dataLayer.push(arguments); }
      window.gtag = gtag;
      gtag('js', new Date());
    }
    window.gtag('config', GA4_ID);
  }

  window.ConvyTrackConversion = function (eventName) {
    var payload = { send_to: ADS_SEND_TO, value: 1.0, currency: 'EUR' };
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName || 'xml_download');
      if (ADS_SEND_TO) window.gtag('event', 'conversion', payload);
    }
  };

  if (ADS_PAGEVIEW_SEND_TO && typeof window.gtag === 'function') {
    window.gtag('event', 'conversion', { send_to: ADS_PAGEVIEW_SEND_TO, value: 1.0, currency: 'EUR' });
  }

  window.ConvyTrackPlayClick = function () {
    if (ADS_PLAYCLICK_SEND_TO && typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', { send_to: ADS_PLAYCLICK_SEND_TO, value: 1.0, currency: 'EUR' });
    }
  };
})();
