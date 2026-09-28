/**
 * PoW Submission Tracker - JavaScript
 *
 * Handles:
 * - Data loading from tracker-data.json
 * - Filtering (status, project, date, platform, search)
 * - Pagination (50 per page)
 * - Card expand/collapse
 */

// ============================================================================
// Configuration
// ============================================================================

const ITEMS_PER_PAGE = 50;

// Every string that reaches innerHTML goes through this. merchant_name comes
// from BTCMap (anyone can edit an OSM name), notes and addresses come from the
// bot's parse of a submitted post - none of it is ours to trust as markup.
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Links are only rendered when they look like http(s) URLs; anything else
// (javascript:, data:) is dropped rather than escaped into an href.
function safeUrl(value) {
    const s = String(value || '').trim();
    return /^https?:\/\//i.test(s) ? escapeHtml(s) : '';
}
let allSubmissions = [];
let filteredSubmissions = [];
let currentPage = 1;

// ============================================================================
// Data Loading
// ============================================================================

// Frozen snapshots of past epochs, newest first.
//
// tracker-data.json holds ONLY the current epoch - the stats export is scoped by
// CURRENT_EPOCH, so the moment an epoch rolls over its submissions disappear from
// that file. Each finished epoch is therefore frozen into its own archive here,
// the same way stats-epoch*.json already works.
//
// ==> WHEN AN EPOCH ENDS: freeze tracker-data.json as tracker-data-epochN.json
//     and add it to this list. <==
//
// Archives carry the same per-submission detail as the live file (lightning
// address, btcmap link, status, payments), so history loses nothing.
const TRACKER_ARCHIVES = ['tracker-data-epoch5.json'];

async function loadTrackerData() {
    try {
        // Live epoch from the VPS, falling back to this repo's copy if it is
        // unreachable. The archives below stay same-origin - they are frozen and
        // change only via git, so there is nothing to gain from the VPS.
        const data = await fetchLiveData('tracker-data.json');

        // Load archived epochs alongside the live one. Each fails to null
        // independently: a missing archive must not take the whole tracker down,
        // it just means that epoch is absent from the list.
        // Each submission is tagged with its epoch: the archive's number comes
        // from its file name, the live file is the current epoch (epoch-config.js).
        const archives = (await Promise.all(
            TRACKER_ARCHIVES.map(f =>
                fetch(f).then(r => r.ok ? r.json() : null).catch(() => null)
                    .then(a => a && { ...a, epoch: Number((f.match(/epoch(\d+)/) || [])[1]) || null })
            )
        )).filter(Boolean);

        const tag = (subs, epoch) => (subs || []).map(s => ({ ...s, epoch }));
        const archivedSubmissions = archives.flatMap(a => tag(a.submissions, a.epoch));
        const currentEpoch = window.POWBOT_EPOCH?.number ?? null;

        // Live epoch first, then archives, newest-first overall.
        allSubmissions = [...tag(data.submissions, currentEpoch), ...archivedSubmissions]
            .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

        // Update footer timestamp (with retry in case footer loads after data)
        updateFooterTimestamp(data.last_updated);

        // Populate dropdowns
        populateEpochFilter();
        populateProjectFilter();

        // Apply URL parameters if present
        applyURLFilters();

        // Apply initial filter and render
        applyFilters();

    } catch (error) {
        console.error('Error loading tracker data:', error);
        showError('The submissions could not load.');
    }
}

// ============================================================================
// Filter Population
// ============================================================================

function populateEpochFilter() {
    const epochSelect = document.getElementById('filter-epoch');
    const epochs = [...new Set(allSubmissions.map(s => s.epoch).filter(e => e != null))]
        .sort((a, b) => b - a);
    epochs.forEach(epoch => {
        const option = document.createElement('option');
        option.value = String(epoch);
        option.textContent = `Epoch ${epoch}`;
        epochSelect.appendChild(option);
    });
}

function populateProjectFilter() {
    const projectSelect = document.getElementById('filter-project');

    // Get unique projects
    const projects = [...new Set(allSubmissions.map(s => s.project_name))]
        .sort();

    // Add options (strip flag and country name for cleaner display)
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project;
        option.textContent = extractProjectNameOnly(project);
        projectSelect.appendChild(option);
    });
}

function stripCountryName(name) {
    // Remove country name in parentheses, keep flag emoji
    return name.replace(/\s*\([^)]+\)/, '').trim();
}

// ============================================================================
// Footer Timestamp Update
// ============================================================================

