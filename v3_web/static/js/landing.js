// =============================================================================
// landing.js — All JavaScript logic for the landing / config page
// =============================================================================

// ── Theme ─────────────────────────────────────────────────────────────────────
const themeBtn = document.getElementById('theme-btn');

function applyTheme(light) {
    document.body.classList.toggle('light', light);
    themeBtn.textContent = light ? '🌙' : '☀️';
}

function toggleTheme() {
    const isLight = !document.body.classList.contains('light');
    localStorage.setItem('crm-theme', isLight ? 'light' : 'dark');
    applyTheme(isLight);
}

applyTheme(localStorage.getItem('crm-theme') === 'light');

// ── Restore last session config (populated when user clicks Go Home) ──────────
function restoreLastSession() {
    const raw = localStorage.getItem('crm-last-session-config');
    if (!raw) return;
    let cfg;
    try { cfg = JSON.parse(raw); } catch(e) { return; }

    const densityPct = Math.round((cfg.density_bias ?? 0.70) * 100);
    const bSlider = document.getElementById('bias-slider');
    if (bSlider) { bSlider.value = densityPct; onBiasChange(densityPct); }

    const pressToggle = document.getElementById('pressure-toggle');
    if (pressToggle) { pressToggle.checked = cfg.pressure_enabled ?? true; onPressureToggle(); }

    const calibToggle = document.getElementById('auto-calib-toggle');
    if (calibToggle) { calibToggle.checked = cfg.auto_calib ?? false; onCalibToggle(); }

    const gridSel = document.getElementById('grid-select');
    if (gridSel) { gridSel.value = cfg.grid_size ?? 'standard'; }

    const threshEl = document.getElementById('thresh-critical');
    if (threshEl) { threshEl.value = cfg.thresh_critical ?? 8; }

    const highThr = document.getElementById('high-thr-slider');
    if (highThr) { const v = Math.round((cfg.high_score_thr ?? 0.50) * 100); highThr.value = v; onHighThrChange(v); }

    const critThr = document.getElementById('crit-thr-slider');
    if (critThr) { const v = Math.round((cfg.crit_score_thr ?? 0.75) * 100); critThr.value = v; onCritThrChange(v); }

    const alphaEl = document.getElementById('alpha-slider');
    if (alphaEl) { const v = Math.round((cfg.overlay_alpha ?? 0.20) * 100); alphaEl.value = v; onAlphaChange(v); }

    const hystEl = document.getElementById('hysteresis');
    if (hystEl) { hystEl.value = cfg.hysteresis ?? 8; }

    showRestoredBanner(densityPct);
}

function showRestoredBanner(densityPct) {
    const bar = document.getElementById('preset-applied-bar');
    const txt = document.getElementById('preset-applied-text');
    if (bar && txt) {
        txt.textContent = `↩️ Last session settings restored (Density Bias: ${densityPct}%) — change any values and hit Analyse again.`;
        bar.classList.add('visible');
    }
}

// ── Config controls ───────────────────────────────────────────────────────────
function onCalibToggle() {
    const on = document.getElementById('auto-calib-toggle').checked;
    document.getElementById('bias-section').style.opacity = on ? '0.4' : '1';
    document.getElementById('bias-section').style.pointerEvents = on ? 'none' : '';
}

function onBiasChange(v) {
    const d = parseInt(v), m = 100 - d;
    document.getElementById('bias-val').textContent = `${d} / ${m}`;
    const bar = document.getElementById('bias-density-bar');
    bar.style.width = d + '%';
    bar.textContent = `Density ${d}%`;
    document.getElementById('bias-motion-bar').textContent = `Motion ${m}%`;
    document.getElementById('bias-slider').style.setProperty('--pct', `${d}%`);
}
onBiasChange(70);

