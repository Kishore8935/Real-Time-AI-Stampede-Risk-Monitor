// =============================================================================
// dashboard.js — All JavaScript logic for the live monitoring dashboard
// =============================================================================

// ── Profile Popup ──────────────────────────────────────────────────────────────
(async function initProfile() {
    try {
        const res  = await fetch('/api/auth/me');
        if (!res.ok) return;
        const user = await res.json();
        const email = user.email || '';
        document.getElementById('pp-email').textContent      = email;
        document.getElementById('profile-label').textContent = email.split('@')[0];
        document.getElementById('profile-avatar').textContent = email[0].toUpperCase();
    } catch (_) {}
})();

function toggleProfilePopup() {
    document.getElementById('profile-popup').classList.toggle('open');
    document.getElementById('profile-backdrop').classList.toggle('open');
}
function closeProfilePopup() {
    document.getElementById('profile-popup').classList.remove('open');
    document.getElementById('profile-backdrop').classList.remove('open');
}

// ── Chart.js setup ────────────────────────────────────────────────────────────
const MAX_POINTS = 120; // ~60 seconds at 500ms polling
const chartLabels = [];
const chartData = [];

const ctx = document.getElementById('riskChart').getContext('2d');
const riskChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: chartLabels,
        datasets: [{
            data: chartData,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.35,
            fill: true,
            segment: {
                borderColor: seg => {
                    const v = seg.p1.raw;
                    return v >= 65 ? '#ef4444' : v >= 35 ? '#f97316' : '#22c55e';
                },
                backgroundColor: seg => {
                    const v = seg.p1.raw;
                    return v >= 65 ? 'rgba(239,68,68,0.12)' :
                           v >= 35 ? 'rgba(249,115,22,0.10)' :
                                     'rgba(34,197,94,0.08)';
                },
            },
        }],
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: { legend: { display: false } },
        scales: {
            x: { display: false },
            y: {
                min: 0, max: 100,
                grid: { color: 'rgba(255,255,255,0.04)' },
                ticks: {
                    color: '#4a5568', font: { size: 9, family: 'JetBrains Mono' },
                    stepSize: 25,
                },
            },
        },
    },
});

// ── DOM refs ──────────────────────────────────────────────────────────────────
const statusCard = document.getElementById('status-card');
const statusIcon = document.getElementById('status-icon');
const statusText = document.getElementById('status-text');
const riskNumber = document.getElementById('risk-number');
const gaugeFill  = document.getElementById('gauge-fill');
const fpsBadge   = document.getElementById('fps-badge');
const brandVid   = document.getElementById('brand-vid');
const els = {
    persons: document.getElementById('stat-persons'),
    fps:     document.getElementById('stat-fps'),
    rows:    document.getElementById('stat-rows'),
    cols:    document.getElementById('stat-cols'),
    safe:    document.getElementById('cell-safe'),
    high:    document.getElementById('cell-high'),
    crit:    document.getElementById('cell-crit'),
};

// ── Helper utils ──────────────────────────────────────────────────────────────
function getTier(s) {
    const u = s.toUpperCase();
    return u.includes('CRITICAL') ? 'critical'
         : u.includes('HIGH') || u.includes('WARNING') || u.includes('ELEVATED') ? 'elevated'
         : 'normal';
}
function riskTier(n) { return n >= 65 ? 'high' : n >= 35 ? 'mid' : 'low'; }
const icons = { normal: '🟢', elevated: '🟠', critical: '🔴' };

// ── Optical Flow Overlay Toggle ───────────────────────────────────────────────
let _flowOverlayOn = false;
async function toggleFlowOverlay() {
    _flowOverlayOn = !_flowOverlayOn;
    const endpoint = _flowOverlayOn ? '/api/flow-overlay/on' : '/api/flow-overlay/off';
    await fetch(endpoint, { method: 'POST' });
    const btn = document.getElementById('flow-toggle-btn');
    btn.classList.toggle('active', _flowOverlayOn);
    btn.textContent = _flowOverlayOn ? '🌊 Flow ON' : '🌊 Flow Vectors';
}

