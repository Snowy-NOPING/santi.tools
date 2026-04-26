// santi.tools — cobalt API frontend
const { invoke } = window.__TAURI__.core;

// ===== Auth System =====
const authScreen = document.getElementById('auth-screen');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');
const authSubtitle = document.getElementById('auth-subtitle');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');
const userAvatar = document.getElementById('user-avatar');
const userDisplayName = document.getElementById('user-display-name');
const btnLogout = document.getElementById('btn-logout');
const regPasswordInput = document.getElementById('reg-password');
const strengthBar = document.getElementById('strength-bar');

// SHA-256 hash function (Web Crypto API)
async function hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate a random salt
function generateSalt() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Get stored accounts
function getAccounts() {
    try { return JSON.parse(localStorage.getItem('santi-tools-accounts') || '{}'); }
    catch { return {}; }
}

// Save accounts
function saveAccounts(accounts) {
    localStorage.setItem('santi-tools-accounts', JSON.stringify(accounts));
}

// Get current session
function getCurrentSession() {
    return localStorage.getItem('santi-tools-session');
}

// Set session
function setSession(username) {
    localStorage.setItem('santi-tools-session', username);
}

// Clear session
function clearSession() {
    localStorage.removeItem('santi-tools-session');
}

// Show auth error
function showAuthError(element, message) {
    element.textContent = message;
    element.classList.remove('hidden');
    // Re-trigger shake animation
    element.style.animation = 'none';
    element.offsetHeight; // reflow
    element.style.animation = '';
}

function hideAuthError(element) {
    element.classList.add('hidden');
}

// Password strength calculator
function getPasswordStrength(password) {
    let score = 0;
    if (password.length >= 4) score++;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return Math.min(score, 4); // 0-4
}

function updatePasswordStrength(password) {
    const strength = getPasswordStrength(password);
    const colors = ['#e74c3c', '#f0b232', '#f0b232', '#7dcea0', '#7dcea0'];
    const widths = ['0%', '25%', '50%', '75%', '100%'];
    strengthBar.style.width = widths[strength];
    strengthBar.style.background = colors[strength];
}

// Switch between login/register forms
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    authSubtitle.textContent = 'create your account';
    hideAuthError(loginError);
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    authSubtitle.textContent = 'welcome back';
    hideAuthError(registerError);
});

// Password strength meter
regPasswordInput.addEventListener('input', () => {
    updatePasswordStrength(regPasswordInput.value);
});

// Register handler
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value.trim().toLowerCase();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;

    if (username.length < 3) { showAuthError(registerError, 'username must be at least 3 characters'); return; }
    if (password.length < 4) { showAuthError(registerError, 'password must be at least 4 characters'); return; }
    if (password !== confirm) { showAuthError(registerError, 'passwords do not match'); return; }

    const accounts = getAccounts();
    if (accounts[username]) { showAuthError(registerError, 'username already taken'); return; }

    const salt = generateSalt();
    const hash = await hashPassword(password, salt);
    accounts[username] = { salt, hash, createdAt: Date.now() };
    saveAccounts(accounts);

    // Auto-login after register
    setSession(username);
    enterApp(username);
});

// Login handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;

    const accounts = getAccounts();
    const account = accounts[username];
    if (!account) { showAuthError(loginError, 'account not found'); return; }

    const hash = await hashPassword(password, account.salt);
    if (hash !== account.hash) { showAuthError(loginError, 'incorrect password'); return; }

    setSession(username);
    enterApp(username);
});

// Logout handler
btnLogout.addEventListener('click', () => {
    clearSession();
    exitApp();
});

// Enter the app
function enterApp(username) {
    authScreen.classList.add('hidden');
    setTimeout(() => { authScreen.style.display = 'none'; }, 500);

    const savedAvatar = getUserAvatar(username);
    if (savedAvatar) {
        userAvatar.innerHTML = `<img src="${savedAvatar}" alt="avatar" />`;
    } else {
        userAvatar.textContent = username.charAt(0).toUpperCase();
    }
    const accounts = getAccounts();
    const displayName = accounts[username]?.displayName || username;
    userDisplayName.textContent = displayName;
}

// Exit the app (show auth)
function exitApp() {
    authScreen.style.display = '';
    // Small delay to allow display change before transition
    requestAnimationFrame(() => {
        authScreen.classList.remove('hidden');
    });
    // Clear form fields
    loginForm.reset();
    registerForm.reset();
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    authSubtitle.textContent = 'welcome back';
    hideAuthError(loginError);
    hideAuthError(registerError);
    strengthBar.style.width = '0%';
}

// Check session on load
function initAuth() {
    const session = getCurrentSession();
    if (session) {
        const accounts = getAccounts();
        if (accounts[session]) {
            enterApp(session);
            return;
        }
        // Invalid session, clear it
        clearSession();
    }
    // Show auth screen (it's already visible by default)
}

initAuth();

// ===== Google OAuth =====
// Uses Google's OAuth2 implicit flow — opens the system browser, user signs in,
// Google redirects to our custom URI scheme which Tauri intercepts.
// You must register your OAuth client at console.cloud.google.com and set
// the redirect URI to: https://santi.tools/auth/callback (or your registered URI).
// Replace GOOGLE_CLIENT_ID below with your actual client ID.
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';
const GOOGLE_REDIRECT_URI = 'https://santi.tools/auth/callback';

async function startGoogleOAuth() {
    const state = generateSalt(); // random state for CSRF protection
    sessionStorage.setItem('oauth-state', state);

    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_REDIRECT_URI,
        response_type: 'token',
        scope: 'openid email profile',
        state,
        prompt: 'select_account',
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

    try {
        const { open } = window.__TAURI__.opener || await import('@tauri-apps/plugin-opener');
        await open(authUrl);
        // Show a waiting message — the user will complete auth in their browser
        showGoogleWaiting();
    } catch (err) {
        console.error('Failed to open Google OAuth:', err);
    }
}

function showGoogleWaiting() {
    // Replace auth container content temporarily with a waiting state
    const subtitle = document.getElementById('auth-subtitle');
    subtitle.textContent = 'complete sign-in in your browser...';
}

// Listen for the OAuth callback via deep link (tauri://deep-link)
// This requires registering a deep link scheme in tauri.conf.json
// and handling it in the Rust side, OR using a local HTTP server.
// For simplicity, we also support manual token paste via a prompt.
// The deep link handler below will fire if the scheme is configured.
window.__TAURI__?.event?.listen('deep-link://new-url', async (event) => {
    const url = Array.isArray(event.payload) ? event.payload[0] : event.payload;
    handleOAuthCallback(url);
});

async function handleOAuthCallback(urlStr) {
    try {
        // The token is in the fragment: #access_token=...&state=...
        const hash = urlStr.includes('#') ? urlStr.split('#')[1] : urlStr.split('?')[1] || '';
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const returnedState = params.get('state');
        const savedState = sessionStorage.getItem('oauth-state');

        if (!accessToken) return;
        if (savedState && returnedState !== savedState) {
            console.warn('OAuth state mismatch');
            return;
        }
        sessionStorage.removeItem('oauth-state');

        // Fetch user info from Google
        const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const info = await resp.json();

        const googleId = `google_${info.sub}`;
        const displayName = info.name || info.email?.split('@')[0] || googleId;
        const picture = info.picture || null;

        // Store/update account
        const accounts = getAccounts();
        if (!accounts[googleId]) {
            accounts[googleId] = { provider: 'google', displayName, createdAt: Date.now() };
            saveAccounts(accounts);
        }

        // Save Google profile picture as avatar if not already set
        if (picture && !getUserAvatar(googleId)) {
            // Fetch and store as base64
            try {
                const imgResp = await fetch(picture);
                const blob = await imgResp.blob();
                const reader = new FileReader();
                reader.onload = () => {
                    saveUserAvatar(googleId, reader.result);
                };
                reader.readAsDataURL(blob);
            } catch (_) {}
        }

        setSession(googleId);
        enterApp(googleId);
    } catch (err) {
        console.error('OAuth callback error:', err);
    }
}