function updateFooterTimestamp(lastUpdated) {
    if (!lastUpdated) return;

    const updateElement = () => {
        const updatedElement = document.getElementById('updated');
        if (updatedElement) {
            updatedElement.textContent = new Date(lastUpdated).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC';
            return true;
        }
        return false;
    };

    // Try immediately
    if (updateElement()) return;

    // Retry up to 5 times if footer hasn't loaded yet
    let retries = 0;
    const retryInterval = setInterval(() => {
        if (updateElement() || retries >= 5) {
            clearInterval(retryInterval);
        }
        retries++;
    }, 200);
}

// ============================================================================
// URL Parameter Handling
// ============================================================================

function applyURLFilters() {
    const urlParams = new URLSearchParams(window.location.search);

    // Apply epoch filter (a number, e.g. ?epoch=6)
    const epochParam = urlParams.get('epoch');
    if (epochParam) {
        document.getElementById('filter-epoch').value = epochParam;
    }

    // Apply status filter
    const statusParam = urlParams.get('status');
    if (statusParam) {
        document.getElementById('filter-status').value = statusParam;
    }

    // Apply project filter
    const projectParam = urlParams.get('project');
    if (projectParam) {
        // Find the full project name that matches (case-insensitive). An exact
        // name wins, so "Bitcoin Dua" can never select a longer name containing it.
        const projectSelect = document.getElementById('filter-project');
        const wanted = projectParam.toLowerCase();
        const options = [...projectSelect.options].filter(o => o.value);
        const match = options.find(o => extractProjectNameOnly(o.value).toLowerCase() === wanted)
            || options.find(o => o.value.toLowerCase().includes(wanted) || o.textContent.toLowerCase().includes(wanted));
        if (match) projectSelect.value = match.value;
    }

    // Apply date filter
    const dateParam = urlParams.get('date');
    if (dateParam) {
        document.getElementById('filter-date').value = dateParam;

        // Show custom date range if needed
        if (dateParam === 'custom') {
            document.getElementById('custom-date-range').style.display = 'block';

            const fromParam = urlParams.get('from');
            const toParam = urlParams.get('to');
            if (fromParam) document.getElementById('filter-date-from').value = fromParam;
            if (toParam) document.getElementById('filter-date-to').value = toParam;
        }
    }

    // Apply search query
    const searchParam = urlParams.get('search');
    if (searchParam) {
        document.getElementById('filter-search').value = searchParam;
    }
}

function extractProjectNameOnly(name) {
    // Remove both country name AND flag emoji, return just project name
    // E.g., "Bitbiashara (Kenya) 🇰🇪" -> "Bitbiashara"
    return name.replace(/\s*\([^)]+\)/, '').replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, '').trim();
}

// ============================================================================
// Filtering Logic
// ============================================================================

function applyFilters() {
    const epochFilter = document.getElementById('filter-epoch').value;
    const statusFilter = document.getElementById('filter-status').value;
    const projectFilter = document.getElementById('filter-project').value;
    const dateFilter = document.getElementById('filter-date').value;
    const searchQuery = document.getElementById('filter-search').value.toLowerCase();

    // Update active filter styling
    document.getElementById('filter-epoch').classList.toggle('active', epochFilter !== '');
    updateFilterActiveStates(statusFilter, projectFilter, dateFilter, searchQuery);

    // Start with all submissions
    filteredSubmissions = allSubmissions.filter(submission => {
        // Epoch filter
        if (epochFilter && String(submission.epoch) !== epochFilter) {
            return false;
        }

        // Status filter
        if (statusFilter && submission.status !== statusFilter) {
            return false;
        }

        // Project filter
        if (projectFilter && submission.project_name !== projectFilter) {
            return false;
        }

        // Date filter
        if (!passesDateFilter(submission, dateFilter)) {
            return false;
        }

        // Search filter (project, merchant, notes, or post URLs)
        if (searchQuery) {
            const projectMatch = submission.project_name.toLowerCase().includes(searchQuery);
            const merchantMatch = submission.merchant_name.toLowerCase().includes(searchQuery);
            const noteMatch = submission.note.toLowerCase().includes(searchQuery);
            const postUrlMatch = (submission.post_url || '').toLowerCase().includes(searchQuery);
            const telegramMatch = (submission.telegram_link || '').toLowerCase().includes(searchQuery);
            if (!projectMatch && !merchantMatch && !noteMatch && !postUrlMatch && !telegramMatch) {
                return false;
            }
        }

        return true;
    });

    // Reset to page 1 when filters change
    currentPage = 1;

    // Update URL with current filters
    updateURL(epochFilter, statusFilter, projectFilter, dateFilter, searchQuery);

    // Render
    renderSubmissions();
    updatePagination();
}

