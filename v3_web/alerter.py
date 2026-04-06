# =============================================================================
# v3_web/alerter.py — AlertManager
#
# Dual-channel real-time alert dispatcher for the Stampede Risk Monitor.
# Sends SMS via Twilio AND browser push notifications when risk thresholds
# are exceeded.
#
# Design principles:
#   1. NEVER block the video processing thread — all I/O runs in daemon threads.
#   2. Read ALL credentials from environment variables (.env) — never hardcode.
#   3. Two-tier alerting: HIGH warning (score >= 60) + CRITICAL alert (score >= 75).
#   4. Independent per-level cooldown timers to prevent alert spam.
# =============================================================================

import os
import json
import time
import threading 
import logging

logger = logging.getLogger(__name__)

# ── Alert level constants ─────────────────────────────────────────────────────
ALERT_NONE     = 0
ALERT_HIGH     = 1   # score >= HIGH_THR
ALERT_CRITICAL = 2   # score >= CRITICAL_THR

# ── Thresholds (risk score 0–100) ────────────────────────────────────────────
HIGH_THR     = 60.0   # send a warning SMS
CRITICAL_THR = 75.0   # send a full critical alert

# ── Cooldown durations (seconds) ─────────────────────────────────────────────
HIGH_COOLDOWN     = 180   # 3 minutes between HIGH alerts
CRITICAL_COOLDOWN = 90    # 90 seconds between CRITICAL alerts