document.getElementById('btn-google-login').addEventListener('click', startGoogleOAuth);
document.getElementById('btn-google-register').addEventListener('click', startGoogleOAuth);

// ===== Avatar Helpers =====
function getUserAvatar(username) {
    return localStorage.getItem(`santi-tools-avatar-${username}`) || null;
}

function saveUserAvatar(username, dataUrl) {
    localStorage.setItem(`santi-tools-avatar-${username}`, dataUrl);
}

// ===== Storage Tracking =====
const STORAGE_KEY_USER = (u) => `santi-tools-storage-${u}`;
const STORAGE_KEY_GLOBAL = 'santi-tools-storage-global';

function getUserStorage(username) {
    return parseInt(localStorage.getItem(STORAGE_KEY_USER(username)) || '0', 10);
}

function getGlobalStorage() {
    return parseInt(localStorage.getItem(STORAGE_KEY_GLOBAL) || '0', 10);
}

function addStorageUsed(username, bytes) {
    if (!username || bytes <= 0) return;
    const userTotal = getUserStorage(username) + bytes;
    const globalTotal = getGlobalStorage() + bytes;
    localStorage.setItem(STORAGE_KEY_USER(username), String(userTotal));
    localStorage.setItem(STORAGE_KEY_GLOBAL, String(globalTotal));
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[Math.min(i, units.length - 1)]}`;
}

// ===== Profile Panel =====
const profileOverlay = document.getElementById('profile-overlay');
const profileOverlayClose = document.getElementById('profile-overlay-close');

userAvatar.addEventListener('click', () => {
    const session = getCurrentSession();
    if (!session) return;
    openProfilePanel(session);
});

function openProfilePanel(username) {
    const accounts = getAccounts();
    const account = accounts[username] || {};
    const displayName = account.displayName || username;
    const avatar = getUserAvatar(username);
    const userBytes = getUserStorage(username);
    const globalBytes = getGlobalStorage();
    const isGoogle = account.provider === 'google';

    const avatarHtml = avatar
        ? `<img src="${avatar}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
        : `<span style="font-size:28px;font-weight:700;color:#0a0a0a;">${username.charAt(0).toUpperCase()}</span>`;

    document.getElementById('profile-avatar-preview').innerHTML = avatarHtml;
    document.getElementById('profile-username').textContent = displayName;
    document.getElementById('profile-username-display').textContent = username;
    document.getElementById('profile-display-name-input').value = displayName;
    document.getElementById('profile-provider').textContent = isGoogle ? 'google account' : 'local account';
    document.getElementById('profile-provider-info').textContent = isGoogle ? 'google account' : 'local account';
    document.getElementById('profile-joined').textContent = account.createdAt
        ? new Date(account.createdAt).toLocaleDateString()
        : 'unknown';
    document.getElementById('profile-storage-user').textContent = formatBytes(userBytes);
    document.getElementById('profile-storage-global').textContent = formatBytes(globalBytes);
    // Reset to first tab
    document.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.profile-tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('.profile-tab-btn[data-tab="info"]')?.classList.add('active');
    document.getElementById('profile-tab-info')?.classList.add('active');

    profileOverlay.classList.remove('hidden');
}

profileOverlayClose?.addEventListener('click', () => profileOverlay.classList.add('hidden'));
profileOverlay?.addEventListener('click', (e) => { if (e.target === profileOverlay) profileOverlay.classList.add('hidden'); });

// Profile tab switching
document.querySelectorAll('.profile-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.profile-tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`profile-tab-${btn.dataset.tab}`)?.classList.add('active');
    });
});

// Save display name
document.getElementById('profile-save-name')?.addEventListener('click', () => {
    const username = getCurrentSession();
    if (!username) return;
    const newName = document.getElementById('profile-display-name-input').value.trim();
    if (!newName) return;
    const accounts = getAccounts();
    if (accounts[username]) {
        accounts[username].displayName = newName;
        saveAccounts(accounts);
        userDisplayName.textContent = newName;
        document.getElementById('profile-save-feedback').textContent = 'saved!';
        setTimeout(() => { document.getElementById('profile-save-feedback').textContent = ''; }, 2000);
    }
});

// Avatar upload via profile panel
const avatarFileInput = document.getElementById('avatar-file-input');

document.getElementById('profile-avatar-upload-btn')?.addEventListener('click', () => avatarFileInput.click());

