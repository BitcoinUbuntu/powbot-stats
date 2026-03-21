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
const SESSION_PROJECT_KEY = 'powbot_session_project';

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
    const storedProject = sessionStorage.getItem(SESSION_PROJECT_KEY);

    if (storedSessionId && storedExpiry && storedProject) {
        // Validate project matches
        if (storedProject !== projectName) {
            clearSession();
            showError('This session is for a different project. Please sign in.');
            updateEditorUI();
            return;
        }

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

    // Fallback: ensure UI updates even if there's a timing issue
    setTimeout(updateEditorUI, 100);
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
        sessionStorage.setItem(SESSION_PROJECT_KEY, currentProject);

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
        'x_username': (member.x_profile || '').replace(/^@/, ''), // Remove @ prefix if present
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

        // Only show restoration message if user is authenticated
        if (currentSessionId && sessionExpiryTime && new Date() < sessionExpiryTime) {
            const savedAt = new Date(draft.savedAt);
            showMessage(
                `Draft restored from ${savedAt.toLocaleString()}`,
                'info',
                5000
            );
        }

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
    sessionStorage.removeItem(SESSION_PROJECT_KEY);

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
            let value = input.value.trim();

            // Remove @ prefix from X username if present (we store without @)
            if (field === 'x_username' && value && value.startsWith('@')) {
                value = value.substring(1);
            }

            formData.append(field, value);
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
    const progressContainer = document.getElementById('upload-progress-container');
    const progressBar = document.getElementById('upload-progress-bar');
    const progressPercent = document.getElementById('upload-progress-percent');
    const statusText = document.getElementById('upload-status-text');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Preparing...';

    try {
        // Show progress container
        if (progressContainer) progressContainer.classList.remove('hidden');

        // Use XMLHttpRequest for upload progress tracking
        const data = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            // Track upload progress
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    if (statusText) {
                        if (percentComplete < 100) {
                            statusText.textContent = `Submitting changes ${percentComplete}%`;
                            statusText.classList.remove('pulse');
                        } else {
                            statusText.textContent = 'Creating pull request... Please wait.';
                            statusText.classList.add('pulse');
                        }
                    }
                    if (submitBtn) {
                        if (percentComplete < 100) {
                            submitBtn.textContent = `Uploading ${percentComplete}%`;
                        } else {
                            submitBtn.textContent = 'Please wait...';
                        }
                    }
                }
            });

            // Handle completion
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const responseData = JSON.parse(xhr.responseText);
                        resolve(responseData);
                    } catch (e) {
                        reject(new Error('Invalid response from server'));
                    }
                } else {
                    try {
                        const error = JSON.parse(xhr.responseText);
                        let errorMsg = typeof error.detail === 'object'
                            ? JSON.stringify(error.detail)
                            : (error.detail || 'Failed to submit changes');

                        // Add status code info for auth errors
                        if (xhr.status === 401) {
                            errorMsg = 'Invalid or unverified session';
                        }

                        reject(new Error(errorMsg));
                    } catch (e) {
                        // If can't parse response, use status code
                        if (xhr.status === 401) {
                            reject(new Error('Unauthorized - session expired'));
                        } else {
                            reject(new Error(`Request failed with status ${xhr.status}`));
                        }
                    }
                }
            });

            // Handle errors
            xhr.addEventListener('error', () => {
                reject(new Error('Network error occurred'));
            });

            // Send request
            xhr.open('POST', `${API_BASE}/profiles/${encodeURIComponent(currentProject)}/edit`);
            xhr.send(formData);
        });

        // Success - data is already parsed

        // Success! Clear draft and session
        clearDraft();
        clearSession();
        stopAutoSave();

        // Get current project ID for back link
        const currentProjectId = new URLSearchParams(window.location.search).get('id');

        // Show success message in the progress indicator area
        if (progressBar) progressBar.style.width = '100%';
        if (progressPercent) progressPercent.textContent = '100%';

        if (statusText) {
            statusText.classList.remove('pulse');
            statusText.innerHTML = `
                <div style="color: var(--accent-green); font-weight: 600; margin-bottom: 16px;">
                    ✅ Profile changes submitted successfully for review!
                </div>
                <div style="margin-bottom: 12px;">
                    <a href="${data.pr_url}" target="_blank" style="color: white; font-weight: 600; text-decoration: underline;">
                        View Pull Request →
                    </a>
                </div>
                <div>
                    <a href="profile.html?id=${encodeURIComponent(currentProjectId)}" style="color: var(--accent-blue); text-decoration: underline;">
                        ← Back to Profile
                    </a>
                </div>
            `;
        }

        // Hide the submit button since form is done (reuse submitBtn from line 503)
        if (submitBtn) submitBtn.style.display = 'none';

    } catch (error) {
        console.error('Submit error:', error);

        // Reset button and progress ONLY on error
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;

        // Hide and reset progress indicator
        if (progressContainer) progressContainer.classList.add('hidden');
        if (statusText) {
            statusText.textContent = '';
            statusText.classList.remove('pulse');
        }

        // If it's an auth error, prompt to re-authenticate
        if (error.message.includes('Invalid or unverified session') || error.message.includes('Unauthorized')) {
            clearSession();
            updateEditorUI();
            showError('Your session has expired. Please click "Authenticate" to sign in again.');
            setTimeout(() => startOTPAuth(), 1500);
        } else {
            showError('Failed to submit: ' + error.message);
        }
    }
    // No finally block - button stays disabled on success until redirect
}

