/**
 * Wireframe globe of Africa with a blip for each country (homepage,
 * Countries). Plain canvas and an orthographic projection, no library.
 *
 *   const globe = PBGlobe(canvas, { points: [{ lat, lon, label, weight, left }] });
 *   globe.pause(); globe.play(); globe.paused
 *
 * It sways slowly, and each blip pulses. It draws at most 30 frames a second,
 * only while on screen and the tab is visible, and holds still under
 * prefers-reduced-motion or with screen effects off (html.fx-off, the footer
 * switch). The colour is the theme's --link, repainted when the page
 * changes between light and dark (the device, or the header switch).
 */
(function () {
    'use strict';

    // Coastline, [lat, lon], clockwise from Tangier. Low detail on purpose.
    const AFRICA = [
        [35.8, -5.9], [35.2, -2.9], [35.7, -0.6], [36.8, 3.0], [36.9, 7.8], [37.3, 9.9], [37.1, 11.0],
        [34.7, 10.8], [33.9, 10.1], [32.9, 13.2], [32.4, 15.1], [31.2, 16.6], [30.3, 19.0], [32.1, 20.1],
        [32.8, 22.6], [32.1, 24.0], [31.4, 27.2], [31.2, 29.9], [31.5, 30.4], [31.3, 32.3], [29.9, 32.6],
        [28.3, 33.1], [27.2, 33.8], [23.9, 35.5], [22.2, 36.6], [19.6, 37.2], [15.6, 39.5], [13.0, 42.7],
        [11.6, 43.1], [10.4, 45.0], [11.3, 49.2], [11.8, 51.3], [10.4, 51.3], [8.0, 49.8], [5.4, 48.5],
        [2.0, 45.3], [-0.4, 42.5], [-2.3, 40.9], [-4.0, 39.7], [-6.8, 39.3], [-8.9, 39.5], [-10.3, 40.2],
        [-13.0, 40.5], [-14.5, 40.7], [-16.2, 39.9], [-17.9, 36.9], [-19.8, 34.8], [-22.0, 35.3],
        [-23.9, 35.4], [-25.1, 33.6], [-25.9, 32.6], [-28.8, 32.1], [-29.9, 31.0], [-33.0, 27.9],
        [-34.0, 25.6], [-34.2, 22.1], [-34.8, 20.0], [-34.4, 18.5], [-33.9, 18.4], [-33.0, 17.9],
        [-29.2, 16.9], [-26.6, 15.2], [-22.9, 14.5], [-21.8, 13.9], [-17.3, 11.8], [-15.2, 12.1],
        [-12.6, 13.4], [-8.8, 13.2], [-6.1, 12.3], [-4.8, 11.8], [-3.4, 10.6], [-0.7, 8.8], [0.4, 9.4],
        [1.9, 9.8], [4.0, 9.6], [4.6, 8.3], [4.3, 6.1], [6.4, 3.4], [6.4, 2.4], [6.1, 1.2], [5.6, -0.2],
        [4.7, -2.1], [5.3, -4.0], [4.9, -6.1], [4.4, -7.7], [6.3, -10.8], [8.5, -13.2], [9.5, -13.7],
        [11.9, -15.6], [13.5, -16.6], [14.7, -17.5], [16.0, -16.5], [18.1, -16.0], [20.8, -17.1],
        [23.7, -15.9], [26.1, -14.5], [27.9, -12.9], [30.4, -9.6], [31.5, -9.8], [32.3, -9.2],
        [33.6, -7.6], [34.0, -6.8], [35.2, -6.2], [35.8, -5.9]
    ];
    const MADAGASCAR = [
        [-12.0, 49.3], [-15.3, 50.5], [-18.1, 49.4], [-21.0, 48.4], [-23.5, 47.6], [-25.0, 47.0],
        [-25.6, 45.1], [-23.4, 43.6], [-20.3, 44.3], [-15.7, 46.3], [-13.7, 48.0], [-12.0, 49.3]
    ];

    // Rough centre of each African country, by ISO code, for the blips
    window.PB_COUNTRY_LL = {
        DZ: [28.0, 1.7], AO: [-11.2, 17.9], BJ: [9.3, 2.3], BW: [-22.3, 24.7], BF: [12.2, -1.6], BI: [-3.4, 29.9],
        CV: [16.0, -24.0], CM: [5.7, 12.4], CF: [6.6, 20.9], TD: [15.5, 18.7], KM: [-11.9, 43.9], CD: [-4.0, 21.8],
        CG: [-0.2, 15.8], CI: [7.5, -5.5], DJ: [11.8, 42.6], EG: [26.8, 30.8], GQ: [1.6, 10.3], ER: [15.2, 39.8],
        SZ: [-26.5, 31.5], ET: [9.1, 40.5], GA: [-0.8, 11.6], GM: [13.4, -15.3], GH: [7.9, -1.0], GN: [9.9, -9.7],
        GW: [11.8, -15.2], KE: [0.2, 37.9], LS: [-29.6, 28.2], LR: [6.4, -9.4], LY: [26.3, 17.2], MG: [-18.8, 46.9],
        MW: [-13.3, 34.3], ML: [17.6, -4.0], MR: [21.0, -10.9], MU: [-20.3, 57.6], MA: [31.8, -7.1], MZ: [-18.7, 35.5],
        NA: [-22.9, 18.5], NE: [17.6, 8.1], NG: [9.1, 8.7], RW: [-1.9, 29.9], ST: [0.2, 6.6], SN: [14.5, -14.5],
        SC: [-4.7, 55.5], SL: [8.5, -11.8], SO: [5.2, 46.2], ZA: [-29.0, 25.0], SS: [6.9, 31.3], SD: [12.9, 30.2],
        TZ: [-6.4, 34.9], TG: [8.6, 0.8], TN: [33.9, 9.5], UG: [1.4, 32.3], ZM: [-13.1, 27.8], ZW: [-19.0, 29.2]
    };
    // Where a neighbour sits just to the right, the label goes on the left
    window.PB_LABEL_LEFT = new Set(['GH', 'CI', 'LR', 'SL', 'GN', 'GW', 'GM', 'SN', 'MR', 'BF', 'ML', 'BI', 'RW', 'UG', 'MW']);

    const RAD = Math.PI / 180;

    window.PBGlobe = function (canvas, { points = [] } = {}) {
        const ctx = canvas.getContext('2d');
        const reduce = matchMedia('(prefers-reduced-motion: reduce)');
        const dark = matchMedia('(prefers-color-scheme: dark)');
        let w = 0, h = 0, raf = 0, last = 0, onScreen = true, paused = false, rgb = '55, 68, 47';

        const still = () => paused || reduce.matches || document.documentElement.classList.contains('fx-off');

        // The theme's link colour, as "r, g, b"
        function readColour() {
            const probe = document.createElement('span');
            probe.style.color = 'var(--link)';
            canvas.parentNode.appendChild(probe);
            const m = getComputedStyle(probe).color.match(/\d+/g);
            probe.remove();
            if (m) rgb = m.slice(0, 3).join(', ');
        }

        function size() {
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const r = canvas.getBoundingClientRect();
            w = r.width; h = r.height;
            canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function draw(t) {
            const moving = !still();
            // Close in: Africa fills the frame, the rim runs off the top and bottom
            const R = Math.min(w * 0.46, h * 0.74), cx = w / 2, cy = h / 2 + R * 0.02;
            const lam0 = (18 + (moving ? 16 * Math.sin(t / 2600) : 0)) * RAD;
            const phi0 = -4 * RAD;
            const sp0 = Math.sin(phi0), cp0 = Math.cos(phi0);
            const proj = (lat, lon) => {
                const p = lat * RAD, l = lon * RAD - lam0;
                const cosc = sp0 * Math.sin(p) + cp0 * Math.cos(p) * Math.cos(l);
                return [cx + R * Math.cos(p) * Math.sin(l), cy - R * (cp0 * Math.sin(p) - sp0 * Math.cos(p) * Math.cos(l)), cosc > 0];
            };
            const path = (pts, close) => {
                ctx.beginPath();
                let pen = false;
                for (const [la, lo] of pts) {
                    const [x, y, ok] = proj(la, lo);
                    if (!ok) { pen = false; continue; }
                    if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
                    pen = true;
                }
                if (close) ctx.closePath();
            };

            ctx.clearRect(0, 0, w, h);

            // Sphere and graticule
            ctx.lineWidth = 1;
            ctx.strokeStyle = `rgba(${rgb}, 0.6)`;
            ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = `rgba(${rgb}, 0.2)`;
            for (let lat = -60; lat <= 60; lat += 20) {
                const pts = []; for (let lon = -180; lon <= 180; lon += 4) pts.push([lat, lon]);
                path(pts); ctx.stroke();
            }
            for (let lon = -180; lon < 180; lon += 20) {
                const pts = []; for (let lat = -88; lat <= 88; lat += 4) pts.push([lat, lon]);
                path(pts); ctx.stroke();
            }

            // Land
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = `rgba(${rgb}, 0.95)`;
            ctx.fillStyle = `rgba(${rgb}, 0.1)`;
            for (const shape of [AFRICA, MADAGASCAR]) { path(shape, true); ctx.fill(); ctx.stroke(); }

            // A scan line sweeping down the disc
            if (moving) {
                const sy = cy - R + ((t / 18) % (2 * R));
                const half = Math.sqrt(Math.max(0, R * R - (sy - cy) ** 2));
                ctx.strokeStyle = `rgba(${rgb}, 0.35)`;
                ctx.beginPath(); ctx.moveTo(cx - half, sy); ctx.lineTo(cx + half, sy); ctx.stroke();
            }

            // Blips: a square, a pulse ring, a label
            ctx.font = '13px "Share Tech Mono", ui-monospace, monospace';
            ctx.textBaseline = 'middle';
            points.forEach((pt, i) => {
                const [x, y, ok] = proj(pt.lat, pt.lon);
                if (!ok) return;
                const s = 4 + Math.min(3, pt.weight || 1) * 0.8;
                ctx.fillStyle = `rgb(${rgb})`;
                ctx.fillRect(x - s / 2, y - s / 2, s, s);
                if (moving) {
                    const ph = ((t / 1600) + i * 0.37) % 1;
                    ctx.strokeStyle = `rgba(${rgb}, ${0.8 * (1 - ph)})`;
                    ctx.beginPath(); ctx.arc(x, y, s + ph * 14, 0, Math.PI * 2); ctx.stroke();
                }
                if (pt.label) {
                    ctx.fillStyle = `rgb(${rgb})`;
                    ctx.textAlign = pt.left ? 'right' : 'left';
                    ctx.fillText(pt.label, pt.left ? x - s - 5 : x + s + 5, y);
                }
            });
        }

        function frame(t) {
            raf = 0;
            if (!onScreen || document.hidden || still()) return;
            if (t - last >= 33) { last = t; draw(t); }
            raf = requestAnimationFrame(frame);
        }
        function run() {
            if (still()) { draw(last); return; }
            if (!raf) raf = requestAnimationFrame(frame);
        }

        readColour(); size(); draw(0);
        new ResizeObserver(() => { size(); draw(last); }).observe(canvas);
        new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) run(); }).observe(canvas);
        document.addEventListener('visibilitychange', run);
        document.addEventListener('pb:fx', run);
        reduce.addEventListener('change', run);
        dark.addEventListener('change', () => { readColour(); draw(last); });
        document.addEventListener('pb:theme', () => { readColour(); draw(last); });
        run();

        return {
            get paused() { return paused; },
            pause() { paused = true; run(); },
            play() { paused = false; run(); }
        };
    };
})();