avatarFileInput.addEventListener('change', () => {
    const file = avatarFileInput.files[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
        alert('only PNG and JPG files are supported');
        avatarFileInput.value = '';
        return;
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        alert('image must be under 5MB');
        avatarFileInput.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;
        const username = getCurrentSession();
        if (!username) return;
        saveUserAvatar(username, dataUrl);
        // Update sidebar avatar
        userAvatar.innerHTML = `<img src="${dataUrl}" alt="avatar" />`;
        // Update profile panel preview
        document.getElementById('profile-avatar-preview').innerHTML =
            `<img src="${dataUrl}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    };
    reader.readAsDataURL(file);
    avatarFileInput.value = '';
});

// ===== DOM Elements =====
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('btn-sidebar-toggle');
const btnSave = document.getElementById('btn-save');
const btnRemix = document.getElementById('btn-remix');
const btnSettings = document.getElementById('btn-settings');
const btnDonate = document.getElementById('btn-donate');
const btnUpdates = document.getElementById('btn-updates');
const btnAbout = document.getElementById('btn-about');
const btnHistory = document.getElementById('btn-history');
const btnCompress = document.getElementById('btn-compress');
const btnNotes = document.getElementById('btn-notes');
const btnImghost = document.getElementById('btn-imghost');

const viewSave = document.getElementById('view-save');
const viewRemix = document.getElementById('view-remix');
const viewSettings = document.getElementById('view-settings');
const viewUpdates = document.getElementById('view-updates');
const viewAbout = document.getElementById('view-about');
const viewHistory = document.getElementById('view-history');
const viewCompress = document.getElementById('view-compress');
const viewNotes = document.getElementById('view-notes');
const viewImghost = document.getElementById('view-imghost');

const urlInput = document.getElementById('url-input');
const btnPaste = document.getElementById('btn-paste');
const modeButtons = document.querySelectorAll('.mode-btn');

const statusArea = document.getElementById('status-area');
const statusMessage = document.getElementById('status-message');
const pickerArea = document.getElementById('picker-area');

const topbarCenter = document.querySelector('.topbar-center');
const overlay = document.getElementById('overlay');
const overlayBody = document.getElementById('overlay-body');
const overlayClose = document.getElementById('overlay-close');

const btnQueue = document.getElementById('btn-queue');
const queueDropdown = document.getElementById('queue-dropdown');
const queueBody = document.getElementById('queue-body');

const settingApiUrl = document.getElementById('setting-api-url');

// ===== State =====
let currentMode = 'auto';
let currentResult = null;
let isProcessing = false;
let queueItems = [];

// ===== Sidebar Toggle =====
sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('expanded'));

// ===== View Switching =====
const allNavButtons = [btnSave, btnRemix, btnSettings, btnUpdates, btnAbout, btnHistory, btnCompress, btnNotes, btnImghost];
const views = { save: viewSave, remix: viewRemix, settings: viewSettings, updates: viewUpdates, about: viewAbout, history: viewHistory, compress: viewCompress, notes: viewNotes, imghost: viewImghost };

function switchView(viewName, activeBtn) {
    allNavButtons.forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');
    Object.values(views).forEach(v => v.classList.remove('active'));
    if (views[viewName]) views[viewName].classList.add('active');
    if (viewName === 'updates') loadUpdates();
    if (viewName === 'history') renderHistory();
    if (viewName === 'notes') renderNotesList();
    if (viewName === 'imghost') imghostInit();
}

btnSave.addEventListener('click', () => switchView('save', btnSave));
btnRemix.addEventListener('click', () => switchView('remix', btnRemix));
btnSettings.addEventListener('click', () => switchView('settings', btnSettings));
btnUpdates.addEventListener('click', () => switchView('updates', btnUpdates));
btnAbout.addEventListener('click', () => switchView('about', btnAbout));
btnHistory.addEventListener('click', () => switchView('history', btnHistory));
btnCompress.addEventListener('click', () => switchView('compress', btnCompress));
btnNotes.addEventListener('click', () => switchView('notes', btnNotes));
btnImghost.addEventListener('click', () => switchView('imghost', btnImghost));

// ===== Mode Buttons =====
modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.mode;
    });
});

// ===== Paste Button =====
btnPaste.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        if (text) { urlInput.value = text; urlInput.focus(); handleSubmit(); }
    } catch (err) { showStatus('failed to read clipboard', 'error'); }
});

// ===== URL Input Enter Key =====
urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } });

// ===== Handle Submit =====
async function handleSubmit() {
    const url = urlInput.value.trim();
    if (!url) { showStatus('please paste a link first', 'error'); return; }
    if (isProcessing) return;
    isProcessing = true;

    hidePickerArea();
    queueDropdown.classList.remove('hidden'); // Auto-open queue
    showStatus('<span class="spinner"></span> processing...', 'loading');

    const apiUrl = settingApiUrl.value.trim() || 'https://api.cobalt.tools';
    const useApiKey = document.getElementById('setting-use-api-key')?.checked;
    const apiKey = document.getElementById('setting-api-key')?.value.trim();
    const apiToken = (useApiKey && apiKey) ? apiKey : null;
    
    const videoQuality = getSegValue('videoQuality') || '1080';
    const audioFormat = getSegValue('audioFormat') || 'mp3';
    const audioBitrate = getSegValue('audioBitrate') || '128';
    const filenameStyle = getSegValue('filenameStyle') || 'classic';
    const youtubeVideoCodec = getSegValue('youtubeVideoCodec') || 'h264';
    const alwaysProxy = document.getElementById('setting-always-proxy')?.checked || false;
    const disableMetadata = document.getElementById('setting-disable-metadata')?.checked || false;
    const tiktokFullAudio = document.getElementById('setting-tiktok-full-audio')?.checked || false;
    const tiktokH265 = document.getElementById('setting-tiktok-h265')?.checked || false;
    const twitterGif = document.getElementById('setting-twitter-gif')?.checked || false;
    const youtubeHls = document.getElementById('setting-yt-hls')?.checked || false;

    // Add to queue
    const queueId = addToQueue(url, 'loading');

    try {
        const result = await invoke('cobalt_request', { 
            apiUrl, 
            url, 
            downloadMode: currentMode, 
            videoQuality, 
            audioFormat,
            audioBitrate,
            filenameStyle,
            youtubeVideoCodec,
            alwaysProxy,
            disableMetadata,
            tiktokFullAudio,
            tiktokH265,
            twitterGif,
            youtubeHls,
            apiToken
        });
        currentResult = result;
        handleResult(result, queueId, url);
    } catch (err) {
        // Fallback to yt-dlp if cobalt request completely fails (e.g. rate limited or blocked)
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            showStatus('cobalt failed, falling back to yt-dlp...', 'loading');
            handleYtDlpFallbackMetadata(url, queueId);
        } else {
            showStatus(String(err), 'error');
            updateQueueItem(queueId, 'error');
        }
    } finally { isProcessing = false; }
}

// ===== Handle API Result =====
function handleResult(result, queueId, originalUrl) {
    const status = result.status;
    if (status === 'error') {
        const errorCode = result.error?.code || 'unknown error';
        if (originalUrl && (originalUrl.includes('youtube.com') || originalUrl.includes('youtu.be'))) {
            showStatus(`cobalt error (${errorCode}), falling back to yt-dlp...`, 'loading');
            handleYtDlpFallbackMetadata(originalUrl, queueId);
            return;
        }
        showStatus(`error: ${errorCode}`, 'error');
        updateQueueItem(queueId, 'error');
        return;
    }
    if (status === 'redirect' || status === 'tunnel') {
        const filename = result.filename || 'download';
        showStatus(`ready: ${filename}`, 'success');
        // Add a "ready" status to the queue with the necessary download data
        updateQueueItem(queueId, 'ready', filename, { url: result.url, filename, originalUrl });
        return;
    }
    if (status === 'picker') {
        showStatus('multiple items found — pick one:', 'success');
        showPicker(result.picker, result.audio, result.audioFilename, queueId);
        updateQueueItem(queueId, 'done');
        return;
    }
    showStatus(`unexpected status: ${status}`, 'error');
    updateQueueItem(queueId, 'error');
}

// ===== Show Picker =====
function showPicker(items, audio, audioFilename, queueId) {
    pickerArea.innerHTML = '';
    pickerArea.classList.remove('hidden');
    if (audio) {
        const audioItem = document.createElement('div');
        audioItem.className = 'picker-item';
        audioItem.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--accent)"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg><span class="picker-type">audio</span>`;
        audioItem.onclick = () => startDownload(audio, audioFilename || 'audio.mp3');
        pickerArea.appendChild(audioItem);
    }
    items.forEach((item, i) => {
        const el = document.createElement('div');
        el.className = 'picker-item';
        if (item.thumb) {
            el.innerHTML = `<img src="${item.thumb}" alt="item ${i}" loading="lazy" /><span class="picker-type">${item.type || 'media'}</span>`;
        } else {
            el.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted)"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span class="picker-type">${item.type || 'media'}</span>`;
        }
        el.onclick = () => startDownload(item.url, `item_${i}.${item.type === 'photo' ? 'jpg' : 'mp4'}`, null, null);
        pickerArea.appendChild(el);
    });
}

function hidePickerArea() { pickerArea.innerHTML = ''; pickerArea.classList.add('hidden'); }

// ===== Download File =====
async function startDownload(url, filename, queueId, originalUrl, isFallback = false) {
    // Always show native Save As dialog
    let savePath = null;
    try {
        const { save } = window.__TAURI__.dialog || await import('@tauri-apps/plugin-dialog');
        // Determine file extension for filter
        const ext = filename.split('.').pop() || '*';
        const filterName = ext === 'mp4' ? 'Video' : ext === 'mp3' || ext === 'opus' || ext === 'ogg' || ext === 'wav' ? 'Audio' : 'Media';
        savePath = await save({
            defaultPath: filename,
            filters: [{ name: filterName, extensions: [ext] }, { name: 'All Files', extensions: ['*'] }],
            title: 'Save media file',
        });
    } catch (err) {
        console.warn('Dialog not available, using default path:', err);
    }

    if (savePath === null && window.__TAURI__.dialog) {
        showStatus('download cancelled', 'error');
        return;
    }

    showStatus('<span class="spinner"></span> downloading...', 'loading');
    updateQueueItem(queueId, 'downloading', filename); // Update queue to show downloading status
    
    try {
        let savedPath;
        if (isFallback) {
            savedPath = await invoke('download_with_ytdlp', { url: originalUrl || url, filename, savePath });
        } else {
            savedPath = await invoke('download_file', { url, filename, savePath });
        }
        showStatus(`saved to: ${savedPath}`, 'success');
        if (queueId) updateQueueItem(queueId, 'done', filename);
        addHistoryEntry({ filename, path: savedPath, source: originalUrl || url, ts: Date.now() });
        // Track storage used
        try {
            const { stat } = window.__TAURI__?.fs || {};
            if (stat) {
                const info = await stat(savedPath);
                addStorageUsed(getCurrentSession(), info.size || 0);
            }
        } catch (_) {}
    } catch (err) {
        // If Cobalt tunnel fails (e.g. 0-byte blocked file), fallback to yt-dlp
        if (!isFallback && originalUrl && (originalUrl.includes('youtube.com') || originalUrl.includes('youtu.be'))) {
            console.warn("Tunnel failed, trying yt-dlp...", err);
            showStatus('tunnel failed, falling back to yt-dlp...', 'loading');
            startYtDlpFallback(originalUrl, filename, queueId, savePath);
        } else {
            showStatus(`download failed: ${err}`, 'error');
            if (queueId) updateQueueItem(queueId, 'error');
        }
    }
}