// ── Browser Notification Permission ─────────────────────────────────────────
// Restore button/chip state if permission was already granted in a previous session
if ('Notification' in window && Notification.permission === 'granted') {
    const btn = document.getElementById('push-enable-btn');
    if (btn) { btn.textContent = '\u2705 Alerts Active'; btn.classList.add('granted'); btn.disabled = true; }
    const chip = document.getElementById('push-chip');
    if (chip) { chip.classList.add('armed'); chip.title = 'Browser alerts enabled'; }
}

// ── Go Home: save session config for landing page to restore ──────────────────
async function goHome() {
    try {
        const cfg = await fetch('/api/session-config').then(r => r.json());
        localStorage.setItem('crm-last-session-config', JSON.stringify(cfg));
    } catch(e) { /* still navigate even if fetch fails */ }
    window.location.href = '/';
}

// ── Alert Panel UI ───────────────────────────────────────────────────────────
const ALERT_NONE     = 0;
const ALERT_HIGH     = 1;
const ALERT_CRITICAL = 2;

function updateAlertPanel(status) {
    if (!status) return;

    // ── Channel arm chips ────────────────────────────────────────────────
    const smsChip  = document.getElementById('sms-chip');
    const pushChip = document.getElementById('push-chip');
    if (smsChip)  smsChip.classList.toggle('armed', status.sms_armed && status.sms_enabled);
    if (smsChip)  smsChip.title  = status.sms_armed
        ? (status.sms_enabled
            ? `SMS armed \u2014 ${status.sms_recipients} recipient(s)`
            : 'SMS configured but toggle is OFF \u2014 flip the switch to enable')
        : 'SMS: not configured (check .env)';
    // Notif chip reflects browser permission state (all client-side now)
    if (pushChip) {
        const notifOn = 'Notification' in window && Notification.permission === 'granted';
        pushChip.classList.toggle('armed', notifOn);
        pushChip.title = notifOn ? 'Browser alerts enabled' : 'Click "Enable Alerts" to activate';
    }

    // ── Alert level badge ──────────────────────────────────────────────
    const badge = document.getElementById('alert-level-badge');
    if (badge) {
        if (status.current_level === ALERT_CRITICAL) {
            badge.className   = 'alert-level-badge critical';
            badge.textContent = '🚨 CRITICAL ALERT FIRED';
        } else if (status.current_level === ALERT_HIGH) {
            badge.className   = 'alert-level-badge high';
            badge.textContent = '⚠️ HIGH WARNING FIRED';
        } else {
            badge.className   = 'alert-level-badge';
            badge.textContent = '✅ Monitoring';
        }
    }

    // ── Cooldown countdown ────────────────────────────────────────────────
    const cooldownEl = document.getElementById('alert-cooldown');
    const timerEl    = document.getElementById('cooldown-timer');
    if (cooldownEl && timerEl) {
        if (status.cooldown_remaining > 0) {
            const m = Math.floor(status.cooldown_remaining / 60);
            const s = status.cooldown_remaining % 60;
            timerEl.textContent      = m > 0 ? `${m}m ${s}s` : `${s}s`;
            cooldownEl.style.display = 'block';
        } else {
            cooldownEl.style.display = 'none';
        }
    }

    // ── Sync SMS toggle state from server ────────────────────────────────────
    const smsToggle = document.getElementById('sms-alerts-toggle');
    if (smsToggle && smsToggle.checked !== !!status.sms_enabled) {
        smsToggle.checked = !!status.sms_enabled;
    }
}


