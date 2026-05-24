(function () {
  try {
    var theme = localStorage.getItem('hs_theme') || 'light';
    if (
      theme === 'dark' ||
      (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {
    console.warn('[nuxt-core] Error initializing theme:', e);
  }
})();
