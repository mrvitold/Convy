/**
 * Convy – GA4 and Google Ads conversion tracking.
 * GA4: Set window.ConvyGA4Id (e.g. G-XXXXXXXXXX) in config.js.
 * Google Ads: Set window.ConvyAdsConversionSendTo (e.g. AW-XXXXX/LABEL) when you create a conversion action.
 */
(function () {
  var GA4_ID = (typeof window !== 'undefined' && window.ConvyGA4Id) ? String(window.ConvyGA4Id || '').trim() : '';
  var ADS_SEND_TO = (typeof window !== 'undefined' && window.ConvyAdsConversionSendTo) ? String(window.ConvyAdsConversionSendTo || '').trim() : '';

  if (GA4_ID) {
    (function (w, d, s, l, i) {
      w[l] = w[l] || [];
      w[l].push({ 'gtag': function () { w[l].push(arguments); } });
      var f = d.getElementsByTagName(s)[0], j = d.createElement(s);
      j.async = true;
      j.src = 'https://www.googletagmanager.com/gtag/js?id=' + i;
      f.parentNode.insertBefore(j, f);
    })(window, document, 'script', 'dataLayer', GA4_ID);

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA4_ID);
  }

  window.ConvyTrackConversion = function (eventName) {
    if (typeof window.gtag === 'function') {
      if (GA4_ID) gtag('event', eventName || 'xml_download');
      if (ADS_SEND_TO) gtag('event', 'conversion', { send_to: ADS_SEND_TO });
    }
  };
})();