async function startYtDlpFallback(originalUrl, filename, queueId, savePath = null) {
    try {
        const savedPath = await invoke('download_with_ytdlp', { 
            url: originalUrl, 
            filename, 
            savePath 
        });
        showStatus(`saved via fallback: ${savedPath}`, 'success');
        if (queueId) updateQueueItem(queueId, 'done', filename);
        addHistoryEntry({ filename, path: savedPath, source: originalUrl || url, ts: Date.now() });
        try {
            const { stat } = window.__TAURI__?.fs || {};
            if (stat) { const info = await stat(savedPath); addStorageUsed(getCurrentSession(), info.size || 0); }
        } catch (_) {}
    } catch (err) {
        showStatus(`yt-dlp fallback failed: ${err}`, 'error');
        if (queueId) updateQueueItem(queueId, 'error');
    }
}

async function handleYtDlpFallbackMetadata(originalUrl, queueId) {
    showStatus('fetching yt-dlp metadata...', 'loading');
    updateQueueItem(queueId, 'processing', 'fetching metadata...');
    try {
        const filename = await invoke('get_ytdlp_metadata', { url: originalUrl });
        showStatus(`ready: ${filename}`, 'success');
        updateQueueItem(queueId, 'ready', filename, { url: originalUrl, filename, originalUrl, isFallback: true });
    } catch (err) {
        showStatus(`fallback failed: ${err}`, 'error');
        if (queueId) updateQueueItem(queueId, 'error');
    }
}

// ===== Status Helpers =====
function showStatus(html, type) {
    statusArea.classList.remove('hidden');
    statusMessage.className = 'status-message';
    if (type) statusMessage.classList.add(type);
    statusMessage.innerHTML = html;
}

// ===== Processing Queue =====
btnQueue.addEventListener('click', (e) => {
    e.stopPropagation();
    queueDropdown.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
    if (!queueDropdown.contains(e.target) && e.target !== btnQueue) {
        queueDropdown.classList.add('hidden');
    }
});

function addToQueue(url, status) {
    const id = Date.now();
    const shortName = url.length > 40 ? url.substring(0, 40) + '...' : url;
    queueItems.unshift({ id, name: shortName, status });
    if (queueItems.length > 20) queueItems.pop();
    renderQueue();
    return id;
}

function updateQueueItem(id, status, name, downloadData) {
    const item = queueItems.find(q => q.id === id);
    if (item) {
        item.status = status;
        if (name) item.name = name;
        if (downloadData) item.downloadData = downloadData;
        renderQueue();
    }
}

// Ensure the startDownload function is available globally for inline onclick handlers
window.startDownload = startDownload;