function updateURL(epochFilter, statusFilter, projectFilter, dateFilter, searchQuery) {
    const params = new URLSearchParams();

    // Only add non-empty filters to URL
    if (epochFilter) params.set('epoch', epochFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (projectFilter) {
        // Use project name without flag/country for cleaner URL
        params.set('project', extractProjectNameOnly(projectFilter));
    }
    if (dateFilter && dateFilter !== 'all') {
        params.set('date', dateFilter);

        // Add custom date range if applicable
        if (dateFilter === 'custom') {
            const fromDate = document.getElementById('filter-date-from').value;
            const toDate = document.getElementById('filter-date-to').value;
            if (fromDate) params.set('from', fromDate);
            if (toDate) params.set('to', toDate);
        }
    }
    if (searchQuery) params.set('search', searchQuery);

    // Update URL without reloading the page
    const newURL = params.toString() ? `?${params.toString()}` : 'tracker.html';
    window.history.replaceState({}, '', newURL);
}

function updateFilterActiveStates(statusFilter, projectFilter, dateFilter, searchQuery) {
    // Status
    const statusSelect = document.getElementById('filter-status');
    statusSelect.classList.toggle('active', statusFilter !== '');

    // Project
    const projectSelect = document.getElementById('filter-project');
    projectSelect.classList.toggle('active', projectFilter !== '');

    // Date
    const dateSelect = document.getElementById('filter-date');
    dateSelect.classList.toggle('active', dateFilter !== 'all');

    // Search
    const searchInput = document.getElementById('filter-search');
    searchInput.classList.toggle('active', searchQuery !== '');
}

// Tracker timestamps look like "2026-09-28 00:52:06 UTC". Rewrite to ISO
// ("2026-09-28T00:52:06Z") before parsing: Chrome accepts the original form,
// but Safari returns Invalid Date for it, which emptied every date filter.
function parseTrackerTime(timestamp) {
    return new Date(String(timestamp || '').replace(' UTC', 'Z').replace(' ', 'T'));
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Date filters work in UTC days, like every date shown on the site.
function passesDateFilter(submission, dateFilter) {
    if (dateFilter === 'all') return true;

    const submissionDate = parseTrackerTime(submission.timestamp);
    if (isNaN(submissionDate)) return false;
    const now = Date.now();

    switch (dateFilter) {
        case 'today': {
            // Same UTC calendar day as now
            return submissionDate.toISOString().slice(0, 10) === new Date(now).toISOString().slice(0, 10);
        }

        case '7days':
            return submissionDate.getTime() >= now - 7 * DAY_MS;

        case '30days':
            return submissionDate.getTime() >= now - 30 * DAY_MS;

        case 'custom': {
            const fromDate = document.getElementById('filter-date-from').value;
            const toDate = document.getElementById('filter-date-to').value;

            if (!fromDate && !toDate) return true;

            // Date inputs give "YYYY-MM-DD"; treat them as whole UTC days
            if (fromDate) {
                const from = Date.parse(fromDate + 'T00:00:00Z');
                if (submissionDate.getTime() < from) return false;
            }

            if (toDate) {
                const to = Date.parse(toDate + 'T23:59:59.999Z');
                if (submissionDate.getTime() > to) return false;
            }

            return true;
        }

        default:
            return true;
    }
}

// ============================================================================
// Rendering
// ============================================================================

function renderSubmissions() {
    const container = document.getElementById('submissions-container');

    // Calculate pagination
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageSubmissions = filteredSubmissions.slice(startIndex, endIndex);

    // Update results count
    const resultsCount = document.getElementById('results-count');
    if (filteredSubmissions.length === 0) {
        container.innerHTML = `
            <div class="list-state">
                <p>No submissions match these filters.</p>
                <p>Try a shorter search, or set status, project and date range back to all.</p>
            </div>
        `;
        resultsCount.textContent = 'No submissions match';
        return;
    }

    resultsCount.textContent = resultsText(startIndex, endIndex);

    // Render submission cards
    const submissionsHTML = pageSubmissions.map(submission => renderSubmissionCard(submission)).join('');

    container.innerHTML = `<ul class="submissions-list">${submissionsHTML}</ul>`;

    // Attach event listeners
    attachCardListeners();
}

// Review status as a text label; colour only reinforces it.
// Processed means approved and paid, so it reads "Approved".
const STATUS_LABELS = {
    'processed': { cls: 'status-approved', label: 'Approved' },
    'rejected': { cls: 'status-rejected', label: 'Rejected' },
    'pending review': { cls: 'status-pending', label: 'Pending review' },
    'approved': { cls: 'status-pending', label: 'Approved, payment pending' }
};

function renderStatus(status) {
    const known = STATUS_LABELS[String(status || '').trim().toLowerCase()];
    const cls = known ? known.cls : 'status-neutral';
    const label = known ? known.label : (status || 'Unknown');
    return `<span class="status ${cls}">${escapeHtml(label)}</span>`;
}

// "Bitbiashara (Kenya) 🇰🇪" -> "Kenya", or '' when the name has no country
function extractCountry(name) {
    const match = String(name || '').match(/\(([^)]+)\)/);
    return match ? match[1].trim() : '';
}

function resultsText(startIndex, endIndex) {
    const total = filteredSubmissions.length;
    return `Showing ${(startIndex + 1).toLocaleString('en-GB')}–${Math.min(endIndex, total).toLocaleString('en-GB')} of ${total.toLocaleString('en-GB')} ${total === 1 ? 'submission' : 'submissions'}`;
}

function renderSubmissionCard(submission) {
    // Format timestamp for display, in UTC like the rest of the site
    const timestamp = parseTrackerTime(submission.timestamp);
    const dateStr = timestamp.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC'
    });
    const timeStr = timestamp.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC'
    }) + ' UTC';
    const isoStr = isNaN(timestamp) ? '' : timestamp.toISOString();


    // Flag carries the country as its name; the country is also written out
    const country = extractCountry(submission.project_name);
    const flag = flagHtml(submission.project_flag, country, 'flag');
    const detailsId = `sub-${String(submission.id ?? '').replace(/[^\w-]/g, '')}-details`;

    return `
        <li class="submission-card" data-id="${escapeHtml(submission.id)}">
            <button type="button" class="card-header" aria-expanded="false" aria-controls="${detailsId}">
                <span class="card-main">
                    <span class="card-title">
                        <span class="project-name">${flag} ${escapeHtml(extractProjectNameOnly(submission.project_name))}</span>
                        ${country ? `<span class="card-country">${escapeHtml(country)}</span>` : ''}
                    </span>
                    <span class="card-meta">
                        <span class="merchant-name">${escapeHtml(submission.merchant_name)}</span>
                        <span class="visually-hidden">on</span>
                        <span class="tag">${escapeHtml(submission.platform)}</span>
                        <time datetime="${isoStr}">${dateStr}, ${timeStr}</time>
                    </span>
                </span>
                ${renderStatus(submission.status)}
                <span class="chev" aria-hidden="true"></span>
            </button>

            <div class="card-details" id="${detailsId}" hidden>
                ${renderCardDetails(submission)}
            </div>
        </li>
    `;
}