// ── SMS Alert Toggle ──────────────────────────────────────────────────────────
async function toggleSmsAlerts(checkbox) {
    const endpoint = checkbox.checked ? '/api/sms-alerts/on' : '/api/sms-alerts/off';
    try {
        await fetch(endpoint, { method: 'POST' });
        console.log('[CRM] SMS alerts', checkbox.checked ? 'ENABLED' : 'DISABLED');
    } catch (e) {
        console.error('[CRM] SMS toggle failed:', e);
        checkbox.checked = !checkbox.checked; // revert on failure
    }
}


async function enableBrowserAlerts() {
    const btn = document.getElementById('push-enable-btn');

    if (!('Notification' in window)) {
        alert('Your browser does not support notifications.');
        return;
    }
    if (Notification.permission === 'granted') {
        btn.textContent = '\u2705 Alerts Active';
        btn.classList.add('granted');
        btn.disabled = true;
        return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        btn.textContent = '\u2705 Alerts Active';
        btn.classList.add('granted');
        btn.disabled = true;
        const chip = document.getElementById('push-chip');
        if (chip) { chip.classList.add('armed'); chip.title = 'Browser alerts enabled'; }
        // Confirmation notification
        new Notification('\u2705 Crowd Risk Monitor Alerts Active', {
            body: 'You will be notified when crowd risk reaches HIGH or CRITICAL levels.',
        });
        console.log('[CRM] Browser notifications enabled.');
    } else {
        alert('Notification permission denied. Please allow notifications in your browser settings.');
    }
}

// ── Client-side notification cooldown (mirrors server-side timers) ────────────
let _lastNotifTimestamp = 0;
const HIGH_NOTIF_CD_MS = 180_000;   // 3 min — mirrors HIGH_COOLDOWN in alerter.py
const CRIT_NOTIF_CD_MS =  90_000;   // 90s  — mirrors CRITICAL_COOLDOWN

function maybeFireNotification(level, score, count) {
    if (!('Notification' in window) || Notification.permission !== 'granted' || level === 0) return;
    const now = Date.now();
    const cd  = level === ALERT_CRITICAL ? CRIT_NOTIF_CD_MS : HIGH_NOTIF_CD_MS;
    if (now - _lastNotifTimestamp < cd) return;
    _lastNotifTimestamp = now;
    const isCrit = level === ALERT_CRITICAL;
    new Notification(
        isCrit ? '\uD83D\uDEA8 CRITICAL STAMPEDE RISK' : '\u26A0\uFE0F High Crowd Density Warning',
        {
            body: `Risk Score: ${score}/100 \u2014 ${count} persons detected.` +
                  (isCrit ? ' IMMEDIATE ACTION REQUIRED.' : ' Monitor closely.'),
            icon:               '/static/icons/alert-icon.png',
            requireInteraction: isCrit,
        }
    );
}

async function fireTestAlert() {
    const btn = document.getElementById('test-alert-btn');
    btn.disabled    = true;
    btn.textContent = 'Sending\u2026';
    try {
        const res  = await fetch('/api/alert-test', { method: 'POST' });
        const data = await res.json();
        btn.textContent = '\u2705 Sent!';
        setTimeout(() => { btn.textContent = '\uD83D\uDEA8 Test'; btn.disabled = false; }, 3000);
    } catch (e) {
        btn.textContent = '\u274C Failed';
        setTimeout(() => { btn.textContent = '\uD83D\uDEA8 Test'; btn.disabled = false; }, 3000);
    }
    // Also fire a browser notification immediately (bypass client cooldown for test)
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('\uD83D\uDEA8 CRITICAL STAMPEDE RISK [TEST]', {
            body: 'Risk Score: 82/100 \u2014 47 persons detected. IMMEDIATE ACTION REQUIRED.',
            requireInteraction: true,
        });
    }
}

// ── Live stats polling ────────────────────────────────────────────────────────
const session = { low: 0, mid: 0, high: 0, totalRisk: 0, polls: 0, avgPersons: 0 };
let pollTimer = null;

