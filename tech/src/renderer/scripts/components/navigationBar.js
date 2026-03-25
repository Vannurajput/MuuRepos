/**
 * components/navigationBar.js
 * Wires the transport controls and address bar events.
 */
const INTERNAL_LABELS = [
  { match: '/renderer/credentialManager/index.html', label: 'Credential Manager' },
  { match: '/renderer/credentials/index.html', label: 'Database Credentials' },
  { match: '/renderer/github/index.html', label: 'GitHub Sync' },
  { match: '/renderer/settings/index.html', label: 'Settings' }
];

const formatAddressValue = (url, tabTitle = '') => {
  if (!url || url === 'about:blank') {
    return '';
  }
  if (url.startsWith('file://')) {
    const entry = INTERNAL_LABELS.find((candidate) => url.includes(candidate.match));
    if (entry) {
      return entry.label;
    }
  }
  if (/^https?:\/\//i.test(url)) {
    // Always show the full URL when not focused so users can see the complete path.
    return url;
  }
  return url;
};

export const initNavigationBar = ({ elements, bridge }) => {
  const { backButton, forwardButton, reloadButton, addressBar, securityIndicator } = elements;

  const getHostLabel = (url = '') => {
    try {
      const parsed = new URL(url);
      return parsed.host || parsed.hostname || '';
    } catch {
      return '';
    }
  };

  const resolveSecurityState = (url = '') => {
    const value = String(url || '').trim();
    if (!value || value === 'about:blank') {
      return {
        state: 'hidden',
        label: '',
        iconId: 'lock',
        title: '',
        message: '',
        host: ''
      };
    }
    const lower = value.toLowerCase();
    if (lower.startsWith('https://')) {
      return {
        state: 'secure',
        label: 'Secure connection',
        iconId: 'lock',
        title: 'Secure connection',
        message: 'Your connection to this site is secure.',
        host: getHostLabel(value)
      };
    }
    if (lower.startsWith('http://')) {
      return {
        state: 'insecure',
        label: 'Not secure connection',
        iconId: 'alert',
        title: 'Not secure',
        message: 'Your connection to this site is not secure.',
        host: getHostLabel(value)
      };
    }
    if (lower.startsWith('file://')) {
      return {
        state: 'local',
        label: 'Local file',
        iconId: 'folder',
        title: 'Local file',
        message: 'You are viewing a local file on this device.',
        host: ''
      };
    }
    if (/^(about|chrome|devtools|view-source|edge|brave):/.test(lower)) {
      return {
        state: 'internal',
        label: 'Internal page',
        iconId: 'settings',
        title: 'Internal page',
        message: 'This is a built-in browser page.',
        host: ''
      };
    }
    return {
      state: 'internal',
      label: 'Connection info',
      iconId: 'settings',
      title: 'Connection info',
      message: 'Connection details are unavailable for this page.',
      host: ''
    };
  };

  const updateSecurityIndicator = (url = '') => {
    if (!securityIndicator) return;
    const { state, label, iconId, title, message, host } = resolveSecurityState(url);
    securityIndicator.dataset.security = state;
    if (state === 'hidden') {
      securityIndicator.setAttribute('aria-expanded', 'false');
    }
    securityIndicator.dataset.securityTitle = title || '';
    securityIndicator.dataset.securityMessage = message || '';
    securityIndicator.dataset.securityHost = host || '';
    securityIndicator.dataset.securityIcon = iconId || '';
    if (label) {
      securityIndicator.setAttribute('aria-label', label);
      securityIndicator.setAttribute('title', label);
    } else {
      securityIndicator.removeAttribute('aria-label');
      securityIndicator.removeAttribute('title');
    }
    const use = securityIndicator.querySelector('use');
    if (use && iconId) {
      use.setAttribute('href', `assets/icons/mono.svg#${iconId}`);
    }
  };

  const navigateFromAddress = () => {
    const currentDisplay = addressBar.dataset.displayValue || '';
    const actualUrl = addressBar.dataset.actualUrl || '';
    const value = addressBar.value === currentDisplay && actualUrl ? actualUrl : addressBar.value;
    bridge.navigate(value);
    addressBar.blur();
  };

  backButton.addEventListener('click', () => bridge.goBack());
  forwardButton.addEventListener('click', () => bridge.goForward());
  reloadButton.addEventListener('click', () => bridge.reload());
  addressBar.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      navigateFromAddress();
    }
  });

  addressBar.addEventListener('focus', () => {
    const actual = addressBar.dataset.actualUrl;
    // Hide about:blank when focusing a new tab
    if (actual && actual !== 'about:blank') {
      addressBar.value = actual;
    } else {
      addressBar.value = '';
    }
    addressBar.select();
  });

  addressBar.addEventListener('blur', () => {
    const display = addressBar.dataset.displayValue;
    const actual = addressBar.dataset.actualUrl;
    if (actual && actual !== 'about:blank') {
      addressBar.value = actual;
      return;
    }
    if (typeof display !== 'undefined') {
      addressBar.value = display;
    }
  });

  const render = (state) => {
    backButton.disabled = !state.navigation.canGoBack;
    forwardButton.disabled = !state.navigation.canGoForward;

    const currentUrl = state.navigation.url;
    const activeTab = state.tabs?.find((tab) => tab.id === state.activeTabId);
    const friendlyTitle = activeTab?.title || '';
    const displayValue =
      document.activeElement === addressBar
        ? addressBar.value
        : formatAddressValue(currentUrl, friendlyTitle);
    if (document.activeElement !== addressBar) {
      addressBar.value = displayValue;
    }
    addressBar.dataset.actualUrl = currentUrl || '';
    addressBar.dataset.displayValue = displayValue;
    updateSecurityIndicator(currentUrl);
  };

  return { render };
};