function onPressureToggle() {
    const on = document.getElementById('pressure-toggle').checked;
    const bar = document.getElementById('pressure-info');
    bar.className = 'pressure-info-bar' + (on ? '' : ' off');
    bar.textContent = on
        ? '🗜️ When ON: Density & Motion share 75%, Pressure takes 25%. Distinguishes calm queues from dangerous crushes.'
        : '⚡ When OFF: Full 100% shared between Density and Motion only.';
}

function onAlphaChange(v) {
    const pct = parseInt(v);
    const label = pct <= 15 ? 'Low' : pct <= 30 ? 'Medium' : 'High';
    document.getElementById('alpha-val').textContent = `${label} (${(pct/100).toFixed(2)})`;
    document.getElementById('alpha-slider').style.setProperty('--pct', `${((pct-5)/55*100).toFixed(0)}%`);
}
onAlphaChange(20);

function onHighThrChange(v) {
    document.getElementById('high-thr-val').textContent = `${v}%`;
    document.getElementById('high-thr-slider').style.setProperty('--pct', `${((v-20)/60*100).toFixed(0)}%`);
}
onHighThrChange(50);

function onCritThrChange(v) {
    document.getElementById('crit-thr-val').textContent = `${v}%`;
    document.getElementById('crit-thr-slider').style.setProperty('--pct', `${((v-40)/55*100).toFixed(0)}%`);
}
onCritThrChange(75);

// Restore last session AFTER all defaults so it wins
restoreLastSession();

function toggleAdv() {
    const btn = document.getElementById('adv-btn');
    const body = document.getElementById('adv-body');
    btn.classList.toggle('open');
    body.classList.toggle('visible');
}

// ── Presets ───────────────────────────────────────────────────────────────────
const PRESETS = {
    concert:    { bias: 45, pressure: true,  calib: false, grid: 'standard', thresh: 7,  high: 55, crit: 75, alpha: 20, hyst: 8 },
    pilgrimage: { bias: 60, pressure: true,  calib: false, grid: 'coarse',   thresh: 9,  high: 50, crit: 72, alpha: 18, hyst: 10 },
    subway:     { bias: 75, pressure: false, calib: false, grid: 'detailed', thresh: 10, high: 55, crit: 80, alpha: 20, hyst: 12 },
    mall:       { bias: 55, pressure: true,  calib: false, grid: 'coarse',   thresh: 8,  high: 55, crit: 78, alpha: 22, hyst: 8  },
    stadium:    { bias: 80, pressure: true,  calib: false, grid: 'detailed', thresh: 7,  high: 45, crit: 65, alpha: 25, hyst: 10 },
    drone:      { bias: 65, pressure: true,  calib: false, grid: 'coarse',   thresh: 12, high: 50, crit: 70, alpha: 15, hyst: 6  },
};
const PRESET_LABELS = {
    concert: 'Concert / Mosh Pit',
    pilgrimage: 'Religious Pilgrimage',
    subway: 'Subway / Platform',
    mall: 'Shopping Mall',
    stadium: 'Stadium Corridor',
    drone: 'Drone / Top-Down',
};

let _activePreset = null;
function applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return;

    if (_activePreset) document.getElementById('preset-' + _activePreset)?.classList.remove('active');
    _activePreset = name;
    document.getElementById('preset-' + name)?.classList.add('active');

    document.getElementById('bias-slider').value = p.bias;
    onBiasChange(p.bias);
    document.getElementById('pressure-toggle').checked = p.pressure;
    onPressureToggle();
    document.getElementById('auto-calib-toggle').checked = p.calib;
    onCalibToggle();
    document.getElementById('grid-select').value = p.grid;
    document.getElementById('thresh-critical').value = p.thresh;
    document.getElementById('high-thr-slider').value = p.high;
    onHighThrChange(p.high);
    document.getElementById('crit-thr-slider').value = p.crit;
    onCritThrChange(p.crit);
    document.getElementById('alpha-slider').value = p.alpha;
    onAlphaChange(p.alpha);
    document.getElementById('hysteresis').value = p.hyst;

    document.getElementById('preset-applied-text').textContent =
        `"${PRESET_LABELS[name]}" preset applied — all parameters updated.`;
    document.getElementById('preset-applied-bar').classList.add('visible');
}