function startPolling() {
    async function poll() {
        try {
            const d = await fetch('/api/stats').then(r => r.json());
            if (!d.active) return;

            const tier  = getTier(d.status);
            const rt    = riskTier(d.risk_score);
            const total = (d.grid_rows || 1) * (d.grid_cols || 1);
            const safe  = Math.max(0, total - d.high_cells - d.critical_cells);

            statusCard.className      = `card status-card ${tier}`;
            statusIcon.textContent    = icons[tier];
            statusText.textContent    = d.status;
            statusText.className      = `status-text ${tier}`;
            riskNumber.textContent    = d.risk_score.toFixed(1);
            riskNumber.className      = `risk-number ${rt}`;
            gaugeFill.style.width     = `${d.risk_score}%`;
            gaugeFill.className       = `gauge-fill ${rt}`;
            fpsBadge.textContent      = `FPS: ${d.fps}`;
            brandVid.textContent      = d.current_video || '—';
            els.persons.textContent   = d.person_count;
            els.fps.textContent       = d.fps;
            els.rows.textContent      = d.grid_rows;
            els.cols.textContent      = d.grid_cols;
            els.safe.textContent      = safe;
            els.high.textContent      = d.high_cells;
            els.crit.textContent      = d.critical_cells;

            // ── Crowd Pressure gauge ──────────────────────────────────────
            if (d.avg_pressure !== undefined) {
                const p      = d.avg_pressure;
                const CIRC   = 188; // 2π × r=30
                const offset = CIRC - (p / 100) * CIRC;
                const pfill  = document.getElementById('pressure-fill');
                const pnum   = document.getElementById('pressure-num');
                const pstat  = document.getElementById('pressure-status');
                const pdesc  = document.getElementById('pressure-desc');

                pfill.style.strokeDashoffset = offset.toFixed(1);
                pnum.textContent = Math.round(p);

                if (p >= 50) {
                    pfill.style.stroke = '#ef4444';
                    pstat.className    = 'pressure-status high';
                    pstat.textContent  = '⚠ Crush Risk';
                    pdesc.textContent  = 'High density + directional chaos detected. Physical crush pressure is critical.';
                } else if (p >= 25) {
                    pfill.style.stroke = '#f97316';
                    pstat.className    = 'pressure-status mod';
                    pstat.textContent  = '⚡ Moderate';
                    pdesc.textContent  = 'Elevated pressure — crowd is dense with some directional conflict.';
                } else {
                    pfill.style.stroke = '#22c55e';
                    pstat.className    = 'pressure-status';
                    pstat.textContent  = 'Safe';
                    pdesc.textContent  = 'Low density & chaos — no crush risk detected.';
                }
            }

            // ── Divergence ────────────────────────────────────────────────
            if (d.avg_divergence !== undefined) {
                const divVal   = d.avg_divergence;
                const divBar   = document.getElementById('div-bar');
                const divBadge = document.getElementById('div-badge');
                const divDesc  = document.getElementById('div-desc');
                const divPct   = Math.min(100, Math.max(0, (divVal + 0.5) / 1.0 * 100));
                divBar.style.width = divPct + '%';

                if (divVal < -0.05) {
                    divBar.style.background   = '#ef4444';
                    divBadge.style.background = 'rgba(239,68,68,0.15)';
                    divBadge.style.color      = '#ef4444';
                    divBadge.textContent      = '⚠ Squeezing';
                    divDesc.textContent       = 'Crowd converging inward — potential crush zone forming.';
                } else if (divVal > 0.05) {
                    divBar.style.background   = '#22c55e';
                    divBadge.style.background = 'rgba(34,197,94,0.15)';
                    divBadge.style.color      = '#22c55e';
                    divBadge.textContent      = 'Dispersing';
                    divDesc.textContent       = 'Crowd spreading outward — safe flow detected.';
                } else {
                    divBar.style.background   = '#f97316';
                    divBadge.style.background = 'rgba(249,115,22,0.15)';
                    divBadge.style.color      = '#f97316';
                    divBadge.textContent      = '~ Neutral';
                    divDesc.textContent       = 'Balanced flow — no dominant directional surge.';
                }
            }

            // ── Curl ──────────────────────────────────────────────────────
            if (d.avg_curl !== undefined) {
                const curlVal  = d.avg_curl;
                const curlBar  = document.getElementById('curl-bar');
                const curlNum  = document.getElementById('curl-num');
                const curlDesc = document.getElementById('curl-desc');
                const curlPct  = Math.min(100, (curlVal / 0.5) * 100);
                curlBar.style.width = curlPct + '%';
                curlNum.textContent = curlVal.toFixed(3);

                if (curlPct > 60) {
                    curlBar.style.background  = '#ef4444';
                    curlDesc.textContent      = 'High rotational turbulence — swirling vortex pattern in crowd.';
                    curlDesc.style.color      = '#ef4444';
                } else if (curlPct > 25) {
                    curlBar.style.background  = '#f97316';
                    curlDesc.textContent      = 'Moderate swirl — some rotational conflict at bottleneck edges.';
                    curlDesc.style.color      = '#f97316';
                } else {
                    curlBar.style.background  = 'var(--blue)';
                    curlDesc.textContent      = 'No significant rotational swirl detected.';
                    curlDesc.style.color      = 'var(--text-muted)';
                }
            }

            // Push to chart
            chartLabels.push('');
            chartData.push(d.risk_score);
            if (chartData.length > MAX_POINTS) { chartLabels.shift(); chartData.shift(); }
            riskChart.update();

            // Accumulate session stats
            session.polls++;
            session.totalRisk  += d.risk_score;
            session.avgPersons += d.person_count;
            if (rt === 'high')      session.high++;
            else if (rt === 'mid')  session.mid++;
            else                    session.low++;

            // ── Calibration card ──────────────────────────────────────────
            if (d.calib_mode !== undefined) {
                const badge  = document.getElementById('calib-badge');
                const track  = document.getElementById('calib-progress-track');
                const fill   = document.getElementById('calib-progress-fill');
                const chipD  = document.getElementById('chip-density');
                const chipM  = document.getElementById('chip-motion');

                chipD.textContent = (d.density_weight ?? 70) + '%';
                chipM.textContent = (d.motion_weight  ?? 30) + '%';

                if (d.calib_status === 'calibrating') {
                    badge.className   = 'calib-status-badge calibrating';
                    badge.textContent = `⏳ Calibrating… (${d.calib_samples_collected || 0}/${d.calib_sample_target || '?'})`;
                    track.style.display = 'block';
                    const pct = Math.min(95, Math.round(
                        ((d.calib_samples_collected || 0) / (d.calib_sample_target || 100)) * 100
                    ));
                    fill.style.width = pct + '%';
                } else if (d.calib_status === 'done') {
                    badge.className   = 'calib-status-badge done';
                    badge.textContent = '✅ Calibrated';
                    track.style.display = 'none';
                } else {
                    badge.className   = 'calib-status-badge preset';
                    badge.textContent = '⚙ Preset 70/30';
                    track.style.display = 'none';
                }
            }

            // ── Alert Panel + Browser Notification (client-side, no service worker) ──
            if (d.alert_status) {
                updateAlertPanel(d.alert_status);
                maybeFireNotification(d.alert_status.current_level, d.risk_score, d.person_count);
            }

        } catch (_) {}
    }
    poll();
    pollTimer = setInterval(poll, 500);
}

