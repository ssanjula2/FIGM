'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useNotifications } from '../src/hooks/useNotifications';
import { useGlobalSearch } from '../src/hooks/useGlobalSearch';

import { useScans } from '../src/hooks/useScans';

export default function HeaderBar() {
  const [framework, setFramework] = useState('Next.js');
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { isOpen: isSearchOpen, setIsOpen: setIsSearchOpen, query, setQuery, results, loading: searchLoading } = useGlobalSearch();
  const { records } = useScans();

  const dynamicScore = records.length > 0
    ? Math.round(records.reduce((acc, s) => acc + (s.qualityScore || 90), 0) / records.length)
    : 90;
  const passed = dynamicScore >= 70;

  return (
    <>
      <header className="header-bar-container">
        {/* Search Bar Trigger */}
        <div
          onClick={() => setIsSearchOpen(true)}
          style={{ position: 'relative', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <span style={{ position: 'absolute', left: '14px', color: '#64748b', fontSize: '14px' }}>🔍</span>
          <input
            type="text"
            readOnly
            placeholder="Search projects, reports, rules, users..."
            className="search-input"
            style={{ pointerEvents: 'none' }}
          />
          <div style={{ position: 'absolute', right: '12px', fontSize: '11px', color: '#94a3b8', background: 'rgba(255, 255, 255, 0.06)', padding: '2px 7px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.1)', fontWeight: 600 }}>
            ⌘K
          </div>
        </div>

        {/* Right Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* DevSecOps Live Quality Score Status Bar Badge */}
          <Link
            href="/history"
            style={{
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: passed ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: passed ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              color: passed ? '#34d399' : '#f87171',
              boxShadow: passed ? '0 0 16px rgba(16, 185, 129, 0.2)' : '0 0 16px rgba(239, 68, 68, 0.2)',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: passed ? '#34d399' : '#f87171', boxShadow: passed ? '0 0 10px #34d399' : '0 0 10px #f87171' }}></span>
            <span>🛡️ Quality Score: <b>{dynamicScore}% ({passed ? 'PASSED ✅' : 'FAILED ❌'})</b></span>
          </Link>

          {/* Framework Selector */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <select
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
              style={{
                padding: '7px 32px 7px 16px',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: 'rgba(15, 23, 42, 0.6)',
                color: '#38bdf8',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                outline: 'none',
                appearance: 'none',
                backdropFilter: 'blur(10px)',
              }}
            >
              <option value="Next.js" style={{ background: '#090d16', color: '#f8fafc' }}>• Next.js</option>
              <option value="React" style={{ background: '#090d16', color: '#f8fafc' }}>• React</option>
              <option value="Angular" style={{ background: '#090d16', color: '#f8fafc' }}>• Angular</option>
            </select>
            <span style={{ position: 'absolute', right: '12px', pointerEvents: 'none', fontSize: '10px', color: '#38bdf8' }}>⌄</span>
          </div>

          {/* Theme Button */}
          <Link
            href="/settings"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '15px',
              cursor: 'pointer',
              color: '#94a3b8',
              textDecoration: 'none',
            }}
            title="Settings & Theme"
          >
            ⚙️
          </Link>

          {/* Notification Bell */}
          <div style={{ position: 'relative' }}>
            <div
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              🔔
            </div>

            {unreadCount > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  minWidth: '16px',
                  height: '16px',
                  borderRadius: '10px',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  boxShadow: '0 0 8px #ef4444',
                }}
              >
                {unreadCount}
              </div>
            )}

            {/* Notification Dropdown Drawer */}
            {showNotifDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '48px',
                  right: '0',
                  width: '360px',
                  background: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '16px',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
                  padding: '16px',
                  zIndex: 50,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>Notifications</h4>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                      No notifications
                    </div>
                  ) : (
                    notifications.slice(0, 5).map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        style={{
                          background: n.read ? 'transparent' : 'rgba(56, 189, 248, 0.08)',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: '12px', fontWeight: n.read ? 600 : 800, color: '#f8fafc' }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                          {n.message}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px', marginTop: '10px', textAlign: 'center' }}>
                  <Link
                    href="/notifications"
                    onClick={() => setShowNotifDropdown(false)}
                    style={{ fontSize: '12px', color: '#38bdf8', textDecoration: 'none', fontWeight: 700 }}
                  >
                    View All Notifications &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <Link href="/profile" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0284c7, #a855f7)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '13px',
                boxShadow: '0 0 12px rgba(56, 189, 248, 0.4)',
              }}
            >
              L
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', lineHeight: 1.2 }}>
                LOGIN
              </div>
            </div>
          </Link>
        </div>
      </header>

      {/* Global Cmd+K Search Modal */}
      {isSearchOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3, 7, 18, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '100px',
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '20px',
              maxWidth: '650px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
              overflow: 'hidden',
            }}
          >
            {/* Input Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '18px', color: '#64748b' }}>🔍</span>
              <input
                type="text"
                autoFocus
                placeholder="Type to search projects, reports, rules, users..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  color: '#f8fafc',
                  fontSize: '16px',
                  fontWeight: 600,
                  outline: 'none',
                }}
              />
              <button
                onClick={() => setIsSearchOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '16px', cursor: 'pointer' }}
              >
                esc
              </button>
            </div>

            {/* Results Body */}
            <div style={{ maxHeight: '420px', overflowY: 'auto', padding: '16px 20px' }}>
              {searchLoading && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Searching FIGM Code Inspector registry...</div>
              )}

              {!searchLoading && query.trim() === '' && (
                <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                  Search across Projects, Scan Reports, 25 FIGM Guidelines, Repositories, and System Users.
                </div>
              )}

              {!searchLoading && query.trim() !== '' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Projects Results */}
                  {results.projects.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '8px' }}>
                        PROJECTS ({results.projects.length})
                      </div>
                      {results.projects.map((p: any) => (
                        <Link
                          key={p.id}
                          href="/projects"
                          onClick={() => setIsSearchOpen(false)}
                          style={{ display: 'block', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.04)', color: '#f8fafc', textDecoration: 'none', marginBottom: '6px' }}
                        >
                          <strong style={{ fontSize: '13px' }}>{p.name}</strong> &bull; <span style={{ color: '#38bdf8', fontSize: '12px' }}>{p.framework}</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Scans Results */}
                  {results.scans.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#a855f7', textTransform: 'uppercase', marginBottom: '8px' }}>
                        REPORTS & SCANS ({results.scans.length})
                      </div>
                      {results.scans.map((s: any) => (
                        <Link
                          key={s.id}
                          href={`/reports/${s.id}`}
                          onClick={() => setIsSearchOpen(false)}
                          style={{ display: 'block', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.04)', color: '#f8fafc', textDecoration: 'none', marginBottom: '6px' }}
                        >
                          <strong style={{ fontSize: '13px', fontFamily: 'JetBrains Mono' }}>{s.fileName}</strong> &bull; Score: <span style={{ color: '#22c55e' }}>{s.qualityScore}%</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Rules Results */}
                  {results.rules.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', marginBottom: '8px' }}>
                        FIGM SPECIFICATION RULES ({results.rules.length})
                      </div>
                      {results.rules.map((r: any) => (
                        <Link
                          key={r.ruleId}
                          href="/guidelines"
                          onClick={() => setIsSearchOpen(false)}
                          style={{ display: 'block', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.04)', color: '#f8fafc', textDecoration: 'none', marginBottom: '6px' }}
                        >
                          <strong style={{ fontSize: '13px', color: '#38bdf8' }}>[{r.ruleId}] {r.name}</strong>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{r.description}</div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Users Results */}
                  {results.users.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', marginBottom: '8px' }}>
                        ADMIN USERS REGISTRY ({results.users.length})
                      </div>
                      {results.users.map((u: any) => (
                        <Link
                          key={u.id}
                          href="/admin"
                          onClick={() => setIsSearchOpen(false)}
                          style={{ display: 'block', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.04)', color: '#f8fafc', textDecoration: 'none', marginBottom: '6px' }}
                        >
                          <strong style={{ fontSize: '13px' }}>{u.fullName}</strong> ({u.email}) &bull; <span style={{ color: '#ef4444' }}>{u.role}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
