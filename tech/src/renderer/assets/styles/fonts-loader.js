(() => {
  const script = document.currentScript;
  if (!script) {
    return;
  }

  const href = new URL('fonts.css', script.src).toString();
  const loadFonts = () => {
    if (document.querySelector('link[data-fonts]')) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-fonts', 'true');
    document.head.appendChild(link);
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(loadFonts, { timeout: 1500 });
  } else {
    window.setTimeout(loadFonts, 0);
  }
})();
