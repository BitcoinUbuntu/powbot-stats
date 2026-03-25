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
let allSubmissions = [];
let filteredSubmissions = [];
let currentPage = 1;

// ============================================================================
// Data Loading
// ============================================================================

async function loadTrackerData() {
    try {
        const response = await fetch('tracker-data.json');
        if (!response.ok) {
            throw new Error('Failed to load tracker data');
        }
        const data = await response.json();

        allSubmissions = data.submissions || [];

        // Update footer timestamp
        const updatedElement = document.getElementById('updated');
        if (updatedElement && data.last_updated) {
            updatedElement.textContent = new Date(data.last_updated).toLocaleString();
        }

        // Populate project dropdown
        populateProjectFilter();

        // Apply URL parameters if present
        applyURLFilters();

        // Apply initial filter and render
        applyFilters();

    } catch (error) {
        console.error('Error loading tracker data:', error);
        showError('Failed to load submission data. Please try again later.');
    }
}

// ============================================================================
// Filter Population
// ============================================================================

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
// URL Parameter Handling
// ============================================================================

function applyURLFilters() {
    const urlParams = new URLSearchParams(window.location.search);

    // Apply status filter
    const statusParam = urlParams.get('status');
    if (statusParam) {
        document.getElementById('filter-status').value = statusParam;
    }

    // Apply project filter
    const projectParam = urlParams.get('project');
    if (projectParam) {
        // Find the full project name that matches (case-insensitive)
        const projectSelect = document.getElementById('filter-project');
        for (let option of projectSelect.options) {
            if (option.value.toLowerCase().includes(projectParam.toLowerCase()) ||
                option.textContent.toLowerCase().includes(projectParam.toLowerCase())) {
                projectSelect.value = option.value;
                break;
            }
        }
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
    const statusFilter = document.getElementById('filter-status').value;
    const projectFilter = document.getElementById('filter-project').value;
    const dateFilter = document.getElementById('filter-date').value;
    const searchQuery = document.getElementById('filter-search').value.toLowerCase();

    // Update active filter styling
    updateFilterActiveStates(statusFilter, projectFilter, dateFilter, searchQuery);

    // Start with all submissions
    filteredSubmissions = allSubmissions.filter(submission => {
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

        // Search filter (project, merchant name, or notes)
        if (searchQuery) {
            const projectMatch = submission.project_name.toLowerCase().includes(searchQuery);
            const merchantMatch = submission.merchant_name.toLowerCase().includes(searchQuery);
            const noteMatch = submission.note.toLowerCase().includes(searchQuery);
            if (!projectMatch && !merchantMatch && !noteMatch) {
                return false;
            }
        }

        return true;
    });

    // Reset to page 1 when filters change
    currentPage = 1;

    // Render
    renderSubmissions();
    updatePagination();
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

function passesDateFilter(submission, dateFilter) {
    if (dateFilter === 'all') return true;

    const submissionDate = new Date(submission.timestamp);
    const now = new Date();

    // Reset time parts for accurate day comparison
    const resetTime = (date) => {
        date.setHours(0, 0, 0, 0);
        return date;
    };

    switch (dateFilter) {
        case 'today': {
            const today = resetTime(new Date());
            const subDate = resetTime(new Date(submissionDate));
            return subDate.getTime() === today.getTime();
        }

        case '7days': {
            const sevenDaysAgo = new Date(now);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            return submissionDate >= sevenDaysAgo;
        }

        case '30days': {
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return submissionDate >= thirtyDaysAgo;
        }

        case 'custom': {
            const fromDate = document.getElementById('filter-date-from').value;
            const toDate = document.getElementById('filter-date-to').value;

            if (!fromDate && !toDate) return true;

            if (fromDate) {
                const from = new Date(fromDate);
                if (submissionDate < from) return false;
            }

            if (toDate) {
                const to = new Date(toDate);
                to.setHours(23, 59, 59, 999); // End of day
                if (submissionDate > to) return false;
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
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <p>No submissions found matching your filters.</p>
                <p style="margin-top: 8px; font-size: 0.9rem;">Try adjusting your search criteria.</p>
            </div>
        `;
        resultsCount.textContent = 'No submissions found';
        return;
    }

    resultsCount.textContent = `Showing ${startIndex + 1}-${Math.min(endIndex, filteredSubmissions.length)} of ${filteredSubmissions.length} submissions`;

    // Render submission cards
    const submissionsHTML = pageSubmissions.map(submission => renderSubmissionCard(submission)).join('');

    container.innerHTML = `<div class="submissions-list">${submissionsHTML}</div>`;

    // Attach event listeners
    attachCardListeners();
}

function renderSubmissionCard(submission) {
    const statusClass = `status-${submission.status.toLowerCase().replace(' ', '-')}`;

    // Format timestamp for display
    const timestamp = new Date(submission.timestamp);
    const dateStr = timestamp.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    const timeStr = timestamp.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });

    // Merchant tip status indicator
    const tipStatus = submission.merchant_tip_status === '✅' ? '✓' : '✗';
    const tipColor = submission.merchant_tip_status === '✅' ? 'var(--accent-green)' : 'var(--accent-red)';

    return `
        <div class="submission-card" data-id="${submission.id}">
            <div class="card-header">
                <div class="card-summary">
                    <div class="card-summary-row">
                        <span class="project-name">${submission.project_flag} ${extractProjectNameOnly(submission.project_name)}</span>
                        <span class="status-badge ${statusClass}">${submission.status}</span>
                    </div>
                    <div class="merchant-platform">${submission.merchant_name} on ${submission.platform}</div>
                    <div class="timestamp">${dateStr} at ${timeStr}</div>
                </div>
                <div class="expand-icon">▼</div>
            </div>

            <div class="card-details">
                ${renderCardDetails(submission, tipStatus, tipColor)}
            </div>
        </div>
    `;
}

function renderCardDetails(submission, tipStatus, tipColor) {
    let html = '';

    // Post URL
    html += `
        <div class="detail-section">
            <div class="detail-label">Post URL</div>
            <div class="detail-value">
                <a href="${submission.post_url}" target="_blank" rel="noopener">${submission.post_url}</a>
            </div>
        </div>
    `;

    // Telegram Link
    if (submission.telegram_link) {
        html += `
            <div class="detail-section">
                <div class="detail-label">Telegram Discussion</div>
                <div class="detail-value">
                    <a href="${submission.telegram_link}" target="_blank" rel="noopener">View Discussion →</a>
                </div>
            </div>
        `;
    }

    // BTC Map Link
    if (submission.btcmap_link) {
        html += `
            <div class="detail-section">
                <div class="detail-label">BTC Map</div>
                <div class="detail-value">
                    <a href="${submission.btcmap_link}" target="_blank" rel="noopener">View on BTC Map →</a>
                </div>
            </div>
        `;
    }

    // Lightning Address & Tip Status
    if (submission.lightning_address) {
        html += `
            <div class="detail-section">
                <div class="detail-label">Merchant Lightning Address</div>
                <div class="detail-value">
                    <span>${submission.lightning_address}</span>
                    <span style="margin-left: 8px; color: ${tipColor}; font-weight: 600; font-size: 1.1rem;">
                        ${tipStatus}
                    </span>
                </div>
            </div>
        `;
    }

    // Admin Notes
    if (submission.note) {
        html += `
            <div class="detail-section">
                <div class="detail-label">Notes</div>
                <div class="detail-value">${submission.note}</div>
            </div>
        `;
    }

    // Payment Status
    if (submission.payments && submission.payments.length > 0) {
        html += `
            <div class="detail-section">
                <div class="detail-label">CBAF Payments</div>
                <div class="payment-list">
                    ${submission.payments.map(payment => renderPayment(payment)).join('')}
                </div>
            </div>
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
        <div class="payment-item">
            <span class="payment-icon">⚡</span>
            <span class="payment-type">${typeLabel}:</span>
            <span class="payment-recipient">${payment.recipient}</span>
        </div>
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

    // Show bottom pagination
    document.getElementById('bottom-pagination').style.display = 'flex';

    // Update results count on bottom
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    document.getElementById('results-count-bottom').textContent =
        `Showing ${startIndex + 1}-${Math.min(endIndex, filteredSubmissions.length)} of ${filteredSubmissions.length} submissions`;
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
            card.classList.toggle('expanded');
        });
    });
}

function attachFilterListeners() {
    // Filter changes
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
        <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <p>${message}</p>
        </div>
    `;
}

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    attachFilterListeners();
    loadTrackerData();
});