function renderCardDetails(submission) {
    let html = '<dl class="details">';

    // Post URL
    const postHref = safeUrl(submission.post_url);
    html += `
        <div>
            <dt>Post</dt>
            <dd>${postHref
                ? `<a href="${postHref}" target="_blank" rel="noopener">${escapeHtml(submission.post_url)}</a>`
                : escapeHtml(submission.post_url || 'No post link')}</dd>
        </div>
    `;

    // Lightning address
    if (submission.lightning_address) {
        html += `
            <div>
                <dt>Merchant Lightning address</dt>
                <dd><span class="mono">${escapeHtml(submission.lightning_address)}</span></dd>
            </div>
        `;
    }

    // Admin Notes
    if (submission.note) {
        html += `
            <div>
                <dt>Notes</dt>
                <dd>${escapeHtml(submission.note)}</dd>
            </div>
        `;
    }

    // Payment Status: who was paid, never how much
    if (submission.payments && submission.payments.length > 0) {
        html += `
            <div>
                <dt>CBAF payments</dt>
                <dd>
                    <ul class="payment-list">
                        ${submission.payments.map(payment => renderPayment(payment)).join('')}
                    </ul>
                </dd>
            </div>
        `;
    }

    html += '</dl>';

    // Telegram and BTC Map links
    const telegram = safeUrl(submission.telegram_link);
    const btcmap = safeUrl(submission.btcmap_link);
    if (telegram || btcmap) {
        html += `
            <ul class="chips">
                ${telegram ? `<li><a class="chip" href="${telegram}" target="_blank" rel="noopener">Telegram discussion</a></li>` : ''}
                ${btcmap ? `<li><a class="chip" href="${btcmap}" target="_blank" rel="noopener">Merchant on BTC Map</a></li>` : ''}
            </ul>
        `;
    }

    return html;
}