startPolling();

// ── Theme toggle ──────────────────────────────────────────────────────────────
const themeBtn = document.getElementById('theme-btn');
function applyTheme(light) {
    document.body.classList.toggle('light', light);
    themeBtn.textContent = light ? '🌙' : '☀️';
    themeBtn.title = light ? 'Switch to dark mode' : 'Switch to light mode';
}
function toggleTheme() {
    const isLight = !document.body.classList.contains('light');
    localStorage.setItem('crm-theme', isLight ? 'light' : 'dark');
    applyTheme(isLight);
}
applyTheme(localStorage.getItem('crm-theme') === 'light');

// ── Calibration toggle ────────────────────────────────────────────────────────
async function toggleCalib(checkbox) {
    const endpoint = checkbox.checked ? '/api/calibration-mode/on' : '/api/calibration-mode/off';
    await fetch(endpoint, { method: 'POST' });
    if (!checkbox.checked) {
        document.getElementById('chip-density').textContent = '70%';
        document.getElementById('chip-motion').textContent  = '30%';
        const badge = document.getElementById('calib-badge');
        badge.className   = 'calib-status-badge preset';
        badge.textContent = '⚙ Preset 70/30';
        document.getElementById('calib-progress-track').style.display = 'none';
    } else {
        const badge = document.getElementById('calib-badge');
        badge.className   = 'calib-status-badge calibrating';
        badge.textContent = '⏳ Waiting for next upload…';
    }
}

