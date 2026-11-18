(function () {
  "use strict";
  var KEEP = [
    "upsellToken", "upsell_token_format",
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
    "src", "sck", "xcod", "fbclid", "gclid", "ttclid"
  ];
  var UTM_ONLY = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  var ATTRS = ["upsell-accept-url", "upsell-reject-url"];
  var busy = false;

  function merge(urlStr, keys) {
    if (!urlStr) return urlStr;
    try {
      var u = new URL(urlStr, window.location.href);
      var q = new URLSearchParams(window.location.search);
      keys.forEach(function (k) {
        var v = q.get(k);
        if (v && !u.searchParams.has(k)) u.searchParams.set(k, v);
      });
      return u.toString();
    } catch (e) { return urlStr; }
  }

  function decorate() {
    if (busy) return;
    busy = true;
    try {
      document.querySelectorAll("[upsell-accept-url], [upsell-reject-url]").forEach(function (el) {
        ATTRS.forEach(function (attr) {
          if (!el.hasAttribute(attr)) return;
          var next = merge(el.getAttribute(attr), KEEP);
          if (next && next !== el.getAttribute(attr)) el.setAttribute(attr, next);
        });
      });
      document.querySelectorAll("a[href]").forEach(function (a) {
        var href = a.getAttribute("href");
        if (!href) return;
        try {
          var host = new URL(href, window.location.href).hostname;
          var keys = null;
          if (host === "despertarparaviver.online" || host === "www.despertarparaviver.online" || host === "pay.cakto.com.br") keys = KEEP;
          else if (/(^|\/)obrigado(\/|$)/.test(location.pathname) && (host === "wa.me" || host === "api.whatsapp.com")) keys = UTM_ONLY;
          if (!keys) return;
          var next = merge(href, keys);
          if (next && next !== href && next !== a.href) a.setAttribute("href", next);
        } catch (e) {}
      });
    } finally { busy = false; }
  }

  function start() {
    decorate();
    if (window.__lodParamsObs) return;
    var obs = new MutationObserver(decorate);
    obs.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ATTRS.concat(["href"])
    });
    window.__lodParamsObs = obs;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