class AlertManager:
    """
    Manages dual-channel alerts: Twilio SMS + Web Push notifications.

    Usage in app.py:
        from alerter import AlertManager
        alerter = AlertManager()           # reads .env automatically

    In processing_thread — OUTSIDE _lock:
        alerter.try_alert(last_global_score, last_scene_status, last_count)

    In /api/stats:
        data["alert_status"] = alerter.get_status()
    """

    def __init__(self):
        self._state_lock = threading.Lock()

        # ── Twilio SMS setup ─────────────────────────────────────────────────
        self._twilio_client = None
        self._twilio_from   = None
        self._phone_numbers = []

        try:
            from twilio.rest import Client
            sid    = os.environ.get("TWILIO_ACCOUNT_SID",  "").strip()
            token  = os.environ.get("TWILIO_AUTH_TOKEN",   "").strip()
            from_  = os.environ.get("TWILIO_FROM_NUMBER",  "").strip()
            phones = os.environ.get("ALERT_PHONE_NUMBERS", "").strip()

            if sid and token and from_ and phones:
                self._twilio_client = Client(sid, token)
                self._twilio_from   = from_
                self._phone_numbers = [p.strip() for p in phones.split(",") if p.strip()]
                logger.info(f"[alerter] ✅ Twilio SMS ready → {len(self._phone_numbers)} recipient(s)")
            else:
                logger.warning("[alerter] ⚠ Twilio not fully configured — SMS alerts disabled. "
                               "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, "
                               "ALERT_PHONE_NUMBERS in your .env file.")
        except ImportError:
            logger.warning("[alerter] ⚠ 'twilio' package not installed. Run: pip install twilio")

        # Browser notifications are now handled client-side by dashboard.js

        # ── Cooldown state ───────────────────────────────────────────────────
        self._last_high_alert     = 0.0   # epoch timestamp of last HIGH alert
        self._last_critical_alert = 0.0   # epoch timestamp of last CRITICAL alert
        self._current_level       = ALERT_NONE

        # ── SMS enabled flag (OFF by default — user must toggle on from dashboard) ───
        self._sms_enabled = False

    # =========================================================================
    # Public API
    # =========================================================================

    def try_alert(self, score: float, status: str, person_count: int):
        """
        Called from the video processing thread on every inference cycle.
        Determines if an alert should fire based on score thresholds and
        per-level cooldown timers. All network I/O happens in daemon threads.

        MUST be called OUTSIDE of _lock to avoid blocking the video stream.
        """
        now = time.time()

        # Determine intended level from numeric score (reliable, no string matching)
        if score >= CRITICAL_THR:
            target = ALERT_CRITICAL
        elif score >= HIGH_THR:
            target = ALERT_HIGH
        else:
            with self._state_lock:
                self._current_level = ALERT_NONE
            return   # No alert needed

        # Check cooldown and update timestamps atomically
        should_fire = False
        with self._state_lock:
            if target == ALERT_CRITICAL:
                if now - self._last_critical_alert >= CRITICAL_COOLDOWN:
                    self._last_critical_alert = now
                    self._last_high_alert     = now   # also reset HIGH timer
                    self._current_level       = ALERT_CRITICAL
                    should_fire               = True
            elif target == ALERT_HIGH:
                if now - self._last_high_alert >= HIGH_COOLDOWN:
                    self._last_high_alert = now
                    self._current_level   = ALERT_HIGH
                    should_fire           = True

        if not should_fire:
            return   # In cooldown — skip

        # Build human-readable messages
        if target == ALERT_CRITICAL:
            sms_body = (
                f"🚨 CRITICAL STAMPEDE RISK ALERT\n"
                f"Risk Score: {score:.0f}/100\n"
                f"Status: {status}\n"
                f"Persons detected: {person_count}\n"
                f"IMMEDIATE CROWD CONTROL ACTION REQUIRED."
            )
            push_payload = {
                "title": "🚨 CRITICAL STAMPEDE RISK",
                "body":  f"Score: {score:.0f}/100 — {person_count} persons. IMMEDIATE ACTION REQUIRED.",
                "score": score,
                "level": "critical",
            }
        else:
            sms_body = (
                f"⚠️ HIGH CROWD DENSITY WARNING\n"
                f"Risk Score: {score:.0f}/100\n"
                f"Status: {status}\n"
                f"Persons detected: {person_count}\n"
                f"Monitor situation closely."
            )
            push_payload = {
                "title": "⚠️ High Crowd Density Warning",
                "body":  f"Score: {score:.0f}/100 — {person_count} persons. Monitor closely.",
                "score": score,
                "level": "high",
            }

        level_str = "CRITICAL" if target == ALERT_CRITICAL else "HIGH"
        logger.info(f"[alerter] 🔔 {level_str} alert firing — score={score:.1f}, persons={person_count}")

        # Dispatch in background threads — never block the video loop
        if self._twilio_client and self._sms_enabled:
            threading.Thread(
                target=self._dispatch_sms, args=(sms_body,), daemon=True
            ).start()

        # Browser notification are fired client-side — no server push needed



    def force_test_alert(self):
        """Bypass all cooldowns and fire a test alert. Called by /api/alert-test."""
        with self._state_lock:
            self._last_high_alert     = 0.0
            self._last_critical_alert = 0.0
        self.try_alert(82.0, "⚠ CRITICAL RISK [TEST]", 47)

    def set_sms_enabled(self, enabled: bool):
        """Enable or disable SMS dispatch. Called from /api/sms-alerts/on|off."""
        self._sms_enabled = enabled
        state = "ENABLED" if enabled else "DISABLED"
        logger.info(f"[alerter] SMS alerts {state} by user")

    def get_status(self) -> dict:
        """
        Returns the current alert state for inclusion in /api/stats.
        The frontend reads this from the existing 500ms poll — no extra endpoints needed.
        Browser notifications are fired client-side by dashboard.js.
        """
        now = time.time()
        with self._state_lock:
            level    = self._current_level
            hi_ago   = now - self._last_high_alert
            crit_ago = now - self._last_critical_alert

        if level == ALERT_CRITICAL:
            remaining = max(0, int(CRITICAL_COOLDOWN - crit_ago))
        elif level == ALERT_HIGH:
            remaining = max(0, int(HIGH_COOLDOWN - hi_ago))
        else:
            remaining = 0

        return {
            "sms_armed":          self._twilio_client is not None,
            "sms_enabled":        self._sms_enabled,
            "current_level":      level,
            "cooldown_remaining": remaining,
            "sms_recipients":     len(self._phone_numbers),
        }

    # =========================================================================
    # Private dispatchers (run in daemon threads)
    # =========================================================================

    def _dispatch_sms(self, body: str):
        """Send SMS to all configured recipients via Twilio."""
        for number in self._phone_numbers:
            try:
                msg = self._twilio_client.messages.create(
                    body=body,
                    from_=self._twilio_from,
                    to=number,
                )
                logger.info(f"[alerter] ✅ SMS sent to {number} — SID: {msg.sid}")
            except Exception as e:
                logger.error(f"[alerter] ❌ SMS to {number} failed: {e}")


