/**
 * Shared Header/Footer Injection
 * Loads common nav and footer from includes/ directory
 */

(function() {
    'use strict';

    const SUPPORT_URL = 'https://t.me/bitcoinubuntu';

    /**
     * Load and inject navigation
     */
    async function loadNav() {
        const navContainer = document.getElementById('site-nav');
        if (!navContainer) return;

        try {
            const response = await fetch('includes/nav.html');
            const html = await response.text();
            navContainer.innerHTML = html;

            // Highlight current page
            highlightCurrentPage();
        } catch (error) {
            console.error('Failed to load navigation:', error);
        }
    }

    /**
     * Load and inject footer
     */
    async function loadFooter() {
        const footerContainer = document.getElementById('site-footer');
        if (!footerContainer) return;

        try {
            const response = await fetch('includes/footer.html');
            const html = await response.text();
            footerContainer.innerHTML = html;

            // Update timestamp for all pages
            await updateTimestamp();
        } catch (error) {
            console.error('Failed to load footer:', error);
        }
    }

    /**
     * Update the timestamp in footer with latest stats data
     */
    async function updateTimestamp() {
        const updatedElement = document.getElementById('updated');
        if (!updatedElement) return;

        try {
            // Fetch the latest stats to get generated_at timestamp
            const response = await fetch('stats.json');
            const stats = await response.json();

            if (stats && stats.generated_at) {
                updatedElement.textContent = new Date(stats.generated_at).toLocaleString();
            }
        } catch (error) {
            console.error('Failed to update timestamp:', error);
            // Leave as "--" if we can't fetch stats
        }
    }

    /**
     * Highlight the current page in navigation
     */
    function highlightCurrentPage() {
        const currentPage = getCurrentPage();
        const links = document.querySelectorAll('nav a[data-page]');

        links.forEach(link => {
            const page = link.getAttribute('data-page');
            if (page === currentPage) {
                link.classList.add('current');
            }
        });
    }

    /**
     * Get current page identifier from URL
     */
    function getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.substring(path.lastIndexOf('/') + 1);

        // Map filenames to page identifiers (only for pages in nav)
        if (filename === '' || filename === 'index.html') return 'index';
        if (filename.startsWith('members')) return 'members';
        if (filename.startsWith('profile')) return 'members'; // Profile pages highlight Directory
        if (filename.startsWith('archive')) return 'archive';

        return null;
    }


    // Export support URL for use in other scripts
    window.SUPPORT_URL = SUPPORT_URL;

    // Export promise that resolves when includes are loaded
    window.includesLoaded = Promise.all([
        loadNav(),
        loadFooter()
    ]);

    // Load nav and footer when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
            await window.includesLoaded;
        });
    }
})();