function renderQueue() {
    if (queueItems.length === 0) {
        queueBody.innerHTML = '<p class="queue-empty">nothing here yet, just the two of us.<br>try downloading something!</p>';
        return;
    }
    let html = '';
    queueItems.forEach(item => {
        let statusElement = '';
        if (item.status === 'ready' && item.downloadData) {
            const safeUrl = (item.downloadData.url || '').replace(/'/g, "\\'");
            const safeFilename = (item.downloadData.filename || '').replace(/'/g, "\\'");
            const safeOrig = (item.downloadData.originalUrl || '').replace(/'/g, "\\'");
            const isFb = item.downloadData.isFallback ? 'true' : 'false';
            statusElement = `<button class="queue-download-btn" onclick="startDownload('${safeUrl}', '${safeFilename}', ${item.id}, '${safeOrig}', ${isFb})" title="Download"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--accent);"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></button>`;
        } else {
            const statusLabel = item.status === 'done' ? 'done' : item.status === 'error' ? 'error' : item.status === 'ready' ? 'ready' : item.status === 'downloading' ? 'downloading' : 'processing';
            statusElement = `<span class="queue-item-status ${item.status}">${statusLabel}</span>`;
        }
        html += `<div class="queue-item"><span class="queue-item-name">${item.name}</span>${statusElement}</div>`;
    });
    queueBody.innerHTML = html;
}

// Ensure the open function is available for service chips
const SERVICE_URLS = {
    'youtube':      'https://youtube.com',
    'youtubemusic': 'https://music.youtube.com',
    'twitter':      'https://twitter.com',
    'x':            'https://x.com',
    'tiktok':       'https://tiktok.com',
    'instagram':    'https://instagram.com',
    'reddit':       'https://reddit.com',
    'soundcloud':   'https://soundcloud.com',
    'spotify':      'https://spotify.com',
    'twitch':       'https://twitch.tv',
    'vimeo':        'https://vimeo.com',
    'bilibili':     'https://bilibili.com',
    'rutube':       'https://rutube.ru',
    'vk':           'https://vk.com',
    'ok':           'https://ok.ru',
    'dailymotion':  'https://dailymotion.com',
    'facebook':     'https://facebook.com',
    'pinterest':    'https://pinterest.com',
    'tumblr':       'https://tumblr.com',
    'streamable':   'https://streamable.com',
    'mixcloud':     'https://mixcloud.com',
    'bandcamp':     'https://bandcamp.com',
    'nicovideo':    'https://nicovideo.jp',
    'niconico':     'https://nicovideo.jp',
    'loom':         'https://loom.com',
    'vine':         'https://vine.co',
    'coub':         'https://coub.com',
    'odnoklassniki':'https://ok.ru',
    'xiaohongshu':  'https://xiaohongshu.com',
    'snapchat':     'https://snapchat.com',
    'bluesky':      'https://bsky.app',
    'bsky':         'https://bsky.app',
};

window.openServiceUrl = async (serviceName) => {
    const key = serviceName.toLowerCase().trim();
    const url = SERVICE_URLS[key]
        ?? (serviceName.includes('.') ? `https://${serviceName}` : `https://${serviceName}.com`);
    try {
        const { open } = window.__TAURI__.opener || await import('@tauri-apps/plugin-opener');
        await open(url);
    } catch (err) {
        window.open(url, '_blank');
    }
};

// ===== Supported Services Popup =====
topbarCenter.addEventListener('click', async () => {
    overlayBody.innerHTML = '<p style="color:var(--text-secondary);margin-bottom:12px;">fetching server info...</p>';
    overlay.classList.remove('hidden');
    const apiUrl = settingApiUrl.value.trim() || 'https://api.cobalt.tools';
    try {
        const info = await invoke('cobalt_server_info', { apiUrl });
        const services = info?.cobalt?.services || [];
        const version = info?.cobalt?.version || '?';
        let html = `<h3 style="margin-bottom:8px;font-size:16px;">supported services</h3>`;
        html += `<p style="color:var(--text-muted);font-size:11px;margin-bottom:16px;">cobalt v${version}</p>`;
        if (services.length > 0) {
            html += '<div class="services-list">';
            services.forEach(s => { 
                html += `<div class="service-chip" style="cursor:pointer;" onclick="openServiceUrl('${s}')" title="Open ${s}">${s}</div>`; 
            });
            html += '</div>';
        } else { html += '<p style="color:var(--text-secondary);">no service data available</p>'; }
        overlayBody.innerHTML = html;
    } catch (err) { overlayBody.innerHTML = `<p style="color:var(--error);">failed to fetch: ${err}</p>`; }
});

overlayClose.addEventListener('click', () => overlay.classList.add('hidden'));
overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });

// ===== Updates =====
let updatesLoaded = false;
async function loadUpdates() {
    if (updatesLoaded) return;
    const updatesBody = document.getElementById('updates-body');
    try {
        const resp = await fetch('updates.md');
        const md = await resp.text();
        updatesBody.innerHTML = renderMarkdown(md);
        updatesLoaded = true;
    } catch (err) { updatesBody.innerHTML = `<p style="color:var(--error);">failed to load updates</p>`; }
}

function renderMarkdown(md) {
    let html = '';
    const lines = md.split('\n');
    let inList = false;
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) { if (inList) { html += '</ul>'; inList = false; } continue; }
        if (trimmed.startsWith('# ')) { if (inList) { html += '</ul>'; inList = false; } html += `<h1>${trimmed.slice(2)}</h1>`; }
        else if (trimmed.startsWith('## ')) { if (inList) { html += '</ul>'; inList = false; } html += `<h2>${trimmed.slice(3)}</h2>`; }
        else if (trimmed.startsWith('- ')) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${trimmed.slice(2)}</li>`; }
        else { if (inList) { html += '</ul>'; inList = false; } html += `<p style="color:var(--text-secondary);font-size:12px;margin-bottom:6px;">${trimmed}</p>`; }
    }
    if (inList) html += '</ul>';
    return html;
}

// ===== Remix Dropzone =====
const remixDropzone = document.getElementById('remix-dropzone');
const remixFileInput = document.getElementById('remix-file-input');

remixDropzone.addEventListener('dragover', (e) => { e.preventDefault(); remixDropzone.classList.add('dragover'); });
remixDropzone.addEventListener('dragleave', () => remixDropzone.classList.remove('dragover'));
remixDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    remixDropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) handleRemixFiles(e.dataTransfer.files);
});
remixFileInput.addEventListener('change', () => { if (remixFileInput.files.length > 0) handleRemixFiles(remixFileInput.files); });

function handleRemixFiles(files) {
    const names = Array.from(files).map(f => f.name).join(', ');
    alert(`Selected: ${names}\n\nRemuxing requires ffmpeg integration which is not yet implemented.`);
}

// ===== Settings Category Nav =====
document.querySelectorAll('.stg-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.stg-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.stgCat;
        document.querySelectorAll('.stg-panel').forEach(p => p.classList.remove('active'));
        const panel = document.querySelector(`[data-stg-panel="${cat}"]`);
        if (panel) panel.classList.add('active');
    });
});

// ===== Segmented Controls =====
document.querySelectorAll('.seg-ctrl').forEach(ctrl => {
    ctrl.querySelectorAll('.seg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            ctrl.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            saveSettings();
            if (ctrl.dataset.setting === 'filenameStyle') {
                updateFilenamePreview();
            }
        });
    });
});

function getSegValue(settingName) {
    const ctrl = document.querySelector(`[data-setting="${settingName}"]`);
    if (!ctrl) return null;
    const active = ctrl.querySelector('.seg-btn.active');
    return active ? active.dataset.val : null;
}

function setSegValue(settingName, val) {
    const ctrl = document.querySelector(`[data-setting="${settingName}"]`);
    if (!ctrl) return;
    ctrl.querySelectorAll('.seg-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.val === val);
    });
}

// ===== Settings Persistence =====
function loadSettings() {
    const saved = localStorage.getItem('santi-tools-settings');
    if (saved) {
        try {
            const s = JSON.parse(saved);
            if (s.apiUrl) settingApiUrl.value = s.apiUrl;
            if (s.videoQuality) setSegValue('videoQuality', s.videoQuality);
            if (s.audioFormat) setSegValue('audioFormat', s.audioFormat);
            if (s.audioBitrate) setSegValue('audioBitrate', s.audioBitrate);
            if (s.filenameStyle) setSegValue('filenameStyle', s.filenameStyle);
            if (s.youtubeVideoCodec) setSegValue('youtubeVideoCodec', s.youtubeVideoCodec);
            const toggleMap = {
                alwaysProxy: 'setting-always-proxy', disableMetadata: 'setting-disable-metadata',
                tiktokFullAudio: 'setting-tiktok-full-audio', tiktokH265: 'setting-tiktok-h265',
                twitterGif: 'setting-twitter-gif', ytHls: 'setting-yt-hls',
                customInstance: 'setting-custom-instance', useApiKey: 'setting-use-api-key',
                noAnalytics: 'setting-no-analytics', debug: 'setting-debug',
            };
            for (const [key, id] of Object.entries(toggleMap)) {
                const el = document.getElementById(id);
                if (el && s[key] !== undefined) el.checked = s[key];
            }
            if (s.apiKey) { const el = document.getElementById('setting-api-key'); if (el) el.value = s.apiKey; }
        } catch (e) { console.error('Failed to parse settings', e); }
    }
    updateFilenamePreview();
    updateToggleSections();
}

function updateFilenamePreview() {
    const style = getSegValue('filenameStyle') || 'classic';
    const v = document.getElementById('fn-preview-video');
    const a = document.getElementById('fn-preview-audio');
    if (!v || !a) return;
    
    if (style === 'classic') {
        v.textContent = 'youtube_Video_Title_1080p_h264.mp4';
        a.textContent = 'youtube_Audio_Title_audio.mp3';
    } else if (style === 'pretty') {
        v.textContent = 'Video Title - YouTube (1080p, h264).mp4';
        a.textContent = 'Audio Title - YouTube.mp3';
    } else if (style === 'basic') {
        v.textContent = 'Video Title.mp4';
        a.textContent = 'Audio Title.mp3';
    } else if (style === 'nerdy') {
        v.textContent = 'youtube_1080p_h264_id123.mp4';
        a.textContent = 'youtube_audio_id123.mp3';
    }
}

function saveSettings() {
    const s = {
        apiUrl: settingApiUrl.value,
        videoQuality: getSegValue('videoQuality'),
        audioFormat: getSegValue('audioFormat'),
        audioBitrate: getSegValue('audioBitrate'),
        filenameStyle: getSegValue('filenameStyle'),
        youtubeVideoCodec: getSegValue('youtubeVideoCodec'),
        alwaysProxy: document.getElementById('setting-always-proxy')?.checked || false,
        disableMetadata: document.getElementById('setting-disable-metadata')?.checked || false,
        tiktokFullAudio: document.getElementById('setting-tiktok-full-audio')?.checked || false,
        tiktokH265: document.getElementById('setting-tiktok-h265')?.checked || false,
        twitterGif: document.getElementById('setting-twitter-gif')?.checked || false,
        ytHls: document.getElementById('setting-yt-hls')?.checked || false,
        customInstance: document.getElementById('setting-custom-instance')?.checked || false,
        useApiKey: document.getElementById('setting-use-api-key')?.checked || false,
        apiKey: document.getElementById('setting-api-key')?.value || '',
        noAnalytics: document.getElementById('setting-no-analytics')?.checked || false,
        debug: document.getElementById('setting-debug')?.checked || false,
    };
    localStorage.setItem('santi-tools-settings', JSON.stringify(s));
    updateFilenamePreview();
    updateToggleSections();
}

document.querySelectorAll('.stg-input').forEach(el => { el.addEventListener('change', saveSettings); el.addEventListener('input', saveSettings); });
document.querySelectorAll('.toggle input').forEach(el => { el.addEventListener('change', saveSettings); });

// ===== Filename Preview =====
const fnPresets = {
    classic: { video: 'Video Title - Video Author (1080p, h264).mp4', audio: 'Audio Title - Audio Author.opus' },
    basic: { video: 'Video Title - Video Author.mp4', audio: 'Audio Title - Audio Author.opus' },
    pretty: { video: 'Video Title (1080p, h264).mp4', audio: 'Audio Title.opus' },
    nerdy: { video: 'Video Title - Video Author [1080p] [h264] [youtube] [BvXxyz123].mp4', audio: 'Audio Title - Audio Author [youtube] [BvXxyz123].opus' },
};

function updateFilenamePreview() {
    const style = getSegValue('filenameStyle') || 'classic';
    const preset = fnPresets[style] || fnPresets.classic;
    const v = document.getElementById('fn-preview-video');
    const a = document.getElementById('fn-preview-audio');
    if (v) v.textContent = preset.video;
    if (a) a.textContent = preset.audio;
}

// Update preview when filename style changes
const fnCtrl = document.querySelector('[data-setting="filenameStyle"]');
if (fnCtrl) {
    fnCtrl.querySelectorAll('.seg-btn').forEach(btn => {
        btn.addEventListener('click', () => setTimeout(updateFilenamePreview, 10));
    });
}

// ===== Toggle-driven section visibility =====
function updateToggleSections() {
    const useKey = document.getElementById('setting-use-api-key')?.checked;
    const keySection = document.getElementById('api-key-section');
    if (keySection) keySection.classList.toggle('hidden', !useKey);
}

document.getElementById('setting-use-api-key')?.addEventListener('change', updateToggleSections);

// ===== Advanced Action Buttons =====
document.getElementById('btn-export-settings')?.addEventListener('click', () => {
    const data = localStorage.getItem('santi-tools-settings') || '{}';
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'santi-tools-settings.json'; a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('btn-import-settings')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.addEventListener('change', async () => {
        if (input.files.length === 0) return;
        const text = await input.files[0].text();
        try { JSON.parse(text); localStorage.setItem('santi-tools-settings', text); loadSettings(); } catch(e) { alert('Invalid settings file'); }
    });
    input.click();
});

document.getElementById('btn-reset-settings')?.addEventListener('click', () => {
    if (confirm('Reset all settings to defaults?')) { localStorage.removeItem('santi-tools-settings'); location.reload(); }
});

document.getElementById('btn-clear-cache')?.addEventListener('click', () => {
    if (confirm('Clear all cached data?')) { localStorage.clear(); location.reload(); }
});

// ===== Init =====
loadSettings();
urlInput.focus();

// =====================================================
// ===== HISTORY =======================================
// =====================================================

const HISTORY_KEY = (u) => `santi-tools-history-${u}`;
const MAX_HISTORY = 200;

function getHistory() {
    const u = getCurrentSession();
    if (!u) return [];
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY(u)) || '[]'); }
    catch { return []; }
}

function saveHistory(items) {
    const u = getCurrentSession();
    if (!u) return;
    localStorage.setItem(HISTORY_KEY(u), JSON.stringify(items.slice(0, MAX_HISTORY)));
}

function addHistoryEntry(entry) {
    const items = getHistory();
    items.unshift(entry);
    saveHistory(items);
}

function getFileIcon(filename) {
    const ext = (filename || '').split('.').pop().toLowerCase();
    if (['mp4','mov','webm','mkv','avi'].includes(ext))
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>`;
    if (['mp3','ogg','opus','wav','flac','m4a'].includes(ext))
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
    if (['jpg','jpeg','png','gif','webp'].includes(ext))
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
}