// ── AI Image Attach ───────────────────────────────────────────────────────────
let _aiImageBase64 = '';

function compressImageForStorage(dataUrl, maxW = 240, maxH = 160, quality = 0.65) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(maxW / img.width, maxH / img.height, 1);
            const w = Math.round(img.width * scale);
            const h = Math.round(img.height * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
    });
}

function onAIImageSelected(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        _aiImageBase64 = e.target.result;
        document.getElementById('ai-img-thumb').src = _aiImageBase64;
        document.getElementById('ai-img-name').textContent = file.name;
        document.getElementById('ai-img-preview').classList.add('visible');
    };
    reader.readAsDataURL(file);
}

function clearAIImage() {
    _aiImageBase64 = '';
    document.getElementById('ai-img-input').value = '';
    document.getElementById('ai-img-thumb').src = '';
    document.getElementById('ai-img-preview').classList.remove('visible');
}

// ── AI Configuration Chat ─────────────────────────────────────────────────────
async function askAI() {
    const textarea  = document.getElementById('ai-textarea');
    const sendBtn   = document.getElementById('ai-send-btn');
    const statusEl  = document.getElementById('ai-status');
    const explBox   = document.getElementById('ai-explanation');
    const explText  = document.getElementById('ai-explanation-text');
    const statsRow  = document.getElementById('ai-stats-row');

    const prompt = textarea.value.trim();
    if (!prompt) { statusEl.textContent = '⚠ Please describe your scenario first.'; return; }

    sendBtn.disabled = true;
    explBox.classList.remove('visible');
    statusEl.style.color = 'var(--text-dim)';
    statusEl.textContent = '🤖 Analysing your scenario…';

    try {
        const res = await fetch('/api/ai-configure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, ...(_aiImageBase64 ? { image_base64: _aiImageBase64 } : {}) })
        });
        const data = await res.json();

        if (data.error) {
            if (data.error.includes('GEMINI_API_KEY')) {
                document.getElementById('ai-key-warning').style.display = 'flex';
            }
            statusEl.style.color = 'var(--red)';
            statusEl.textContent = '❌ ' + data.error;
            sendBtn.disabled = false;
            return;
        }

        const biasInt = Math.round(data.density_bias * 100);
        document.getElementById('bias-slider').value = biasInt;
        onBiasChange(biasInt);
        document.getElementById('pressure-toggle').checked = data.pressure_enabled;
        onPressureToggle();
        document.getElementById('auto-calib-toggle').checked = false;
        onCalibToggle();
        document.getElementById('grid-select').value = data.grid_size;
        document.getElementById('thresh-critical').value = data.thresh_critical;

        const highInt = Math.round(data.high_score_thr * 100);
        document.getElementById('high-thr-slider').value = highInt;
        onHighThrChange(highInt);

        const critInt = Math.round(data.crit_score_thr * 100);
        document.getElementById('crit-thr-slider').value = critInt;
        onCritThrChange(critInt);

        const alphaInt = Math.round(data.overlay_alpha * 100);
        document.getElementById('alpha-slider').value = alphaInt;
        onAlphaChange(alphaInt);

        document.getElementById('hysteresis').value = data.hysteresis;

        explText.textContent = data.explanation;
        statsRow.innerHTML = [
            `Density ${biasInt}% / Motion ${100 - biasInt}%`,
            `Pressure ${data.pressure_enabled ? 'ON' : 'OFF'}`,
            `Grid: ${data.grid_size}`,
            `Alert @ ${highInt}% / ${critInt}%`,
            `Thresh: ${data.thresh_critical} ppl/cell`,
        ].map(s => `<span class="ai-chip">${s}</span>`).join('');
        explBox.classList.add('visible');

        statusEl.style.color = 'var(--green)';
        statusEl.textContent = '✅ All sliders updated by AI — ready to analyse.';

        const imgToStore = _aiImageBase64 ? await compressImageForStorage(_aiImageBase64) : null;
        try {
            savePromptHistory(prompt, readAllSettings(), imgToStore);
        } catch (storageErr) {
            console.warn('[history] localStorage quota reached — saving without image.', storageErr);
            try { savePromptHistory(prompt, readAllSettings(), null); } catch(e) {}
        }

        if (_activePreset) {
            document.getElementById('preset-' + _activePreset)?.classList.remove('active');
            _activePreset = null;
        }

    } catch (err) {
        statusEl.style.color = 'var(--red)';
        statusEl.textContent = '❌ Network error: ' + err.message;
    } finally {
        sendBtn.disabled = false;
    }
}

