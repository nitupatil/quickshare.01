/* Progressive enhancement only: do not replace the core file transfer controllers. */
(() => {
  const cards = document.querySelectorAll('.qs-choice');
  const canTilt = window.matchMedia('(hover:hover) and (pointer:fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if (canTilt) cards.forEach(card => {
    card.addEventListener('pointermove', event => {
      const rect = card.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
      card.style.setProperty('--pointer-x', String(x));
      card.style.setProperty('--pointer-y', String(y));
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--pointer-x', '0');
      card.style.setProperty('--pointer-y', '0');
    });
  });

  // The same existing navTo() handles both the desktop cards and these mobile shortcuts.
  const navButtons = document.querySelectorAll('.qs-mobile-nav button[data-view]');
  const refreshNav = () => {
    const active = document.querySelector('.view.active');
    const activeId = active?.id;
    navButtons.forEach(button => {
      const selected = button.dataset.view === activeId ||
        (activeId === 'view-active' && button.dataset.view === 'view-send') ||
        (activeId === 'view-vault' && button.dataset.view === 'view-receive');
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  };
  const app = document.getElementById('app-container');
  if (app) new MutationObserver(refreshNav).observe(app, {subtree:true,attributes:true,attributeFilter:['class']});
  refreshNav();

  async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Copy not supported');
  }
  async function handleCopy(button, text) {
    const previous = button.textContent;
    try {
      await copyText(text);
      button.textContent = '✓ Copied!';
    } catch {
      button.textContent = 'Copy failed';
    }
    window.setTimeout(() => { button.textContent = previous; }, 1600);
  }
  const getCode = id => document.getElementById(id)?.textContent?.trim() || '';
  document.getElementById('qs-copy-link')?.addEventListener('click', event => {
    const pin = getCode('display-pin'), otp = getCode('display-otp');
    if (!/^\d{4}$/.test(pin) || !/^\d{4}$/.test(otp)) return;
    const link = new URL(window.location.pathname, window.location.origin);
    link.searchParams.set('pin', pin);
    link.searchParams.set('otp', otp);
    handleCopy(event.currentTarget, link.toString());
  });
  document.getElementById('qs-copy-codes')?.addEventListener('click', event => {
    const pin = getCode('display-pin'), otp = getCode('display-otp');
    if (!/^\d{4}$/.test(pin) || !/^\d{4}$/.test(otp)) return;
    handleCopy(event.currentTarget, 'QuickShares PIN: ' + pin + '\nOTP: ' + otp);
  });
})();