function renderHistory() {
    const list = document.getElementById('history-list');
    if (!list) return;
    const items = getHistory();
    if (items.length === 0) {
        list.innerHTML = `<div class="history-empty"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><p>no downloads yet</p></div>`;
        return;
    }
    list.innerHTML = items.map((item, i) => {
        const date = new Date(item.ts);
        const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        const domain = (() => { try { return new URL(item.source || '').hostname.replace('www.', ''); } catch { return item.source || ''; } })();
        return `<div class="history-item">
            <div class="history-item-icon">${getFileIcon(item.filename)}</div>
            <div class="history-item-info">
                <span class="history-item-name" title="${item.path || ''}">${item.filename || 'unknown'}</span>
                <span class="history-item-meta">${domain} · ${dateStr} ${timeStr}</span>
            </div>
            <button class="history-item-delete" onclick="deleteHistoryEntry(${i})" title="Remove">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>`;
    }).join('');
}

window.deleteHistoryEntry = (index) => {
    const items = getHistory();
    items.splice(index, 1);
    saveHistory(items);
    renderHistory();
};

document.getElementById('btn-clear-history')?.addEventListener('click', () => {
    if (!confirm('Clear all download history?')) return;
    const u = getCurrentSession();
    if (u) localStorage.removeItem(HISTORY_KEY(u));
    renderHistory();
});

// =====================================================
// ===== COMPRESSOR ====================================
// =====================================================

let compressFiles = [];

const compressDropzone = document.getElementById('compress-dropzone');
const compressFileInput = document.getElementById('compress-file-input');
const compressQueue = document.getElementById('compress-queue');
const compressRunBtn = document.getElementById('btn-compress-run');

compressDropzone?.addEventListener('dragover', (e) => { e.preventDefault(); compressDropzone.classList.add('dragover'); });
compressDropzone?.addEventListener('dragleave', () => compressDropzone.classList.remove('dragover'));
compressDropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    compressDropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) addCompressFiles(e.dataTransfer.files);
});
compressFileInput?.addEventListener('change', () => {
    if (compressFileInput.files.length) addCompressFiles(compressFileInput.files);
});

function addCompressFiles(fileList) {
    for (const f of fileList) {
        if (!compressFiles.find(x => x.name === f.name && x.size === f.size)) {
            compressFiles.push({ file: f, name: f.name, size: f.size, status: 'pending' });
        }
    }
    renderCompressQueue();
}

function renderCompressQueue() {
    if (!compressQueue) return;
    if (compressFiles.length === 0) {
        compressQueue.classList.add('hidden');
        compressRunBtn.disabled = true;
        return;
    }
    compressQueue.classList.remove('hidden');
    compressRunBtn.disabled = false;
    compressQueue.innerHTML = compressFiles.map((item, i) => {
        const sizeMB = (item.size / 1024 / 1024).toFixed(2);
        const statusClass = item.status === 'done' ? 'success' : item.status === 'error' ? 'error' : item.status === 'working' ? 'loading' : '';
        const statusText = item.status === 'done' ? 'done' : item.status === 'error' ? 'error' : item.status === 'working' ? '...' : `${sizeMB} MB`;
        return `<div class="compress-queue-item">
            <div class="compress-queue-info">
                <span class="compress-queue-name">${item.name}</span>
                <span class="compress-queue-size ${statusClass}">${statusText}</span>
            </div>
            <button class="compress-queue-remove" onclick="removeCompressFile(${i})" title="Remove">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>`;
    }).join('');
}

window.removeCompressFile = (i) => {
    compressFiles.splice(i, 1);
    renderCompressQueue();
};

compressRunBtn?.addEventListener('click', async () => {
    const quality = getSegValue('compressQuality') || 'balanced';
    const qualityMap = { high: '28', balanced: '32', small: '38' }; // CRF values for ffmpeg
    const crf = qualityMap[quality];

    for (let i = 0; i < compressFiles.length; i++) {
        const item = compressFiles[i];
        if (item.status === 'done') continue;
        item.status = 'working';
        renderCompressQueue();

        try {
            // Use Tauri save dialog to pick output path
            const ext = item.name.split('.').pop();
            const baseName = item.name.replace(/\.[^.]+$/, '');
            const outName = `${baseName}_compressed.${ext}`;

            let savePath = null;
            try {
                const { save } = window.__TAURI__.dialog || await import('@tauri-apps/plugin-dialog');
                savePath = await save({
                    defaultPath: outName,
                    filters: [{ name: 'Media', extensions: [ext] }, { name: 'All Files', extensions: ['*'] }],
                    title: `Save compressed: ${item.name}`,
                });
            } catch (_) {}

            if (!savePath) { item.status = 'pending'; renderCompressQueue(); continue; }

            // Read file as array buffer, write to temp, then invoke ffmpeg via yt-dlp shell
            // Since we don't have ffmpeg as a sidecar, we use the system ffmpeg if available
            // and fall back to a canvas-based image compressor for images
            const fileExt = ext.toLowerCase();
            const isImage = ['jpg','jpeg','png','webp','gif'].includes(fileExt);

            if (isImage) {
                // Canvas-based image compression
                const dataUrl = await new Promise((res, rej) => {
                    const reader = new FileReader();
                    reader.onload = e => res(e.target.result);
                    reader.onerror = rej;
                    reader.readAsDataURL(item.file);
                });
                const img = await new Promise((res, rej) => {
                    const i = new Image();
                    i.onload = () => res(i);
                    i.onerror = rej;
                    i.src = dataUrl;
                });
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                canvas.getContext('2d').drawImage(img, 0, 0);
                const qualityVal = quality === 'high' ? 0.9 : quality === 'balanced' ? 0.75 : 0.5;
                const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', qualityVal));
                const buf = await blob.arrayBuffer();
                await invoke('write_file', { path: savePath, data: Array.from(new Uint8Array(buf)) });
                item.status = 'done';
            } else {
                // Video/audio: invoke ffmpeg via shell
                await invoke('compress_with_ffmpeg', {
                    inputPath: item.file.path || item.name,
                    outputPath: savePath,
                    crf,
                });
                item.status = 'done';
            }
        } catch (err) {
            console.error('Compress error:', err);
            item.status = 'error';
        }
        renderCompressQueue();
    }
});