// ── Upload ────────────────────────────────────────────────────────────────────
let selectedFile = null;
const fileInput = document.getElementById('file-input');
const dropZone  = document.getElementById('drop-zone');
const preview   = document.getElementById('file-preview');
const nameEl    = document.getElementById('file-name');
const sizeEl    = document.getElementById('file-size');
const btn       = document.getElementById('analyse-btn');
const prog      = document.getElementById('upload-progress');
const label     = document.getElementById('progress-label');

fileInput.addEventListener('change', () => selectFile(fileInput.files[0]));
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) selectFile(e.dataTransfer.files[0]);
});

function selectFile(file) {
    if (!file) return;
    selectedFile = file;
    nameEl.textContent = file.name;
    sizeEl.textContent = `${(file.size / 1024 / 1024).toFixed(1)} MB`;
    preview.classList.add('visible');
    btn.disabled = false;
}

btn.addEventListener('click', async () => {
    if (!selectedFile) return;
    btn.disabled = true;
    prog.classList.add('visible');
    label.textContent = `Uploading "${selectedFile.name}"…`;

    try {
        const form = new FormData();
        form.append('file', selectedFile);

        const biasRaw = parseInt(document.getElementById('bias-slider').value) / 100;
        form.append('density_bias',     biasRaw.toFixed(2));
        form.append('pressure_enabled', document.getElementById('pressure-toggle').checked ? 'true' : 'false');
        form.append('auto_calib',       document.getElementById('auto-calib-toggle').checked ? 'true' : 'false');

        const alphaRaw = parseInt(document.getElementById('alpha-slider').value) / 100;
        form.append('overlay_alpha', alphaRaw.toFixed(2));
        form.append('grid_size',     document.getElementById('grid-select').value);

        form.append('thresh_critical', document.getElementById('thresh-critical').value);
        form.append('high_score_thr',  (parseInt(document.getElementById('high-thr-slider').value) / 100).toFixed(2));
        form.append('crit_score_thr',  (parseInt(document.getElementById('crit-thr-slider').value) / 100).toFixed(2));
        form.append('hysteresis',      document.getElementById('hysteresis').value);

        const res = await fetch('/upload', { method: 'POST', body: form });
        if (!res.ok) throw new Error('Upload failed');

        label.textContent = 'Starting analysis engine…';
        await new Promise(r => setTimeout(r, 1500));
        window.location.href = '/dashboard';

    } catch (err) {
        label.textContent = '❌ ' + err.message;
        btn.disabled = false;
    }
});

// ── Save / Load Settings ──────────────────────────────────────────────────────
const SETTINGS_KEY = 'crm-settings';

function readAllSettings() {
    return {
        bias:      document.getElementById('bias-slider').value,
        pressure:  document.getElementById('pressure-toggle').checked,
        calib:     document.getElementById('auto-calib-toggle').checked,
        grid:      document.getElementById('grid-select').value,
        thresh:    document.getElementById('thresh-critical').value,
        highThr:   document.getElementById('high-thr-slider').value,
        critThr:   document.getElementById('crit-thr-slider').value,
        alpha:     document.getElementById('alpha-slider').value,
        hyst:      document.getElementById('hysteresis').value,
    };
}

