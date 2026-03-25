const form = document.getElementById('signinForm');
const emailInput = document.getElementById('signinEmail');
const passwordInput = document.getElementById('signinPassword');
const confirmPasswordInput = document.getElementById('signinConfirmPassword');
const usernameInput = document.getElementById('signinUsername');
const confirmPasswordField = document.getElementById('confirmPasswordField');
const usernameField = document.getElementById('usernameField');
const errorEl = document.getElementById('signinError');
const modeHeader = document.getElementById('formHeader');
const primarySubmit = document.getElementById('primarySubmit');
const footPrompt = document.getElementById('footPrompt');
const createAccountLink = document.getElementById('createAccountLink');
const card = document.getElementById('signinCard');
const cardTitle = document.getElementById('cardTitle');
const cardSubtitle = document.getElementById('cardSubtitle');
const createOnlySection = document.getElementById('createOnlySection');

const showError = (msg) => {
  if (!errorEl) return;
  if (!msg) {
    errorEl.hidden = true;
    errorEl.textContent = '';
    return;
  }
  errorEl.hidden = false;
  errorEl.textContent = msg;
};

let mode = 'signin'; // or 'create'

const setMode = (nextMode) => {
  mode = nextMode;
  card?.setAttribute('data-mode', mode);
  if (modeHeader) {
    modeHeader.querySelector('.mode-title').textContent = mode === 'signin' ? 'Sign in' : 'Create account';
    modeHeader.querySelector('.mode-sub').textContent =
      mode === 'signin' ? 'Sign in to personalize your profile.' : 'Create your MuBrowser account.';
  }
  if (cardTitle) cardTitle.textContent = mode === 'signin' ? 'Sign in' : 'Create account';
  if (cardSubtitle) cardSubtitle.textContent =
    mode === 'signin' ? 'Sign in to personalize your profile.' : 'Set up your profile to sync across tabs locally.';
  if (primarySubmit) primarySubmit.textContent = mode === 'signin' ? 'Sign in' : 'Create account';
  if (createAccountLink) createAccountLink.textContent = mode === 'signin' ? 'Create account' : 'Back to sign in';
  if (footPrompt) footPrompt.textContent = mode === 'signin' ? 'New here?' : 'Have an account?';
  if (createOnlySection) createOnlySection.hidden = mode === 'signin';
  if (confirmPasswordField) confirmPasswordField.hidden = mode === 'signin';
  if (usernameField) usernameField.hidden = mode === 'signin';
  if (mode === 'signin') {
    if (confirmPasswordInput) confirmPasswordInput.value = '';
    if (usernameInput) usernameInput.value = '';
  } else {
    if (confirmPasswordInput) confirmPasswordInput.value = '';
    if (passwordInput) passwordInput.value = '';
  }
  showError('');
};

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError('');

  const email = (emailInput?.value || '').trim();
  const password = passwordInput?.value || '';
  const username = (usernameInput?.value || '').trim();
  const confirmPassword = (confirmPasswordInput?.value || '').trim();

  if (!email || !password) {
    showError('Email and password are required.');
    return;
  }
  if (mode === 'create') {
    if (!username) {
      showError('Username is required.');
      return;
    }
    if (!confirmPassword) {
      showError('Confirm password is required.');
      return;
    }
    if (password !== confirmPassword) {
      showError('Passwords do not match.');
      return;
    }
  }

  try {
    if (mode === 'signin') {
      const profile = {
        signedIn: true,
        email,
        name: email.split('@')[0] || 'User'
      };
      window.localStorage.setItem('muul_profile', JSON.stringify(profile));
      alert('Signed in locally.');
      window.close();
    } else {
      alert('Account created locally (demo). You can now sign in with these credentials.');
      setMode('signin');
    }
  } catch (err) {
    showError(err?.message || 'Sign-in failed.');
  }
});

document.getElementById('googleSignIn')?.addEventListener('click', () => {
  // Open the standard Google sign-in page in a new window/tab.
  const googleUrl = 'https://accounts.google.com/signin/v2/identifier?hl=en&flowName=GlifWebSignIn&flowEntry=ServiceLogin';
  window.open(googleUrl, '_blank', 'noopener,noreferrer');
});

createAccountLink?.addEventListener('click', (e) => {
  e.preventDefault();
  setMode(mode === 'signin' ? 'create' : 'signin');
});

setMode('signin');