// Sync toggle state from server on page load
fetch('/api/stats').then(r => r.json()).then(d => {
    const toggle = document.getElementById('calib-toggle');
    if (toggle && d.calib_mode !== undefined) toggle.checked = d.calib_mode;
}).catch(() => {});

// ── Stop / Cancel ─────────────────────────────────────────────────────────────
async function stopAnalysis() {
    document.getElementById('stop-btn').disabled = true;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }

    try {
        const res  = await fetch('/cancel', { method: 'POST' });
        const data = await res.json();

        const total   = session.polls || 1;
        const pctLow  = Math.round((session.low  / total) * 100);
        const pctMid  = Math.round((session.mid  / total) * 100);
        const pctHigh = Math.round((session.high / total) * 100);
        const avgRisk = session.polls > 0 ? (session.totalRisk / session.polls).toFixed(1) : '0';

        const peakEl = document.getElementById('modal-peak');
        peakEl.textContent = `${data.peak_risk}`;
        peakEl.className   = `modal-stat-value ${data.peak_risk >= 65 ? 'red' : data.peak_risk >= 35 ? 'orange' : 'green'}`;

        const avgEl = document.getElementById('modal-avg');
        avgEl.textContent = avgRisk;
        avgEl.className   = `modal-stat-value ${Number(avgRisk) >= 65 ? 'red' : Number(avgRisk) >= 35 ? 'orange' : 'green'}`;

        document.getElementById('modal-duration').textContent = `${data.duration_s}s`;
        document.getElementById('modal-frames').textContent   = data.frames;

        const peakStatEl  = document.getElementById('modal-peak-status');
        const peakTier    = data.peak_status.toUpperCase().includes('CRITICAL') ? 'red'
                          : data.peak_status.toUpperCase().includes('HIGH') ? 'orange' : 'green';
        peakStatEl.textContent  = data.peak_status.replace('CRITICAL RISK', 'CRITICAL').replace('Normal', 'NORMAL');
        peakStatEl.className    = `modal-stat-value ${peakTier}`;
        peakStatEl.style.fontSize = '0.85rem';

        document.getElementById('dist-green').style.width      = `${pctLow}%`;
        document.getElementById('dist-orange').style.width     = `${pctMid}%`;
        document.getElementById('dist-red').style.width        = `${pctHigh}%`;
        document.getElementById('dist-pct-green').textContent  = `${pctLow}%`;
        document.getElementById('dist-pct-orange').textContent = `${pctMid}%`;
        document.getElementById('dist-pct-red').textContent    = `${pctHigh}%`;

        document.getElementById('modal-overlay').classList.add('active');

    } catch (err) {
        alert('Failed to stop: ' + err.message);
        document.getElementById('stop-btn').disabled = false;
    }
}
