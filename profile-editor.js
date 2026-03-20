/**
 * PoWBoT Profile Editor with Auto-Save
 *
 * Features:
 * - Auto-save to localStorage every 30 seconds
 * - Draft restoration on page load
 * - Session expiry warnings
 * - OTP authentication via Telegram
 */

const API_BASE = 'https://api.powbot.africa';
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds
const SESSION_WARNING_TIME = 5 * 60 * 1000; // 5 minutes before expiry

// State
let currentProject = null;
let currentProjectData = null;
let currentSessionId = null;
let sessionExpiryTime = null;
let autoSaveTimer = null;
let expiryCheckTimer = null;

// LocalStorage keys
const DRAFT_KEY_PREFIX = 'powbot_profile_draft_';
const SESSION_KEY = 'powbot_session_id';
const SESSION_EXPIRY_KEY = 'powbot_session_expiry';

/**
 * Initialize profile editor for a project
 */
function initProfileEditor(projectName, projectData) {
    currentProject = projectName;
    currentProjectData = projectData;

    // Populate form with existing member data
    populateFormWithMemberData(projectData);

    // Check for existing session
    const storedSessionId = sessionStorage.getItem(SESSION_KEY);
    const storedExpiry = sessionStorage.getItem(SESSION_EXPIRY_KEY);

    if (storedSessionId && storedExpiry) {
        const expiryTime = new Date(storedExpiry);
        if (expiryTime > new Date()) {
            // Session still valid
            currentSessionId = storedSessionId;
            sessionExpiryTime = expiryTime;
            startExpiryMonitoring();
        } else {
            // Session expired, clear it
            clearSession();
        }
    }

    // Restore draft if exists (overwrites existing data)
    restoreDraft();

    // Update UI based on session state
    updateEditorUI();
}

/**
 * Start OTP authentication flow
 */
