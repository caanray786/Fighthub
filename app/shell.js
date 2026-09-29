/* App shell: installing to the home screen, offline support and page hooks.
   Loaded after every feature module. */

(() => {
  // Let CSS know which screen is showing (e.g. hide the tab bar on Welcome)
  const beforeShell = render;
  render = function () {
    beforeShell();
    document.body.dataset.page = state.page;
  };
  render();

  // ---- Offline support ----
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // ---- Install to home screen ----
  const installButton = document.getElementById('install-button');
  const dialog = document.getElementById('install-dialog');
  const steps = document.getElementById('install-steps');
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isIosSafari = isIos && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  let deferredPrompt = null;

  function showSteps() {
    if (isIos && !isIosSafari) {
      steps.innerHTML = '<p>On iPhone and iPad, apps can be added to the home screen from Safari.</p><ol><li>Open this page in <strong>Safari</strong>.</li><li>Tap the <strong>Share</strong> button ' + icon('share') + '.</li><li>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li></ol>';
    } else if (isIos) {
      steps.innerHTML = '<ol><li>Tap the <strong>Share</strong> button ' + icon('share') + ' in Safari’s toolbar.</li><li>Scroll down and choose <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong>. Fight Hub opens full screen from its icon, like any app.</li></ol>';
    } else {
      steps.innerHTML = '<ol><li>Open your browser menu (the three dots).</li><li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li><li>Confirm. Fight Hub then opens from its own icon.</li></ol>';
    }
    dialog.showModal();
  }

  if (!standalone) {
    // Android / desktop Chrome and Edge offer a real install prompt
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPrompt = e;
      installButton.hidden = false;
    });
    // iPhone has no prompt, so the button explains the two taps instead
    if (isIos) installButton.hidden = false;

    installButton.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (outcome === 'accepted') installButton.hidden = true;
      } else {
        showSteps();
      }
    });

    // The website's QR code links to ?install=1 to show the steps straight away
    if (new URLSearchParams(location.search).get('install') === '1') {
      setTimeout(() => (deferredPrompt ? installButton.click() : showSteps()), 600);
    }
  }
  window.addEventListener('appinstalled', () => { installButton.hidden = true; });
})();