function applyAllSettings(s) {
    document.getElementById('bias-slider').value = s.bias;           onBiasChange(s.bias);
    document.getElementById('pressure-toggle').checked = s.pressure; onPressureToggle();
    document.getElementById('auto-calib-toggle').checked = s.calib;  onCalibToggle();
    document.getElementById('grid-select').value = s.grid;
    document.getElementById('thresh-critical').value = s.thresh;
    document.getElementById('high-thr-slider').value = s.highThr;   onHighThrChange(s.highThr);
    document.getElementById('crit-thr-slider').value = s.critThr;   onCritThrChange(s.critThr);
    document.getElementById('alpha-slider').value = s.alpha;         onAlphaChange(s.alpha);
    document.getElementById('hysteresis').value = s.hyst;
}

function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(readAllSettings()));
    const btn = document.getElementById('save-settings-btn');
    btn.textContent = '✅ Saved!';
    btn.classList.add('saved');
    setTimeout(() => { btn.textContent = '💾 Save Settings'; btn.classList.remove('saved'); }, 2000);
}

function resetSettings() {
    localStorage.removeItem(SETTINGS_KEY);
    applyAllSettings({ bias:70, pressure:true, calib:false, grid:'standard',
                       thresh:8, highThr:50, critThr:75, alpha:20, hyst:8 });
    const btn = document.getElementById('save-settings-btn');
    btn.textContent = '🗑 Reset!';
    btn.classList.remove('saved');
    setTimeout(() => { btn.textContent = '💾 Save Settings'; }, 1800);
}

function loadSettings() {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    try { applyAllSettings(JSON.parse(raw)); } catch(e) {}
}
loadSettings();

// ── AI Prompt History ─────────────────────────────────────────────────────────
const HISTORY_KEY = 'crm-prompt-history';
const HISTORY_MAX = 15;

