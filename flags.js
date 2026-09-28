// Country flags as small self-hosted SVGs.
//
// Data files carry flags as emoji ("🇰🇪"). Windows has no flag emoji and shows
// them as letters ("KE"), so pages draw an SVG from images/flags/ instead.
// The file name comes straight from the emoji (🇰🇪 is the letters K and E), so a
// member from a new country needs no change here: all 54 African countries are
// already in images/flags/. Anything without a file falls back to the emoji.
//
// Flags are from flag-icons (MIT, images/flags/LICENSE-flag-icons.txt).
(function () {
    const AVAILABLE = new Set([
        'ao', 'bf', 'bi', 'bj', 'bw', 'cd', 'cf', 'cg', 'ci', 'cm', 'cv', 'dj', 'dz', 'eg',
        'er', 'et', 'ga', 'gh', 'gm', 'gn', 'gq', 'gw', 'ke', 'km', 'lr', 'ls', 'ly', 'ma',
        'mg', 'ml', 'mr', 'mu', 'mw', 'mz', 'na', 'ne', 'ng', 'rw', 'sc', 'sd', 'sl', 'sn',
        'so', 'ss', 'st', 'sz', 'td', 'tg', 'tn', 'tz', 'ug', 'za', 'zm', 'zw'
    ]);

    // "🇰🇪" -> "ke"; '' for anything that isn't a single flag emoji
    function flagCode(flag) {
        const points = [...String(flag || '').trim()].map(ch => ch.codePointAt(0));
        if (points.length !== 2 || points.some(p => p < 0x1F1E6 || p > 0x1F1FF)) return '';
        return points.map(p => String.fromCharCode(p - 0x1F1E6 + 97)).join('');
    }

    const attr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

    // A flag with its country as the accessible name (and hover tooltip).
    // Without a country it is decorative and hidden from screen readers.
    window.flagHtml = function (flag, country, extraClass) {
        if (!flag) return '';
        const cls = extraClass ? ` ${extraClass}` : '';
        const code = flagCode(flag);
        if (AVAILABLE.has(code)) {
            return country
                ? `<img class="flag-img${cls}" src="images/flags/${code}.svg" alt="${attr(country)}" title="${attr(country)}" width="20" height="15" decoding="async">`
                : `<img class="flag-img${cls}" src="images/flags/${code}.svg" alt="" width="20" height="15" decoding="async">`;
        }
        return country
            ? `<span class="flag-emoji${cls}" role="img" aria-label="${attr(country)}">${flag}</span>`
            : `<span class="flag-emoji${cls}" aria-hidden="true">${flag}</span>`;
    };

    // A name followed by its flag, with the flag glued to the last word so a
    // wrapping name never leaves the flag alone on the next line. Takes plain
    // text and escapes it.
    window.nameWithFlag = function (name, flag, country) {
        const text = attr(String(name || '').trim());
        if (!flag) return text;
        const cut = text.lastIndexOf(' ');
        return `${text.slice(0, cut + 1)}<span class="nobr">${text.slice(cut + 1)}${window.flagHtml(flag, country, 'flag-after')}</span>`;
    };
})();