/**
 * Update editor UI based on authentication state
 */
function updateEditorUI() {
    const editSection = document.getElementById('edit-section');
    const telegramVerification = document.getElementById('telegram-verification');
    const claimBtn = document.getElementById('claim-profile-btn');

    if (!editSection) return;

    if (currentSessionId && sessionExpiryTime && new Date() < sessionExpiryTime) {
        // Authenticated - show editor, hide verification
        editSection.classList.remove('hidden');
        if (telegramVerification) telegramVerification.classList.add('hidden');
        startAutoSave();
    } else {
        // Not authenticated - show verification section, hide editor
        editSection.classList.add('hidden');

        if (telegramVerification) {
            telegramVerification.classList.remove('hidden');
            initTelegramVerification();
        }
    }
}

/**
 * Initialize Telegram username verification
 */
function initTelegramVerification() {
    if (!currentProjectData) return;

    const usernameInput = document.getElementById('telegram-username-input');
    const feedback = document.getElementById('telegram-verify-feedback');
    const claimBtn = document.getElementById('claim-profile-btn');

    const expectedUsername = currentProjectData.telegram_username;
    const supportUrl = window.SUPPORT_URL || 'https://t.me/bitcoinubuntu';

    if (!expectedUsername) {
        // No Telegram username configured for this project
        if (feedback) {
            feedback.innerHTML = `This project does not have a Telegram username configured. Please <a href="${supportUrl}" target="_blank" style="color: var(--accent-blue); text-decoration: underline;">contact support</a>.`;
            feedback.style.color = '#f85149';
        }
        if (claimBtn) {
            claimBtn.disabled = true;
        }
        if (usernameInput) {
            usernameInput.disabled = true;
        }
        return;
    }

    // Set up input verification
    if (usernameInput && claimBtn) {
        claimBtn.onclick = startOTPAuth;

        // Allow Enter key to trigger authentication
        usernameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !claimBtn.disabled) {
                startOTPAuth();
            }
        });

        usernameInput.addEventListener('input', () => {
            const inputValue = usernameInput.value.trim().toLowerCase();
            const expectedValue = expectedUsername.toLowerCase();

            if (inputValue === expectedValue) {
                // Match! Enable button
                claimBtn.disabled = false;
                if (feedback) {
                    feedback.textContent = '✓ Username verified. You can now authenticate.';
                    feedback.style.color = 'var(--accent-green)';
                }
            } else {
                // No match - disable button
                claimBtn.disabled = true;
                if (feedback) {
                    if (inputValue.length > 0) {
                        feedback.textContent = 'Username does not match. Please check and try again.';
                        feedback.style.color = '#f85149';
                    } else {
                        feedback.textContent = '';
                    }
                }
            }
        });
    }
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
        indicator.textContent = `Draft saved at ${now.toLocaleTimeString()} (autosaved every 30s)`;
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
