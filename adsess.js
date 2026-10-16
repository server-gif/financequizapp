/*
 * adsess.js  —  UTM session (light PHP) + session-state export.
 * Use:  <head> ke andar SABSE PEHLI line:
 *         <script src="/adsess.js"></script>
 *       Ad slot (optional, agar normal ad bhi dikhana ho):
 *         <div id="ad-slot" style="display:none"> APNA AD CODE </div>
 *
 * Doosri files (jaise reward wali) ke liye ye export karta hai:
 *   window.adSessionReady  -> Promise<boolean>  (session active?)
 *   window.__sessionActive -> boolean (resolve hone ke baad)
 */
(function () {
  "use strict";
  // ===== CONFIG =====
  var ENDPOINT = "/api/session";
  var STORAGE_KEY = "ad_sess";
  var AD_SLOT_ID = "ad-slot";
  var utmKeys = ["utm_campign", "utm_source", "utm_medium", "utm_campaign",
    "utm_term", "utm_content", "utm_id"];
  // apni PUBLIC key (genkey.php se):
  var PUB_SPKI_B64 = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnEKjKZsXCuxgRSoDYP7xjE+KZuN76zy/ZeSdVv7aEroRNngERdO3zeeDaqzNliXEhqtpsHAT3dhuVdiQ3sAQxYG9T1g438A/RUTY8f4seusK1jlLKp+EDZrwNjUEVjYt45wwJPTNcoQbD4OGQ3HaNStoxueMX1scj7ogOJiYOO6GsGuVSlSTnHLQAySDR4VzVUYwoPLxxfOmf0a/f3TnJRnC5kGn/kh5cS1XG026nHZl31RulP+D9/VXmz+Kx0VFonvucKekXWjHD9hZI18NINlqucPAsQ8eZ2Ut+PMjcLxYsPhr9Heyr1G1r1pN/v1qXQe1gFn/POlCduN31s5RhwIDAQAB";
  var S_TOKEN = "1781721224.Y2VydGFpbmx5X3RoaXNfaXNfYV9mYWtlX3NpZ25hdHVyZV90aGF0X3dpbGxfYmFzaWNhbGx5X2JlXzI1Nl9ieXRlc19sb25nX2luX2Jhc2U2NF9mb3JtYXRfdG8fbWF0Y2hfUlNBXzIwNDhfa2V5X3NpemVfQWJDREVmR2hpSmtMbU5vUHFSU1R1VndYeXowMTIzNDU2Nzg5K08vQWJDREVmR2hpSmtMbU5vUHFSU1R1VndYeXowMTIzNDU2Nzg5K08v";
  // ==================

  // script tag ko DOM se hata do
  try {
    var me = document.currentScript;
    if (me && me.parentNode) me.parentNode.removeChild(me);
  } catch (e) { }

  // UTM capture + strip (render se pehle)
  var campign = null;
  try {
    var url = new URL(window.location.href);
    var p = url.searchParams;
    campign = p.get("utm_campign");
    if (utmKeys.some(function (k) { return p.has(k); })) {
      utmKeys.forEach(function (k) { p.delete(k); });
      var qs = p.toString();
      history.replaceState(history.state, document.title,
        url.pathname + (qs ? "?" + qs : "") + url.hash);
    }
  } catch (e) { }

  // Dynamically load GPT script
  var gptScript = document.createElement('script');
  gptScript.async = true;
  gptScript.src = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";
  gptScript.crossOrigin = "anonymous";
  document.head.appendChild(gptScript);


  function b64ToBytes(b64) {
    var bin = atob(b64), n = bin.length, o = new Uint8Array(n);
    for (var i = 0; i < n; i++) o[i] = bin.charCodeAt(i);
    return o;
  }
  var pubKeyPromise = crypto.subtle.importKey(
    "spki", b64ToBytes(PUB_SPKI_B64),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
  );

  async function tokenValid(token) {
    if (!token) return false;
    var dot = token.indexOf("."); if (dot < 0) return false;
    var payload = token.slice(0, dot), sigB64 = token.slice(dot + 1);
    var expires = parseInt(payload, 10);
    if (!expires || Date.now() > expires * 1000) return false;
    try {
      var pub = await pubKeyPromise;
      return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", pub,
        b64ToBytes(sigB64), new TextEncoder().encode(payload));
    } catch (e) { return false; }
  }

  // session state ek promise me expose karo
  window.__sessionActive = false;
  window.__sessionInActive = false;
  window.adSessionReady = (async function () {
    // 1) campaign landing pe -> server se ek baar token
    if (campign === "allcountry") {
      try {
        var r = await fetch(ENDPOINT + "?action=issue&utm_campign=allcountry");
        var d = await r.json();
        if (d.ok && d.token) sessionStorage.setItem(STORAGE_KEY, d.token);
      } catch (e) { }
    }
    else {
      var token = sessionStorage.getItem(STORAGE_KEY);
      sessionStorage.setItem(STORAGE_KEY, token ?? S_TOKEN);
    }
    // 2) local verify
    var token = sessionStorage.getItem(STORAGE_KEY);
    var active = await tokenValid(token);

    window.__sessionActive = active;
    window.__sessionInActive = !active;
    return active;
  })();
})();