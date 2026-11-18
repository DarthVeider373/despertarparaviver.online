(function () {
  "use strict";
  var KEEP = [
    "upsellToken", "upsell_token_format",
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
    "src", "sck", "xcod", "fbclid", "gclid", "ttclid"
  ];
  var UTM_ONLY = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  var ATTRS = ["upsell-accept-url", "upsell-reject-url"];
  var HOSTS = { "despertarparaviver.online": 1, "www.despertarparaviver.online": 1, "pay.cakto.com.br": 1 };
  var busy = false;
  var hrefGet = Object.getOwnPropertyDescriptor(URL.prototype, "href").get;
  var hrefSet = Object.getOwnPropertyDescriptor(URL.prototype, "href").set;
  var rawToString = URL.prototype.toString;

  function rawHref(u) { return hrefGet.call(u); }

  function isFunnelNav(u) {
    if (!u || !HOSTS[u.hostname]) return false;
    if (u.hostname === "pay.cakto.com.br") return true;
    return /^\/(opnoto|opnds|obrigado)(\/|$)/.test(u.pathname);
  }

  function merge(urlStr, keys) {
    if (!urlStr) return urlStr;
    try {
      var u = new URL(urlStr, window.location.href);
      var q = new URLSearchParams(window.location.search);
      keys.forEach(function (k) {
        var v = q.get(k);
        if (v && !u.searchParams.has(k)) u.searchParams.set(k, v);
      });
      return rawHref(u);
    } catch (e) { return urlStr; }
  }

  function mergeIfTracked(urlStr) {
    try {
      var u = new URL(urlStr, window.location.href);
      if (isFunnelNav(u)) return merge(urlStr, KEEP);
    } catch (e) {}
    return urlStr;
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
        if (typeof el.rejectUrl === "string") el.rejectUrl = merge(el.rejectUrl, KEEP);
        if (typeof el.acceptUrl === "string") el.acceptUrl = merge(el.acceptUrl, KEEP);
      });
      document.querySelectorAll("a[href]").forEach(function (a) {
        var href = a.getAttribute("href");
        if (!href) return;
        try {
          var host = new URL(href, window.location.href).hostname;
          var keys = HOSTS[host] ? KEEP : null;
          if (!keys && /(^|\/)obrigado(\/|$)/.test(location.pathname) && (host === "wa.me" || host === "api.whatsapp.com")) keys = UTM_ONLY;
          if (!keys) return;
          var next = merge(href, keys);
          if (next && next !== href && next !== a.href) a.setAttribute("href", next);
        } catch (e) {}
      });
    } finally { busy = false; }
  }

  function hookDefine() {
    if (window.__lodParamsDef || !window.customElements) return;
    window.__lodParamsDef = true;
    var orig = customElements.define.bind(customElements);
    customElements.define = function (name, ctor, opts) {
      if (typeof name === "string" && name.indexOf("cakto-upsell") === 0) decorate();
      return orig(name, ctor, opts);
    };
  }

  // Location.href cannot be hooked (own, non-configurable). Cakto builds
  // the destination with the URL API, so we add missing params on toString/href.
  function hookURL() {
    if (window.__lodParamsURL) return;
    window.__lodParamsURL = true;
    try {
      URL.prototype.toString = function () {
        var s = rawToString.call(this);
        try { if (isFunnelNav(this)) return merge(s, KEEP); } catch (e) {}
        return s;
      };
      Object.defineProperty(URL.prototype, "href", {
        configurable: true,
        enumerable: true,
        get: function () {
          var s = hrefGet.call(this);
          try { if (isFunnelNav(this)) return merge(s, KEEP); } catch (e) {}
          return s;
        },
        set: hrefSet
      });
    } catch (e) {}
  }

  function hookClicks() {
    if (window.__lodParamsClick) return;
    window.__lodParamsClick = true;
    document.addEventListener("click", function (e) {
      var path = e.composedPath ? e.composedPath() : [];
      for (var i = 0; i < path.length; i++) {
        var n = path[i];
        if (!n || !n.tagName) continue;
        var tag = n.tagName.toLowerCase();
        if (tag !== "cakto-upsell-reject" && tag !== "cakto-upsell-accept") continue;
        decorate();
        if (typeof n.rejectUrl === "string") n.rejectUrl = merge(n.rejectUrl, KEEP);
        if (typeof n.acceptUrl === "string") n.acceptUrl = merge(n.acceptUrl, KEEP);
        break;
      }
    }, true);
  }

  function start() {
    hookURL();
    hookDefine();
    hookClicks();
    decorate();
    if (window.__lodParamsObs) return;
    var obs = new MutationObserver(decorate);
    obs.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ATTRS.concat(["href"])
    });
    window.__lodParamsObs = obs;
  }

  start();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", decorate);
})();
