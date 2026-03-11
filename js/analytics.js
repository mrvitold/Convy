/**
 * Convy – GA4 / Google Ads conversion tracking.
 * Set window.ConvyGA4Id in config.js (e.g. G-XXXXXXXXXX) to enable.
 */
(function () {
  var GA4_ID = (typeof window !== 'undefined' && window.ConvyGA4Id) ? String(window.ConvyGA4Id || '').trim() : '';
  if (!GA4_ID) return;

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

  window.ConvyTrackConversion = function (eventName) {
    gtag('event', eventName || 'xml_download');
  };
})();
