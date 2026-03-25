/**
 * profileUI.js
 * Handles the Profile button appearance and reactive updates.
 */

(function () {
    const profileButton = document.getElementById('profileButton');

    if (!profileButton) {
        console.warn('[profileUI] #profileButton not found');
        return;
    }

    /**
     * Updates the profile button UI based on sign-in status.
     * @param {Object} profile - { signedIn: boolean, email: string, name: string }
     */
    async function updateProfileUI(profile) {
        if (!profile) {
            profile = await window.browserBridge?.googleGetProfile?.();
        }

        console.log('[profileUI] Updating UI with profile:', profile);

        if (profile && profile.signedIn) {
            profileButton.classList.add('signed-in');
            profileButton.title = `Signed in as ${profile.name || profile.email || 'User'}`;

            // Show first letter as avatar (e.g., 'V')
            const initial = (profile.name || profile.email || 'G').charAt(0).toUpperCase();

            // Apply premium styling
            profileButton.style.display = 'flex';
            profileButton.style.alignItems = 'center';
            profileButton.style.justifyContent = 'center';
            profileButton.style.background = 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)';
            profileButton.style.color = 'white';
            profileButton.style.fontWeight = 'bold';
            profileButton.style.fontSize = '14px';
            profileButton.style.borderRadius = '50%';
            profileButton.style.width = '32px';
            profileButton.style.height = '32px';
            profileButton.style.border = '2px solid rgba(255,255,255,0.2)';
            profileButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

            profileButton.innerHTML = `<span style="line-height: 1;">${initial}</span>`;
        } else {
            console.log('[profileUI] Resetting to default icon');
            profileButton.classList.remove('signed-in');
            profileButton.title = 'Profile';
            profileButton.style.background = '';
            profileButton.style.color = '';
            profileButton.style.border = '';
            profileButton.style.boxShadow = '';
            profileButton.style.width = ''; // Reset to CSS default
            profileButton.style.height = ''; // Reset to CSS default

            // Restore default blue-ish SVG icon
            profileButton.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
            `;
        }
    }

    // Toggle the profile popup 
    const handleProfileClick = (e) => {
        e.stopPropagation();
        if (window.browserBridge?.toggleProfilePopup) {
            const rect = profileButton.getBoundingClientRect();
            const bounds = { x: rect.left, y: rect.bottom + 8, width: rect.width, height: rect.height };
            window.browserBridge.toggleProfilePopup(bounds);
        }
    };

    // Remove existing listeners if possible (hard in raw JS)
    // We'll rely on our separate logic and stopPropagation
    profileButton.addEventListener('click', handleProfileClick, true);

    // Listen for updates from main process
    window.browserBridge?.onGoogleProfileUpdate?.((profile) => {
        updateProfileUI(profile);
    });

    // Initial check
    updateProfileUI();

    console.log('[profileUI] Initialized');
})();
