// =============================================================================
// sw.js — Service Worker for Browser Push Notifications
// Crowd Risk Monitor — Stampede Alert System
//
// This script runs in the browser background, even when the dashboard tab is
// minimized or hidden. It receives push events from the FastAPI backend and
// displays native OS notifications (Windows/Mac toasts).
// =============================================================================

self.addEventListener('push', function (event) {
    let payload = {
        title: '🚨 Stampede Risk Alert',
        body:  'High crowd risk detected — check the dashboard.',
        level: 'critical',
        score: 0,
    };

    // Parse JSON payload sent from the backend's _dispatch_push()
    if (event.data) {
        try {
            payload = { ...payload, ...event.data.json() };
        } catch (_) {
            payload.body = event.data.text();
        }
    }

    // Choose icon color/urgency based on level
    const isCritical = payload.level === 'critical';

    const options = {
        body:             payload.body,
        icon:             '/static/icons/alert-icon.png',   // gracefully ignored if missing
        badge:            '/static/icons/badge.png',
        tag:              'crowd-risk-alert',               // replaces previous notification
        renotify:         true,                             // re-vibrate even if tag matches
        requireInteraction: isCritical,                     // CRITICAL stays until dismissed
        vibrate:          isCritical ? [300, 100, 300, 100, 300] : [200, 100, 200],
        data: {
            url:   '/',
            score: payload.score,
            level: payload.level,
        },
        actions: [
            { action: 'view',    title: '📊 View Dashboard' },
            { action: 'dismiss', title: '✕ Dismiss' },
        ],
    };

    event.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});


// Handle notification click — open dashboard or dismiss
self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    if (event.action === 'dismiss') return;

    // Focus existing dashboard tab or open a new one
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
            for (const client of windowClients) {
                if (client.url.includes('/dashboard') && 'focus' in client) {
                    return client.focus();
                }
            }
            // No dashboard tab open — open one
            if (clients.openWindow) {
                return clients.openWindow('/dashboard');
            }
        })
    );
});


// Service worker install + activate (no-op caching — we're push-only)
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