function savePromptHistory(prompt, settings, image = null) {
    let history = [];
    try { history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch(e) {}
    history.unshift({ prompt, settings, ts: Date.now(), image: image || null });
    if (history.length > HISTORY_MAX) history = history.slice(0, HISTORY_MAX);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function timeAgo(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
}

function renderPromptHistory() {
    const drawer = document.getElementById('history-drawer');
    const empty  = document.getElementById('history-empty');
    let history = [];
    try { history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch(e) {}

    drawer.querySelectorAll('.history-item').forEach(el => el.remove());
    if (history.length === 0) { empty.style.display = ''; return; }
    empty.style.display = 'none';

    history.forEach((entry, i) => {
        const s = entry.settings;
        const chips = [
            `Density ${s.bias}% / Motion ${100-s.bias}%`,
            `Pressure ${s.pressure ? 'ON' : 'OFF'}`,
            `Grid: ${s.grid}`,
            `Alert @ ${s.highThr}% / ${s.critThr}%`,
        ].map(c => `<span class="hchip">${c}</span>`).join('');

        const div = document.createElement('div');
        div.className = 'history-item';
        const imgHtml = entry.image
            ? `<img src="${entry.image}" style="width:100%;max-height:70px;object-fit:cover;border-radius:6px;margin-bottom:4px;border:1px solid rgba(99,102,241,0.25)" alt="context image" />`
            : '';
        div.innerHTML = `
            ${imgHtml}
            <div class="history-item-top">
                <div class="history-prompt">${entry.prompt.length > 80 ? entry.prompt.slice(0,80)+'…' : entry.prompt}</div>
                <div class="history-ts">${timeAgo(entry.ts)}</div>
            </div>
            <div class="history-chips">${chips}</div>
            <button class="history-restore" onclick="restoreFromHistory(${i})">Restore settings →</button>
        `;
        drawer.appendChild(div);
    });
}

function openHistoryModal() {
    renderHistoryModal();
    document.getElementById('hm-backdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeHistoryModal() {
    document.getElementById('hm-backdrop').classList.remove('open');
    document.body.style.overflow = '';
}

function closeHistoryModalIfOutside(e) {
    if (e.target === document.getElementById('hm-backdrop')) closeHistoryModal();
}

function renderHistoryModal() {
    const body  = document.getElementById('hm-body');
    const empty = document.getElementById('hm-empty');
    const count = document.getElementById('hm-count');
    let history = [];
    try { history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch(e) {}

    body.querySelectorAll('.hm-entry').forEach(el => el.remove());
    count.textContent = history.length ? `${history.length} saved` : '';
    if (history.length === 0) { empty.style.display = ''; return; }
    empty.style.display = 'none';

    history.forEach((entry, i) => {
        const s = entry.settings;
        const chips = [
            `Density ${s.bias}% / Motion ${100 - parseInt(s.bias)}%`,
            `Pressure ${s.pressure ? 'ON' : 'OFF'}`,
            `Grid: ${s.grid}`,
            `Thresh: ${s.thresh} ppl/cell`,
            `Alert @ ${s.highThr}% / ${s.critThr}%`,
            `Hysteresis: ${s.hyst}f`,
        ].map(c => `<span class="hm-chip">${c}</span>`).join('');

        const thumbHtml = entry.image
            ? `<img class="hm-thumb" src="${entry.image}" alt="context" />`
            : `<div class="hm-thumb-placeholder">🖼️</div>`;

        const div = document.createElement('div');
        div.className = 'hm-entry';
        div.innerHTML = `
            <div class="hm-entry-top">
                ${thumbHtml}
                <div class="hm-entry-meta">
                    <div class="hm-prompt-text">${entry.prompt}</div>
                    <div class="hm-ts">${timeAgo(entry.ts)}</div>
                </div>
            </div>
            <div class="hm-chips">${chips}</div>
            <div class="hm-actions">
                <button class="hm-restore-btn" onclick="restoreFromHistoryModal(${i})">Restore Settings →</button>
            </div>
        `;
        body.appendChild(div);
    });
}

function restoreFromHistoryModal(index) {
    let history = [];
    try { history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch(e) {}
    if (!history[index]) return;
    applyAllSettings(history[index].settings);
    closeHistoryModal();
    const s = document.getElementById('ai-status');
    if (s) { s.style.color = 'var(--green)'; s.textContent = '✅ Settings restored from history.'; setTimeout(() => s.textContent = '', 2500); }
}

function restoreFromHistory(index) {
    let history = [];
    try { history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch(e) {}
    if (!history[index]) return;
    applyAllSettings(history[index].settings);
    const btn = document.querySelectorAll('.history-restore')[index];
    if (btn) { btn.textContent = '✅ Restored!'; setTimeout(() => btn.textContent = 'Restore settings →', 1800); }
}

// ── SMS Alert Toggle (landing page) ──────────────────────────────────────────
async function toggleLandingSms(checkbox) {
    const endpoint = checkbox.checked ? '/api/sms-alerts/on' : '/api/sms-alerts/off';
    try {
        await fetch(endpoint, { method: 'POST' });
    } catch (e) {
        console.error('[CRM] SMS toggle failed:', e);
        checkbox.checked = !checkbox.checked; // revert on failure
    }
}

// Sync SMS toggle ON page load with live server state
(async function syncSmsToggle() {
    try {
        const res  = await fetch('/api/stats');
        const data = await res.json();
        const toggle = document.getElementById('landing-sms-toggle');
        if (toggle && data.alert_status) {
            toggle.checked = !!data.alert_status.sms_enabled;
        }
    } catch (_) { /* server not ready yet — leave at default OFF */ }
})();