async function startOTPAuth() {
    if (!currentProject) {
        showError('No project selected');
        return;
    }

    try {
        showMessage('Sending OTP to your Telegram...', 'info');

        const response = await fetch(`${API_BASE}/auth/otp/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_name: currentProject })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to send OTP');
        }

        const data = await response.json();
        currentSessionId = data.session_id;

        // Show OTP input modal
        showOTPModal();

    } catch (error) {
        console.error('OTP init error:', error);
        showError('Failed to send OTP: ' + error.message);
    }
}

/**
 * Verify OTP code
 */
async function verifyOTP(otpCode) {
    if (!currentSessionId) {
        showError('No session found');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/otp/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: currentSessionId,
                otp_code: otpCode
            })
        });

        const data = await response.json();

        if (!response.ok || !data.verified) {
            showError(data.message || 'Verification failed');
            return false;
        }

        // Success! Store session
        sessionExpiryTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
        sessionStorage.setItem(SESSION_KEY, currentSessionId);
        sessionStorage.setItem(SESSION_EXPIRY_KEY, sessionExpiryTime.toISOString());

        showMessage('Authenticated successfully!', 'success');
        hideOTPModal();

        // Check if profile needs claiming
        await checkAndClaimProfile();

        // Start monitoring session expiry
        startExpiryMonitoring();

        // Update UI
        updateEditorUI();

        // Start auto-save
        startAutoSave();

        return true;

    } catch (error) {
        console.error('OTP verify error:', error);
        showError('Verification failed: ' + error.message);
        return false;
    }
}

/**
 * Check if profile is claimed, claim if not
 */
async function checkAndClaimProfile() {
    try {
        const statusResponse = await fetch(
            `${API_BASE}/profiles/${encodeURIComponent(currentProject)}/status`
        );
        const status = await statusResponse.json();

        if (!status.claimed) {
            // Claim the profile
            const claimResponse = await fetch(
                `${API_BASE}/profiles/${encodeURIComponent(currentProject)}/claim`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: currentSessionId })
                }
            );

            if (!claimResponse.ok) {
                const error = await claimResponse.json();
                console.error('Claim failed:', error);
            }
        }
    } catch (error) {
        console.error('Profile claim check error:', error);
    }
}

/**
 * Auto-save draft to localStorage
 */
function saveDraft() {
    if (!currentProject) return;

    const form = document.getElementById('profile-edit-form');
    if (!form) return;

    const formData = new FormData(form);
    const draft = {};

    for (const [key, value] of formData.entries()) {
        // Only save string values (skip File objects from file inputs)
        if (typeof value === 'string' && value.trim()) {
            draft[key] = value.trim();
        }
    }

    // Only save if there's actual content
    if (Object.keys(draft).length > 0) {
        const draftKey = DRAFT_KEY_PREFIX + currentProject;
        localStorage.setItem(draftKey, JSON.stringify({
            data: draft,
            savedAt: new Date().toISOString()
        }));

        // Show save indicator
        showSaveIndicator();
    }
}

/**
 * Populate form fields with existing member data
 */
function populateFormWithMemberData(member) {
    if (!member) return;

    const form = document.getElementById('profile-edit-form');
    if (!form) return;

    // Map member data fields to form field names
    const fieldMap = {
        'tagline': member.tagline || '',
        'description': member.description || '',
        'city': member.city || '',
        'country': member.country || '',
        'vision': member.vision || '',
        'mission': member.mission || '',
        'how_started': member.how_started || '',
        'website': member.website || '',
        'email': member.email || '',
        'x_profile': (member.x_profile || '').replace(/^@/, ''), // Remove @ prefix if present
        'npub': member.npub || '',
        'btcmap_url': member.btcmap_url || '',
        'lightning_address': member.lightning_address || '',
        'onchain_address': member.onchain_address || '',
        'btcpay_campaign': member.btcpay_campaign || '',
        'geyser_campaign': member.geyser_campaign || ''
    };

    // Populate each field
    for (const [fieldName, value] of Object.entries(fieldMap)) {
        const field = form.querySelector(`[name="${fieldName}"]`);
        if (field && value) {
            field.value = value;
            // Trigger input event to update character counters
            field.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
}

/**
 * Restore draft from localStorage
 */
function restoreDraft() {
    if (!currentProject) return;

    const draftKey = DRAFT_KEY_PREFIX + currentProject;
    const draftJson = localStorage.getItem(draftKey);

    if (!draftJson) return;

    try {
        const draft = JSON.parse(draftJson);
        const form = document.getElementById('profile-edit-form');

        if (!form) return;

        // Populate form fields
        for (const [key, value] of Object.entries(draft.data)) {
            const field = form.querySelector(`[name="${key}"]`);
            if (field) {
                field.value = value;
            }
        }

        // Show restoration message
        const savedAt = new Date(draft.savedAt);
        showMessage(
            `Draft restored from ${savedAt.toLocaleString()}`,
            'info',
            5000
        );

    } catch (error) {
        console.error('Failed to restore draft:', error);
    }
}

/**
 * Clear draft after successful submission
 */
function clearDraft() {
    if (!currentProject) return;

    const draftKey = DRAFT_KEY_PREFIX + currentProject;
    localStorage.removeItem(draftKey);
}

/**
 * Start auto-save timer
 */
function startAutoSave() {
    // Clear existing timer
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
    }

    // Save immediately
    saveDraft();

    // Then save every 30 seconds
    autoSaveTimer = setInterval(() => {
        saveDraft();
    }, AUTO_SAVE_INTERVAL);
}

/**
 * Stop auto-save
 */
function stopAutoSave() {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
        autoSaveTimer = null;
    }
}

/**
 * Start monitoring session expiry
 */
function startExpiryMonitoring() {
    // Clear existing timer
    if (expiryCheckTimer) {
        clearInterval(expiryCheckTimer);
    }

    // Check every minute
    expiryCheckTimer = setInterval(() => {
        if (!sessionExpiryTime) return;

        const now = new Date();
        const timeRemaining = sessionExpiryTime - now;

        if (timeRemaining <= 0) {
            // Session expired
            handleSessionExpiry();
        } else if (timeRemaining <= SESSION_WARNING_TIME) {
            // Show warning
            showExpiryWarning(Math.floor(timeRemaining / 60000)); // minutes
        }
    }, 60000); // Check every minute
}

/**
 * Handle session expiry
 */
function handleSessionExpiry() {
    clearSession();
    stopAutoSave();

    showMessage(
        'Your session has expired. Your work has been saved. Please re-authenticate to continue.',
        'warning',
        0 // Don't auto-hide
    );

    updateEditorUI();
}

/**
 * Show session expiry warning
 */
function showExpiryWarning(minutesRemaining) {
    const warningDiv = document.getElementById('session-warning');
    if (warningDiv) {
        warningDiv.innerHTML = `
            ⚠️ Session expires in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}
            <button onclick="startOTPAuth()" class="btn-small">Get New OTP</button>
        `;
        warningDiv.classList.remove('hidden');
    }
}

/**
 * Clear session data
 */
function clearSession() {
    currentSessionId = null;
    sessionExpiryTime = null;
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_EXPIRY_KEY);

    if (expiryCheckTimer) {
        clearInterval(expiryCheckTimer);
        expiryCheckTimer = null;
    }
}

/**
 * Submit profile edits
 */
async function submitProfileEdits(event) {
    event.preventDefault();

    if (!currentSessionId) {
        showError('Not authenticated. Please sign in first.');
        startOTPAuth();
        return;
    }

    // Check session not expired
    if (sessionExpiryTime && new Date() > sessionExpiryTime) {
        showError('Session expired. Please re-authenticate.');
        handleSessionExpiry();
        return;
    }

    const form = document.getElementById('profile-edit-form');
    const formData = new FormData();

    // Add session_id
    formData.append('session_id', currentSessionId);

    // Add all text fields from form (excluding file inputs)
    const textFields = [
        'tagline', 'description', 'vision', 'mission', 'how_started', 'milestones',
        'contact_person', 'email', 'website', 'x_username', 'npub',
        'lightning_address', 'btcmap_url', 'btcpay_campaign', 'geyser_campaign', 'onchain_address',
        'city', 'country'
    ];

    let hasChanges = false;
    textFields.forEach(field => {
        const input = form.querySelector(`[name="${field}"]`);
        if (input && input.value && input.value.trim()) {
            formData.append(field, input.value.trim());
            hasChanges = true;
        }
    });

    // Add logo file if selected
    const logoInput = document.getElementById('edit-logo');
    if (logoInput && logoInput.files && logoInput.files.length > 0) {
        formData.append('logo', logoInput.files[0]);
        hasChanges = true;
    }

    // Add gallery files from newGalleryFiles array (if it exists in the page context)
    if (typeof newGalleryFiles !== 'undefined' && newGalleryFiles.length > 0) {
        newGalleryFiles.forEach(file => {
            formData.append('gallery', file);
        });
        hasChanges = true;
    }

    // Add list of gallery images to keep (from hidden field)
    const keepGalleryInput = document.getElementById('keep-gallery-images');
    if (keepGalleryInput && keepGalleryInput.value) {
        formData.append('keep_gallery_images', keepGalleryInput.value);
    }

    // Validate gallery count (kept + new must be <= 12)
    if (typeof galleryToKeep !== 'undefined' && typeof newGalleryFiles !== 'undefined') {
        const totalGalleryCount = galleryToKeep.length + newGalleryFiles.length;
        if (totalGalleryCount > 12) {
            showError(`Too many gallery images. You have ${totalGalleryCount} total (max 12). Please delete ${totalGalleryCount - 12} more images.`);
            return;
        }
    }

    if (!hasChanges) {
        showError('No changes to submit');
        return;
    }

    const submitBtn = document.getElementById('submit-edits-btn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
        const response = await fetch(
            `${API_BASE}/profiles/${encodeURIComponent(currentProject)}/edit`,
            {
                method: 'POST',
                // Don't set Content-Type - browser will set it with boundary for multipart/form-data
                body: formData
            }
        );

        if (!response.ok) {
            const error = await response.json();
            const errorMsg = typeof error.detail === 'object'
                ? JSON.stringify(error.detail)
                : (error.detail || 'Failed to submit changes');
            throw new Error(errorMsg);
        }

        const data = await response.json();

        // Success! Clear draft and session
        clearDraft();
        clearSession();
        stopAutoSave();

        // Show success
        showMessage(
            `Changes submitted successfully! <a href="${data.pr_url}" target="_blank">View Pull Request</a>`,
            'success',
            3000
        );

        // Redirect back to profile page after brief delay
        setTimeout(() => {
            const currentProjectId = new URLSearchParams(window.location.search).get('id');
            if (currentProjectId) {
                window.location.href = 'profile.html?id=' + encodeURIComponent(currentProjectId);
            }
        }, 3000);

    } catch (error) {
        console.error('Submit error:', error);
        showError('Failed to submit: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

/**
 * Update editor UI based on authentication state
 */
function updateEditorUI() {
    const editSection = document.getElementById('edit-section');
    const claimBtn = document.getElementById('claim-profile-btn');

    if (!editSection || !claimBtn) return;

    if (currentSessionId && sessionExpiryTime && new Date() < sessionExpiryTime) {
        // Authenticated - show editor
        claimBtn.textContent = 'Edit Profile';
        claimBtn.onclick = () => {
            editSection.classList.remove('hidden');
            editSection.scrollIntoView({ behavior: 'smooth' });
            startAutoSave();
        };
        editSection.classList.remove('hidden');
    } else {
        // Not authenticated - show auth button
        claimBtn.textContent = 'Claim/Edit Profile';
        claimBtn.onclick = startOTPAuth;
        editSection.classList.add('hidden');
    }

    claimBtn.classList.remove('hidden');
}

/**
 * Show OTP input modal
 */
function showOTPModal() {
    const modal = document.getElementById('otp-modal');
    if (modal) {
        modal.classList.remove('hidden');
        // Focus on OTP input
        const otpInput = document.getElementById('otp-input');
        if (otpInput) {
            otpInput.value = '';
            otpInput.focus();
        }
    }
}

/**
 * Hide OTP modal
 */
function hideOTPModal() {
    const modal = document.getElementById('otp-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Handle OTP form submission
 */
function handleOTPSubmit(event) {
    event.preventDefault();
    const otpInput = document.getElementById('otp-input');
    if (otpInput && otpInput.value) {
        verifyOTP(otpInput.value.trim());
    }
}

/**
 * Show save indicator
 */
function showSaveIndicator() {
    const indicator = document.getElementById('save-indicator');
    if (indicator) {
        const now = new Date();
        indicator.textContent = `Draft saved at ${now.toLocaleTimeString()}`;
        indicator.classList.remove('hidden');
    }
}

/**
 * Show message to user
 */
function showMessage(message, type = 'info', duration = 5000) {
    const messageDiv = document.getElementById('editor-message');
    if (!messageDiv) return;

    messageDiv.innerHTML = message;
    messageDiv.className = `message message-${type}`;
    messageDiv.classList.remove('hidden');

    if (duration > 0) {
        setTimeout(() => {
            messageDiv.classList.add('hidden');
        }, duration);
    }
}

/**
 * Show error message
 */
function showError(message) {
    showMessage(message, 'error', 8000);
}

/**
 * Clean up on page unload
 */
window.addEventListener('beforeunload', () => {
    if (currentSessionId) {
        saveDraft(); // Final save before leaving
    }
    stopAutoSave();
});