function renderPayment(payment) {
    const typeLabels = {
        'reviewer': 'Reviewer',
        'merchant': 'Merchant',
        'project': 'Project'
    };

    const typeLabel = typeLabels[payment.type] || payment.type;

    return `
        <li class="payment-item">
            <span class="payment-type">${escapeHtml(typeLabel)}</span>
            <span class="payment-recipient">${escapeHtml(payment.recipient)}</span>
        </li>
    `;
}

// ============================================================================
// Pagination
// ============================================================================

function updatePagination() {
    const totalPages = Math.max(1, Math.ceil(filteredSubmissions.length / ITEMS_PER_PAGE));

    // Update top pagination
    document.getElementById('current-page').textContent = currentPage;
    document.getElementById('total-pages').textContent = totalPages;
    document.getElementById('btn-prev-page').disabled = currentPage === 1;
    document.getElementById('btn-next-page').disabled = currentPage === totalPages;

    // Update bottom pagination
    document.getElementById('current-page-bottom').textContent = currentPage;
    document.getElementById('total-pages-bottom').textContent = totalPages;
    document.getElementById('btn-prev-page-bottom').disabled = currentPage === 1;
    document.getElementById('btn-next-page-bottom').disabled = currentPage === totalPages;

    // Page buttons only when there is more than one page; the bottom bar
    // only then too (with one page the top count says it all)
    const manyPages = totalPages > 1;
    document.getElementById('pager-top').hidden = !manyPages;
    document.getElementById('bottom-pagination').style.display = manyPages ? 'flex' : 'none';

    // Update results count on bottom
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    document.getElementById('results-count-bottom').textContent = resultsText(startIndex, endIndex);
}

function goToPage(page) {
    const totalPages = Math.ceil(filteredSubmissions.length / ITEMS_PER_PAGE);

    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    currentPage = page;
    renderSubmissions();
    updatePagination();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================================
// Event Listeners
// ============================================================================

function attachCardListeners() {
    document.querySelectorAll('.card-header').forEach(header => {
        header.addEventListener('click', () => {
            const card = header.closest('.submission-card');
            const expanded = card.classList.toggle('expanded');
            header.setAttribute('aria-expanded', String(expanded));
            document.getElementById(header.getAttribute('aria-controls')).hidden = !expanded;
        });
    });
}

function attachFilterListeners() {
    // Filter changes
    document.getElementById('filter-epoch').addEventListener('change', applyFilters);
    document.getElementById('filter-status').addEventListener('change', applyFilters);
    document.getElementById('filter-project').addEventListener('change', applyFilters);
    document.getElementById('filter-date').addEventListener('change', (e) => {
        // Show/hide custom date range
        const customRange = document.getElementById('custom-date-range');
        customRange.style.display = e.target.value === 'custom' ? 'block' : 'none';
        applyFilters();
    });
    document.getElementById('filter-search').addEventListener('input', applyFilters);

    // Custom date range
    document.getElementById('filter-date-from').addEventListener('change', applyFilters);
    document.getElementById('filter-date-to').addEventListener('change', applyFilters);

    // Top pagination
    document.getElementById('btn-prev-page').addEventListener('click', () => goToPage(currentPage - 1));
    document.getElementById('btn-next-page').addEventListener('click', () => goToPage(currentPage + 1));

    // Bottom pagination
    document.getElementById('btn-prev-page-bottom').addEventListener('click', () => goToPage(currentPage - 1));
    document.getElementById('btn-next-page-bottom').addEventListener('click', () => goToPage(currentPage + 1));
}

function showError(message) {
    const container = document.getElementById('submissions-container');
    container.innerHTML = `
        <div class="list-state" role="alert">
            <p>${message}</p>
            <p>Check your connection and reload the page to try again.</p>
        </div>
    `;
    document.getElementById('results-count').textContent = 'Submissions unavailable';
    document.getElementById('pager-top').hidden = true;
}

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    attachFilterListeners();
    loadTrackerData();
});
