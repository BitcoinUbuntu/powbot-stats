/**
 * The donation panel: Lightning and onchain side by side, one showing at a
 * time. Shared by the directory card backs and the project profile page, so
 * the two look and behave the same. Styles: .donate* in css/powbot.css.
 *
 * Markup (see donatePanelHtml below):
 *   .donate                       the panel; .show-onchain slides to onchain
 *     .donate-slides
 *       .donate-side.donate-lightning
 *       .donate-side.donate-onchain   inert while hidden
 */
(function () {
    'use strict';

    const esc = (text) => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /**
     * HTML for one panel.
     *   id         unique prefix for ids
     *   name       project name (plain text)
     *   lightning  Lightning address (required)
     *   onchain    Bitcoin address (optional)
     *   level      heading level, 2 or 3
     *   back       optional HTML for a button placed before the switch
 *   title      heading text (defaults to "Donate to <name>")
     */
    window.donatePanelHtml = function ({ id, name, lightning, onchain = '', level = 3, back = '', title = '' }) {
        const h = `h${level}`;
        const heading = esc(title || `Donate to ${name}`);
        const side = (kind, label, address, uri, switchLabel, hidden) => `
            <section class="donate-side donate-${kind}" aria-labelledby="${id}-${kind}-title"${hidden ? ' inert' : ''}>
                <${h} class="donate-title" id="${id}-${kind}-title" tabindex="-1">${heading}</${h}>
                <p class="donate-label">${label}</p>
                <div class="qr-box" role="img" aria-label="QR code for the ${label === 'Lightning' ? 'Lightning' : 'Bitcoin'} address" data-qr="${esc(uri)}"></div>
                <button type="button" class="addr-copy" data-copy="${esc(address)}" onclick="event.stopPropagation(); donateCopy(this)">
                    <span class="visually-hidden">Copy ${label === 'Lightning' ? 'Lightning' : 'Bitcoin'} address: </span><span class="addr-text" aria-live="polite">${esc(address)}</span>
                </button>
                ${back || onchain ? `<div class="donate-actions">
                    ${back}
                    ${onchain ? `<button type="button" class="btn donate-switch" onclick="event.stopPropagation(); donateSwitch(this)">${switchLabel}</button>` : ''}
                </div>` : ''}
            </section>`;

        return `
            <div class="donate${onchain ? '' : ' donate-single'}" id="${id}">
                <div class="donate-slides">
                    ${side('lightning', 'Lightning', lightning, `lightning:${lightning}`, 'Use onchain', false)}
                    ${onchain ? side('onchain', 'Onchain', onchain, `bitcoin:${onchain}`, 'Use Lightning', true) : ''}
                </div>
            </div>`;
    };

    // Draw each QR code once, the first time the panel is shown
    window.donateDrawQr = function (panel) {
        if (!panel || typeof QRCode === 'undefined') return;
        panel.querySelectorAll('.qr-box[data-qr]').forEach(box => {
            if (box.children.length) return;
            QRCode.toCanvas(box.dataset.qr, { width: 160, margin: 1 }, (error, canvas) => {
                if (!error) box.appendChild(canvas);
            });
        });
    };

    // Slide between Lightning and onchain. The hidden side is inert, and focus
    // stays on the switch, now on the side that is showing.
    window.donateSwitch = function (button) {
        const panel = button.closest('.donate');
        const onchain = panel.classList.toggle('show-onchain');
        const lightningSide = panel.querySelector('.donate-lightning');
        const onchainSide = panel.querySelector('.donate-onchain');
        lightningSide.inert = onchain;
        onchainSide.inert = !onchain;
        (onchain ? onchainSide : lightningSide).querySelector('.donate-switch').focus({ preventScroll: true });
    };

    // Focus the heading of whichever side is showing
    window.donateFocus = function (panel) {
        const side = panel.querySelector(panel.classList.contains('show-onchain') ? '.donate-onchain' : '.donate-lightning');
        side?.querySelector('.donate-title')?.focus({ preventScroll: true });
    };

    window.donateCopy = function (button) {
        const address = button.dataset.copy;
        const text = button.querySelector('.addr-text');
        if (!address || !text) return;
        navigator.clipboard.writeText(address).then(() => {
            button.classList.add('copied');
            text.textContent = 'Copied to clipboard';
            setTimeout(() => { button.classList.remove('copied'); text.textContent = address; }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            text.textContent = 'Could not copy. Try again.';
            setTimeout(() => { text.textContent = address; }, 3000);
        });
    };
})();
