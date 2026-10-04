'use client';

import React from 'react';
import { useNotifications } from '../../src/hooks/useNotifications';

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, clearAll } = useNotifications();

  const typeIcons: Record<string, string> = {
    SCAN_SUCCESS: '⚡',
    SCAN_FAILED: '❌',
    AI_FINISHED: '🤖',
    EXPORT_FINISHED: '📄',
    SECURITY_ALERT: '🛡️',
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
            Real-Time Activity Feed
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'rgba(0, 0, 0, 0.82)', margin: 0, letterSpacing: '-0.5px' }}>
            Notification Center
          </h1>
          <p style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '14px', marginTop: '6px', margin: 0 }}>
            System events, scan achievements, AI remediation completion, and security alerts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                background: 'rgba(96, 165, 250, 0.15)',
                border: '1px solid rgba(96, 165, 250, 0.3)',
                color: '#1d4ed8',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              ✓ Mark All Read ({unreadCount})
            </button>
          )}

          <button
            onClick={clearAll}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              background: '#b91c1c',
              border: '1px solid #b91c1c',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            🗑️ Clear History
          </button>
        </div>
      </div>

      {loading && (
        <div role="status" style={{ padding: '60px', textAlign: 'center', color: 'rgba(0, 0, 0, 0.7)' }}>
          Loading notification feed...
        </div>
      )}

      {!loading && notifications.length === 0 && (
        <div style={{ padding: '60px', textAlign: 'center', background: '#ffffff', borderRadius: '16px', border: '1px dashed rgba(0, 0, 0, 0.1)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔔</div>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'rgba(0, 0, 0, 0.82)', margin: 0 }}>No Notifications</h3>
          <p style={{ fontSize: '13px', color: 'rgba(0, 0, 0, 0.7)', marginTop: '6px' }}>Your notification feed is empty.</p>
        </div>
      )}

      {!loading && notifications.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notifications.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => markAsRead(n.id)}
                aria-label={`${n.read ? 'Notification' : 'Mark as read'}: ${n.title}. ${n.message}`}
                style={{
                  width: '100%',
                  background: n.read ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(16px)',
                  border: n.read ? '1px solid rgba(0, 0, 0, 0.05)' : '1px solid rgba(96, 165, 250, 0.3)',
                  borderRadius: '14px',
                  padding: '18px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  font: 'inherit',
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '24px' }} aria-hidden="true">{typeIcons[n.type] || '🔔'}</span>
                  <span>
                    <span style={{ display: 'block', fontSize: '14px', fontWeight: n.read ? 600 : 800, color: n.read ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.82)' }}>
                      {n.title} {!n.read && <span style={{ color: '#1d4ed8', fontSize: '10px', marginLeft: '6px' }}>● NEW</span>}
                    </span>
                    <span style={{ display: 'block', fontSize: '13px', color: 'rgba(0, 0, 0, 0.7)', marginTop: '4px' }}>{n.message}</span>
                    <span style={{ display: 'block', fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)', marginTop: '4px' }}>{new Date(n.createdAt).toLocaleString()}</span>
                  </span>
                </span>

                {!n.read && (
                  <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#60a5fa', boxShadow: '0 0 8px #60a5fa', flexShrink: 0 }} />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