// =====================================================
// ===== NOTES =========================================
// =====================================================

const NOTES_KEY = (u) => `santi-tools-notes-${u}`;
let activeNoteId = null;
let notesSaveTimer = null;

function getNotes() {
    const u = getCurrentSession();
    if (!u) return [];
    try { return JSON.parse(localStorage.getItem(NOTES_KEY(u)) || '[]'); }
    catch { return []; }
}

function saveNotes(notes) {
    const u = getCurrentSession();
    if (!u) return;
    localStorage.setItem(NOTES_KEY(u), JSON.stringify(notes));
}

function createNote() {
    const notes = getNotes();
    const note = { id: Date.now().toString(), title: '', body: '', updatedAt: Date.now() };
    notes.unshift(note);
    saveNotes(notes);
    return note;
}

function renderNotesList() {
    const list = document.getElementById('notes-list');
    if (!list) return;
    const notes = getNotes();
    if (notes.length === 0) {
        list.innerHTML = `<div class="notes-list-empty">no notes yet</div>`;
        return;
    }
    list.innerHTML = notes.map(n => {
        const preview = n.body ? n.body.replace(/\n/g, ' ').slice(0, 60) : 'empty note';
        const date = new Date(n.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const isActive = n.id === activeNoteId;
        return `<div class="notes-list-item ${isActive ? 'active' : ''}" onclick="openNote('${n.id}')">
            <span class="notes-list-title">${n.title || 'untitled'}</span>
            <span class="notes-list-preview">${date} · ${preview}</span>
        </div>`;
    }).join('');
}

window.openNote = (id) => {
    activeNoteId = id;
    const notes = getNotes();
    const note = notes.find(n => n.id === id);
    if (!note) return;

    document.getElementById('notes-empty-state')?.classList.add('hidden');
    const editor = document.getElementById('notes-editor');
    editor?.classList.remove('hidden');

    document.getElementById('note-title-input').value = note.title;
    document.getElementById('note-body-input').value = note.body;
    document.getElementById('note-meta').textContent =
        `last edited ${new Date(note.updatedAt).toLocaleString()}`;

    renderNotesList();
};

function saveActiveNote() {
    if (!activeNoteId) return;
    const notes = getNotes();
    const note = notes.find(n => n.id === activeNoteId);
    if (!note) return;
    note.title = document.getElementById('note-title-input').value;
    note.body = document.getElementById('note-body-input').value;
    note.updatedAt = Date.now();
    // Move to top
    const idx = notes.indexOf(note);
    if (idx > 0) { notes.splice(idx, 1); notes.unshift(note); }
    saveNotes(notes);
    document.getElementById('note-meta').textContent =
        `last edited ${new Date(note.updatedAt).toLocaleString()}`;
    renderNotesList();
}

// Auto-save on input with debounce
['note-title-input', 'note-body-input'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
        clearTimeout(notesSaveTimer);
        notesSaveTimer = setTimeout(saveActiveNote, 600);
    });
});

document.getElementById('btn-new-note')?.addEventListener('click', () => {
    const note = createNote();
    openNote(note.id);
});

// Delete note with Ctrl+Delete or a delete button we'll add dynamically
document.getElementById('note-body-input')?.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Delete') {
        if (!activeNoteId) return;
        if (!confirm('Delete this note?')) return;
        const notes = getNotes().filter(n => n.id !== activeNoteId);
        saveNotes(notes);
        activeNoteId = null;
        document.getElementById('notes-editor')?.classList.add('hidden');
        document.getElementById('notes-empty-state')?.classList.remove('hidden');
        renderNotesList();
    }
});


// =====================================================
// ===== IMAGE HOST (nest.rip) =========================
// =====================================================

// Your nest.rip OAuth app credentials
const NEST_CLIENT_ID     = 'a8b00d4a-652c-4301-a7d6-3764be0d9e2e';
const NEST_REDIRECT_URI  = 'santi-tools://auth/callback';
const NEST_SCOPES        = 'identify uploads.read uploads.write openid';

const IMGHOST_TOKEN_KEY  = 'santi-tools-nest-token';
const IMGHOST_KEY_MANUAL = 'santi-tools-nestkey';
const IMGHOST_FILES_KEY  = (u) => `santi-tools-hosted-${u}`;

// ── Token helpers ─────────────────────────────────────

function getNestToken() {
    // OAuth access token takes priority, fall back to manual API key
    return localStorage.getItem(IMGHOST_TOKEN_KEY)
        || localStorage.getItem(IMGHOST_KEY_MANUAL)
        || '';
}

function saveNestToken(token) {
    localStorage.setItem(IMGHOST_TOKEN_KEY, token.trim());
}

function clearNestToken() {
    localStorage.removeItem(IMGHOST_TOKEN_KEY);
}

function saveNestKey(key) {
    localStorage.setItem(IMGHOST_KEY_MANUAL, key.trim());
}

// ── Hosted files storage ──────────────────────────────

function getHostedFiles() {
    const u = getCurrentSession();
    if (!u) return [];
    try { return JSON.parse(localStorage.getItem(IMGHOST_FILES_KEY(u)) || '[]'); }
    catch { return []; }
}

function saveHostedFiles(files) {
    const u = getCurrentSession();
    if (!u) return;
    localStorage.setItem(IMGHOST_FILES_KEY(u), JSON.stringify(files));
}

// ── Init / render state ───────────────────────────────

