/* ============================================
   FightHub — visitor statistics (Google Analytics through Google Tag Manager)
   Container GTM-PN2W3QDX, which holds the Google Analytics tag.
   Google Consent Mode: no analytics cookies are stored until the visitor
   accepts them in the banner below. Until then Google only receives
   cookieless pings, so visits are still counted (as estimates).
   The choice is kept on the device ('fighthub-cookies' = granted | denied)
   and can be changed with any link marked data-cookie-settings, such as
   "Cookie settings" in the footer. Loaded by every public page of the
   website and by the app (/app/), not by the admin portal.
   ============================================ */
(function () {
  var KEY = 'fighthub-cookies';
  var CONTAINER = 'GTM-PN2W3QDX';
  var choice = null;
  try { choice = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }

  // Google Tag Manager, with every kind of storage refused until the visitor agrees
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  gtag('consent', 'default', {
    analytics_storage: choice === 'granted' ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });
  gtag('js', new Date());
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  var tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtm.js?id=' + CONTAINER;
  (document.head || document.documentElement).appendChild(tag);

  // ---- The cookie banner ----
  var STYLE = '.fh-consent{position:fixed;left:16px;bottom:16px;z-index:2147483000;max-width:380px;padding:18px 18px 16px;border-radius:14px;'
    + 'background:rgba(16,16,19,.94);border:1px solid rgba(255,255,255,.1);box-shadow:0 18px 50px rgba(0,0,0,.5);color:#e8e8ec;'
    + 'font:400 14px/1.55 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}'
    + '.fh-consent strong{display:block;margin-bottom:4px;font-weight:700;color:#fff}'
    + '.fh-consent p{margin:0}.fh-consent a{color:#ff6b78}'
    + '.fh-consent-buttons{display:flex;gap:10px;margin-top:14px}'
    + '.fh-consent button{flex:1;min-height:42px;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06);'
    + 'color:#fff;font:600 14px/1 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}'
    + '.fh-consent button:hover{background:rgba(255,255,255,.12)}'
    + '.fh-consent button:focus-visible{outline:2px solid #e63946;outline-offset:2px}'
    + '@media (max-width:600px){.fh-consent{left:12px;right:12px;bottom:12px;max-width:none}}';

  var banner = null;
  function close() { if (banner) { banner.remove(); banner = null; } }
  function decide(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* storage blocked: asked again next time */ }
    choice = value;
    gtag('consent', 'update', { analytics_storage: value });
    window.dataLayer.push({ event: 'cookie_choice', cookie_choice: value });
    close();
  }
  function open() {
    if (banner || !document.body) return;
    if (!document.getElementById('fh-consent-style')) {
      var css = document.createElement('style');
      css.id = 'fh-consent-style';
      css.textContent = STYLE;
      document.head.appendChild(css);
    }
    banner = document.createElement('div');
    banner.className = 'fh-consent';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookies');
    banner.innerHTML = '<p><strong>Cookies</strong>We’d like to use Google Analytics cookies to count visits and see which pages help most. '
      + 'They’re only set if you accept. <a href="/privacy.html#cookies">Privacy policy</a></p>'
      + '<div class="fh-consent-buttons"><button type="button" data-consent="denied">Reject</button><button type="button" data-consent="granted">Accept</button></div>';
    banner.addEventListener('click', function (e) {
      var b = e.target.closest('[data-consent]');
      if (b) decide(b.getAttribute('data-consent'));
    });
    document.body.appendChild(banner);
  }

  // "Cookie settings" links reopen the banner
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('[data-cookie-settings]');
    if (!link) return;
    e.preventDefault();
    close();
    open();
  });

  function ready() {
    // Add "Cookie settings" to the website footer
    var legal = document.querySelector('.footer-legal');
    if (legal && !legal.querySelector('[data-cookie-settings]')) {
      var a = document.createElement('a');
      a.href = '#';
      a.setAttribute('data-cookie-settings', '');
      a.textContent = 'Cookie settings';
      legal.appendChild(a);
    }
    if (choice !== 'granted' && choice !== 'denied') open();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();

  window.fightHubCookies = { open: open, choice: function () { return choice; } };
})();
