const profileName = document.getElementById('profileName');
const profileSub = document.getElementById('profileSub');
const authButton = document.getElementById('authButton');

console.log('[ProfilePopup] Script loading...');
if (window.browserBridge?.githubLog) {
    window.browserBridge.githubLog('[ProfilePopup] renderer script initialized');
}

const getStoredProfile = () => {
    try {
        const raw = window.localStorage.getItem('muul_profile');
        return raw ? JSON.parse(raw) : { signedIn: false };
    } catch {
        return { signedIn: false };
    }
};

const setStoredProfile = (data = {}) => {
    try {
        window.localStorage.setItem('muul_profile', JSON.stringify(data));
    } catch {
        // ignore
    }
};

const updateUI = async (profile) => {
    if (!profile) {
        // Fallback: check local storage first then google
        const local = getStoredProfile();
        const google = await window.browserBridge?.googleGetProfile?.();
        profile = (google && google.signedIn) ? google : local;
    }

    profileName.textContent = profile?.name || 'Profile';
    profileSub.textContent = profile?.signedIn ? profile.email || 'Signed in' : 'Not signed in';

    if (profile?.signedIn) {
        authButton.textContent = 'Sign out';
        authButton.dataset.act = 'signout';
        // If it's signed in, and not explicitly marked 'local', assume it's Google for this context
        authButton.dataset.type = profile.isLocal ? 'local' : 'google';
    } else {
        authButton.textContent = 'Sign in';
        authButton.dataset.act = 'signin';
    }
}

// Listen for updates
window.browserBridge?.onGoogleProfileUpdate?.((profile) => {
    updateUI(profile);
});

document.querySelectorAll('.profile-action').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
        const act = e.currentTarget.getAttribute('data-act');
        console.log(`[ProfilePopup] Action triggered: ${act}`);

        try {
            // Log to terminal for easier verification if browserBridge is available
            if (window.browserBridge?.githubLog) {
                await window.browserBridge.githubLog(`[ProfilePopup] User clicked action: ${act}`);
            }

            if (act === 'manage') {
                if (window.browserBridge?.toggleSettingsPopup) {
                    // Position settings popup relative to the screen/main window
                    const bounds = { x: window.screen.width - 400, y: 80, width: 40, height: 40 };
                    await window.browserBridge.toggleSettingsPopup(bounds);
                } else {
                    console.warn('[ProfilePopup] browserBridge.toggleSettingsPopup not found');
                }
            } else if (act === 'signin') {
                if (window.browserBridge?.createTab && window.browserBridge?.navigate) {
                    // 1. Create a new tab
                    await window.browserBridge.createTab();

                    // 2. Resolve signin.html path relative to current popup.html
                    let signinUrl;
                    try {
                        const currentUrl = new URL(window.location.href);
                        signinUrl = new URL('signin.html', currentUrl).href;
                    } catch (e) {
                        signinUrl = window.location.href.replace('popup.html', 'signin.html');
                    }

                    console.log(`[ProfilePopup] Navigating to: ${signinUrl}`);
                    if (window.browserBridge?.githubLog) {
                        await window.browserBridge.githubLog(`[ProfilePopup] Navigating tab to signin page: ${signinUrl}`);
                    }

                    // 3. Navigate the newly created (and active) tab
                    await window.browserBridge.navigate(signinUrl);
                } else {
                    console.warn('[ProfilePopup] browserBridge.createTab or navigate not found');
                }
            } else if (act === 'signout') {
                // If the user's name or email suggests Google, or if explicitly typed as google
                const isGoogle = authButton.dataset.type === 'google' || profileName.textContent.toLowerCase() === 'google user';

                if (window.browserBridge?.githubLog) {
                    await window.browserBridge.githubLog(`[ProfilePopup] Sign-out triggered. isGoogle: ${isGoogle}`);
                }

                if (isGoogle && window.browserBridge?.googleSignOut) {
                    await window.browserBridge.googleSignOut();
                }

                // Clear local muul profile as well
                setStoredProfile({ signedIn: false });

                // Force UI update to show signed out state
                await updateUI({ signedIn: false });
            }
        } catch (err) {
            console.error('[ProfilePopup] Action failed:', err);
            if (window.browserBridge?.githubLog) {
                await window.browserBridge.githubLog(`[ProfilePopup] ERROR in action ${act}: ${err.message}`);
            }
        } finally {
            // Always try to hide the popup after an action attempt
            if (window.browserBridge?.hideProfilePopup) {
                await window.browserBridge.hideProfilePopup().catch(() => { });
            }
        }
    });
});

// Initial Load
updateUI();