async function imghostInit() {
    const token = getNestToken();
    const setup   = document.getElementById('imghost-setup');
    const userBar = document.getElementById('imghost-user-bar');
    const drop    = document.getElementById('imghost-drop');
    const keyInput = document.getElementById('imghost-api-key');

    if (keyInput) keyInput.value = localStorage.getItem(IMGHOST_KEY_MANUAL) || '';

    if (!token) {
        setup?.classList.remove('hidden');
        userBar?.classList.add('hidden');
        drop?.classList.add('dimmed');
    } else {
        setup?.classList.add('hidden');
        drop?.classList.remove('dimmed');
        // Fetch user info to show in the bar
        try {
            const resp = await fetch('https://nest.rip/api/oauth/userinfo', {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (resp.ok) {
                const user = await resp.json();
                userBar?.classList.remove('hidden');
                const nameEl   = document.getElementById('imghost-user-name');
                const avatarEl = document.getElementById('imghost-user-avatar');
                if (nameEl)   nameEl.textContent = user.username || user.name || 'nest.rip user';
                if (avatarEl && user.avatar) { avatarEl.src = user.avatar; avatarEl.style.display = ''; }
                else if (avatarEl) avatarEl.style.display = 'none';

                // Fetch quota
                const infoResp = await fetch('https://nest.rip/api/files/info', {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                if (infoResp.ok) {
                    const info = await infoResp.json();
                    const quotaEl = document.getElementById('imghost-quota');
                    if (quotaEl && info.usedQuota != null && info.maxQuota != null) {
                        quotaEl.textContent = `${formatBytes(info.usedQuota)} / ${formatBytes(info.maxQuota)}`;
                    }
                }
            } else {
                // Token expired or invalid — clear it
                clearNestToken();
                imghostInit();
                return;
            }
        } catch (_) {
            userBar?.classList.add('hidden');
        }
    }

    renderHostedGrid();
}

// ── OAuth flow ────────────────────────────────────────

async function startNestOAuth() {
    const state = generateSalt();
    sessionStorage.setItem('nest-oauth-state', state);

    const params = new URLSearchParams({
        client_id:     NEST_CLIENT_ID,
        redirect_uri:  NEST_REDIRECT_URI,
        response_type: 'code',
        scope:         NEST_SCOPES,
        state,
    });

    const authUrl = `https://nest.rip/oauth/authorize?${params}`;

    try {
        const { open } = window.__TAURI__.opener || await import('@tauri-apps/plugin-opener');
        await open(authUrl);
    } catch (err) {
        console.error('Failed to open nest.rip OAuth:', err);
    }
}

// Listen for the deep-link callback (santi-tools://auth/callback#access_token=... or ?code=...)
window.__TAURI__?.event?.listen('deep-link://new-url', async (event) => {
    const url = Array.isArray(event.payload) ? event.payload[0] : event.payload;
    if (!url.includes('auth/callback')) return;

    // Try fragment (implicit) first, then query string (auth code)
    const frag  = url.includes('#') ? url.split('#')[1] : '';
    const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
    const fragParams  = new URLSearchParams(frag);
    const queryParams = new URLSearchParams(query);

    const accessToken = fragParams.get('access_token');
    const code        = queryParams.get('code');
    const state       = queryParams.get('state') || fragParams.get('state');
    const savedState  = sessionStorage.getItem('nest-oauth-state');

    if (savedState && state && state !== savedState) {
        console.warn('nest.rip OAuth state mismatch');
        return;
    }
    sessionStorage.removeItem('nest-oauth-state');

    if (accessToken) {
        saveNestToken(accessToken);
        imghostInit();
        return;
    }

    if (code) {
        try {
            const accessToken = await invoke('nest_exchange_code', { code });
            saveNestToken(accessToken);
            imghostInit();
        } catch (err) {
            console.error('nest.rip token exchange failed:', err);
        }
    }
});

// ── Button wiring ─────────────────────────────────────

document.getElementById('imghost-oauth-btn')?.addEventListener('click', startNestOAuth);

document.getElementById('imghost-disconnect')?.addEventListener('click', () => {
    clearNestToken();
    imghostInit();
});

document.getElementById('imghost-save-key')?.addEventListener('click', () => {
    const val = document.getElementById('imghost-api-key')?.value.trim();
    if (!val) return;
    saveNestKey(val);
    // If no OAuth token, use this as the active credential
    if (!localStorage.getItem(IMGHOST_TOKEN_KEY)) {
        imghostInit();
    }
});

// ── Drag & drop upload ────────────────────────────────

const imghostDrop  = document.getElementById('imghost-drop');
const imghostInput = document.getElementById('imghost-file-input');

imghostDrop?.addEventListener('dragover', (e) => { e.preventDefault(); imghostDrop.classList.add('dragover'); });
imghostDrop?.addEventListener('dragleave', () => imghostDrop.classList.remove('dragover'));
imghostDrop?.addEventListener('drop', (e) => {
    e.preventDefault();
    imghostDrop.classList.remove('dragover');
    if (e.dataTransfer.files.length) uploadToNest(e.dataTransfer.files);
});
imghostInput?.addEventListener('change', () => {
    if (imghostInput.files.length) uploadToNest(imghostInput.files);
    imghostInput.value = '';
});

async function uploadToNest(fileList) {
    const token = getNestToken();
    if (!token) {
        document.getElementById('imghost-setup')?.classList.remove('hidden');
        return;
    }

    for (const file of fileList) {
        const tempId = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        addHostedCard({ id: tempId, fileName: file.name, uploading: true });

        try {
            const form = new FormData();
            form.append('file', file);

            const resp = await fetch('https://nest.rip/api/files/upload', {
                method: 'POST',
                headers: { 'Authorization': token },
                body: form,
            });

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.message || `HTTP ${resp.status}`);
            }

            const data = await resp.json();
            const files = getHostedFiles().filter(f => f.id !== tempId);
            files.unshift({
                id:            data.fileName,
                fileName:      data.fileName,
                fileURL:       data.fileURL,
                accessibleURL: data.accessibleURL || data.fileURL,
                deletionURL:   data.deletionURL,
                uploadedAt:    Date.now(),
            });
            saveHostedFiles(files);
            renderHostedGrid();
        } catch (err) {
            updateHostedCard(tempId, { uploading: false, error: String(err) });
        }
    }
}

// ── Card helpers ──────────────────────────────────────

function addHostedCard(file) {
    const files = getHostedFiles();
    files.unshift(file);
    saveHostedFiles(files);
    renderHostedGrid();
}

function updateHostedCard(id, patch) {
    const files = getHostedFiles();
    const idx = files.findIndex(f => f.id === id);
    if (idx !== -1) { Object.assign(files[idx], patch); saveHostedFiles(files); }
    renderHostedGrid();
}

// ── Grid renderer ─────────────────────────────────────

function renderHostedGrid() {
    const grid = document.getElementById('imghost-grid');
    if (!grid) return;
    const files = getHostedFiles();

    if (files.length === 0) {
        grid.innerHTML = `<div class="imghost-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <p>nothing uploaded yet</p>
        </div>`;
        return;
    }

    grid.innerHTML = files.map(f => {
        if (f.uploading) return `
            <div class="imghost-card uploading" data-id="${f.id}">
                <div class="imghost-card-thumb"><span class="spinner"></span></div>
                <div class="imghost-card-name">${f.fileName}</div>
            </div>`;

        if (f.error) return `
            <div class="imghost-card error" data-id="${f.id}">
                <div class="imghost-card-thumb error-thumb">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <div class="imghost-card-name" title="${f.error}">${f.fileName}</div>
                <div class="imghost-card-error">${f.error}</div>
                <button class="imghost-card-del" onclick="removeHostedCard('${f.id}')" title="Remove">×</button>
            </div>`;

        const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(f.fileName);
        const thumb = isImage
            ? `<img src="${f.accessibleURL}" alt="${f.fileName}" loading="lazy" />`
            : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

        const safeUrl = (f.accessibleURL || '').replace(/'/g, '%27');
        const safeDel = (f.deletionURL   || '').replace(/'/g, '%27');

        return `
            <div class="imghost-card" data-id="${f.id}">
                <div class="imghost-card-thumb">${thumb}</div>
                <div class="imghost-card-name" title="${f.fileName}">${f.fileName}</div>
                <div class="imghost-card-actions">
                    <button class="imghost-card-btn" onclick="copyHostedUrl('${safeUrl}')" title="Copy link">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    </button>
                    <button class="imghost-card-btn" onclick="openHostedUrl('${safeUrl}')" title="Open">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </button>
                    <button class="imghost-card-btn danger" onclick="deleteHostedFile('${f.id}','${safeDel}')" title="Delete">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                    </button>
                </div>
            </div>`;
    }).join('');
}

// ── Global actions ────────────────────────────────────

window.copyHostedUrl = async (url) => {
    try {
        await navigator.clipboard.writeText(url);
        showStatus('link copied!', 'success');
        setTimeout(() => statusArea.classList.add('hidden'), 1500);
    } catch (_) {}
};

window.openHostedUrl = async (url) => {
    try {
        const { open } = window.__TAURI__.opener || await import('@tauri-apps/plugin-opener');
        await open(url);
    } catch (_) { window.open(url, '_blank'); }
};

window.removeHostedCard = (id) => {
    saveHostedFiles(getHostedFiles().filter(f => f.id !== id));
    renderHostedGrid();
};

window.deleteHostedFile = async (id, deletionURL) => {
    if (!confirm('Delete this file from nest.rip?')) return;
    if (deletionURL) {
        try { await fetch(deletionURL); } catch (_) {}
    } else {
        const token = getNestToken();
        if (token) {
            try {
                await fetch(`https://nest.rip/api/files/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': token },
                });
            } catch (_) {}
        }
    }
    removeHostedCard(id);
};
