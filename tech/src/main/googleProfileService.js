const { app, ipcMain, session, webContents } = require('electron');
const log = require('../logger');

let currentProfile = { signedIn: false };
let debounceTimer = null;
let isSigningOut = false; // Lock to prevent re-extraction during sign-out

/**
 * Extracts name from a Google page title
 * Example: "Vandana rajput - Google Account" -> "Vandana rajput"
 */
function extractNameFromTitle(title) {
    if (title && title.includes('- Google Account')) {
        return title.split('-')[0].trim();
    }
    return null;
}

/**
 * Broadcasts the current profile state to all renderer windows.
 */
function broadcastUpdate() {
    log.info('[GoogleProfile] Broadcasting update:', currentProfile.signedIn ? `Ready (${currentProfile.name})` : 'Signed Out');
    const allWeb = webContents.getAllWebContents();
    log.info(`[GoogleProfile] Sending to ${allWeb.length} webContents.`);
    allWeb.forEach(wc => {
        try {
            if (!wc.isDestroyed()) {
                wc.send('google:profile-update', currentProfile);
            }
        } catch (e) { }
    });
}

/**
 * Checks if a session exists via cookies without making requests.
 */
async function checkCookieSessionSilently() {
    try {
        if (!app.isReady() || isSigningOut) return false;
        const cookies = await session.defaultSession.cookies.get({ domain: '.google.com' });
        const hasSession = cookies.some(c => (c.name === 'SID' || c.name === '__Secure-1PSID'));

        log.info('[GoogleProfile] Silent cookie check:', hasSession ? 'Session exists' : 'NO session');

        if (!hasSession && currentProfile.signedIn) {
            log.info('[GoogleProfile] Session cookies lost. Forcing UI reset.');
            currentProfile = { signedIn: false };
            broadcastUpdate();
        }
        return hasSession;
    } catch (e) {
        log.error('[GoogleProfile] Silent check error:', e.message);
        return false;
    }
}

// IPC Handlers
ipcMain.handle('google:get-profile', () => currentProfile);

ipcMain.handle('google:sign-out', async () => {
    log.info('[GoogleProfile] CRITICAL: Deep Sign-out initiated...');
    isSigningOut = true; // Lock extraction

    try {
        // 1. Explicitly remove all cookies for google domains
        const domainPatterns = ['.google.com', '.accounts.google.com', 'google.com', 'accounts.google.com', 'www.google.com', 'myaccount.google.com'];
        for (const domain of domainPatterns) {
            const cookies = await session.defaultSession.cookies.get({ domain });
            for (const c of cookies) {
                const url = `http${c.secure ? 's' : ''}://${c.domain.startsWith('.') ? c.domain.substring(1) : c.domain}${c.path}`;
                await session.defaultSession.cookies.remove(url, c.name).catch(() => { });
            }
        }

        // 2. Clear storage data for Google origins
        const origins = ['https://accounts.google.com', 'https://google.com', 'https://www.google.com', 'https://myaccount.google.com'];
        for (const origin of origins) {
            await session.defaultSession.clearStorageData({
                origin,
                storages: ['cookies', 'localstorage', 'cache', 'indexeddb', 'serviceworkers']
            }).catch(() => { });
        }

        // 3. Clear all remaining cookies broadly
        await session.defaultSession.clearStorageData({ storages: ['cookies'] }).catch(() => { });

        log.info('[GoogleProfile] Deep clear complete.');
    } catch (err) {
        log.error('[GoogleProfile] Sign-out error:', err.message);
    }

    currentProfile = { signedIn: false };
    broadcastUpdate();

    // 4. Force refresh Google tabs
    const allWeb = webContents.getAllWebContents();
    allWeb.forEach(wc => {
        try {
            const url = wc.getURL();
            if (url.includes('google.com')) {
                log.info(`[GoogleProfile] Refreshing Google tab: ${url}`);
                wc.reload();
            }
        } catch (e) { }
    });

    // Release lock after a delay
    setTimeout(() => {
        isSigningOut = false;
        log.info('[GoogleProfile] Sign-out lock released.');
    }, 5000);

    return { success: true };
});

// INITIALIZATION
app.whenReady().then(() => {
    // 1. Passive Extraction: Listen to active tab titles and DOM
    app.on('web-contents-created', (event, wc) => {
        const checkPage = async () => {
            if (wc.isDestroyed() || isSigningOut) return;
            const url = wc.getURL();
            if (!url.includes('google.com')) return;

            // CRITICAL: Only extract name if we actually have session cookies
            // This prevents "re-capturing" name from a cached page after sign-out
            const hasValidCookies = await checkCookieSessionSilently();
            if (!hasValidCookies) {
                log.info('[GoogleProfile] Passive check skipped: No session cookies detected.');
                return;
            }

            // Try title first (Fastest)
            const title = wc.getTitle();
            let name = extractNameFromTitle(title);
            let email = currentProfile.email || null;

            if (name) {
                const emailMatch = title.match(/[a-zA-Z0-9._%+-]+@gmail\.com/);
                if (emailMatch) email = emailMatch[0];
            }

            // If title is generic, try injecting a small script to find the name in the DOM
            if (!name) {
                try {
                    // This script looks for the account name in common Google header elements
                    name = await wc.executeJavaScript(`(() => {
                        const el = document.querySelector('[aria-label*="Google Account:"]');
                        if (el) {
                            const label = el.getAttribute('aria-label');
                            const match = label.match(/Google Account: (\\S+)/);
                            return match ? match[1] : null;
                        }
                        const nameEl = document.querySelector('.gb_d.gb_Ba.gb_z'); // Common desktop class
                        return nameEl ? nameEl.innerText.trim() : null;
                    })()`);
                } catch (e) { }
            }

            if (name && name !== 'Google Account') {
                log.info(`[GoogleProfile] Success: Name="${name}" captured from tab.`);
                const newProfile = {
                    signedIn: true,
                    name: name,
                    email: email
                };

                if (JSON.stringify(newProfile) !== JSON.stringify(currentProfile)) {
                    currentProfile = newProfile;
                    broadcastUpdate();
                }
            }
        };

        wc.on('page-title-updated', checkPage);
        wc.on('did-finish-load', checkPage);
    });

    // 2. Cookie Monitoring for session loss
    session.defaultSession.cookies.on('changed', (event, cookie) => {
        if (!isSigningOut && cookie.domain.includes('google.com')) {
            // If essential cookies are removed, immediately sign out
            if ((cookie.name === 'SID' || cookie.name === '__Secure-1PSID') && cookie.cause === 'explicit') {
                log.info(`[GoogleProfile] Session cookie ${cookie.name} removed. Forcing UI reset.`);
                checkCookieSessionSilently();
            } else {
                // Debounce other changes
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(checkCookieSessionSilently, 1000);
            }
        }
    });

    checkCookieSessionSilently();
    log.info('[GoogleProfile] Passive monitoring enabled.');
});
