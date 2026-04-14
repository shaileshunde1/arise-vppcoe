import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLabStore } from '../store/useLabStore';
import { useTheme } from '../contexts/ThemeContext';
import type { JournalEntry } from '../store/useLabStore';

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default function LabJournal() {
  const { journalEntries } = useLabStore();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const printRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(
    journalEntries[0] ?? null
  );

  const displayEntry = selectedEntry
    ? journalEntries.find(e => e.id === selectedEntry.id) ?? journalEntries[0] ?? null
    : journalEntries[0] ?? null;

  // PDF export logic — unchanged
  const handleExportPDF = () => {
    if (!displayEntry) return;
    setExporting(true);

    const styleId = 'arise-print-style';
    if (document.getElementById(styleId)) document.getElementById(styleId)!.remove();

    const obsHeaders = displayEntry.observations.length > 0 ? Object.keys(displayEntry.observations[0]) : [];

    const obsRows = displayEntry.observations.map((row, i) => `
      <tr>
        <td style="padding:7px 12px;color:#666;font-family:monospace;border-bottom:1px solid #eee">${i + 1}</td>
        ${Object.values(row).map((v: any) => `
          <td style="padding:7px 12px;font-family:monospace;color:#0284C7;border-bottom:1px solid #eee">
            ${typeof v === 'number' ? v.toFixed(3) : v}
          </td>
        `).join('')}
      </tr>
    `).join('');

    const stepsText = displayEntry.completedSteps.length > 0
      ? `Steps ${displayEntry.completedSteps.map(s => s + 1).join(', ')} completed`
      : 'No steps recorded';

    const printHTML = `
      <div id="arise-print-root" style="display:none;position:fixed;top:0;left:0;width:100%;z-index:99999;background:#fff">
        <div style="max-width:720px;margin:0 auto;padding:40px 48px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #111">
            <div>
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#666;margin-bottom:6px">ARISE — Virtual Science Lab</div>
              <h1 style="font-size:24px;font-weight:800;margin:0 0 8px;letter-spacing:-0.5px">${displayEntry.lab}</h1>
              <div style="font-size:13px;color:#666;display:flex;gap:20px">
                <span>📅 ${displayEntry.date}</span>
                <span>⏱ ${formatTime(displayEntry.timeSeconds)}</span>
                <span>🔬 ${displayEntry.observations.length} observation${displayEntry.observations.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div style="text-align:right">
              <div style="font-size:42px;font-weight:800;font-family:monospace;color:#1D4ED8;line-height:1">${displayEntry.score}</div>
              <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#888;margin-top:3px">pts scored</div>
            </div>
          </div>
          <div style="margin-bottom:32px">
            <h2 style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#444;margin-bottom:12px">Recorded Observations</h2>
            ${obsHeaders.length === 0 ? `<p style="color:#888;font-size:13px">No observations recorded.</p>` : `
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead><tr style="background:#F5F3EE">
                <th style="padding:9px 12px;text-align:left;font-family:monospace;color:#888;font-weight:700;border-bottom:1px solid #ddd">#</th>
                ${obsHeaders.map(h => `<th style="padding:9px 12px;text-align:left;color:#111;font-weight:700;border-bottom:1px solid #ddd">${h}</th>`).join('')}
              </tr></thead>
              <tbody>${obsRows}</tbody>
            </table>`}
          </div>
          <div>
            <h2 style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#444;margin-bottom:12px">Procedure Completion</h2>
            <div style="background:#F5F3EE;border-radius:10px;padding:14px 16px;font-size:13px;color:#444">${stepsText}</div>
          </div>
          <div style="margin-top:48px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#aaa;display:flex;justify-content:space-between">
            <span>ARISE Virtual Science Lab — Lab Journal Export</span>
            <span>Printed ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.id = 'arise-print-wrapper';
    wrapper.innerHTML = printHTML;
    document.body.appendChild(wrapper);

    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      @media print {
        body > *:not(#arise-print-wrapper) { display: none !important; }
        #arise-print-wrapper { display: block !important; }
        #arise-print-root { display: block !important; position: static !important; }
        @page { margin: 0; size: A4; }
      }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.getElementById('arise-print-wrapper')?.remove();
        document.getElementById(styleId)?.remove();
        setExporting(false);
      }, 500);
    }, 100);
  };

  return (
    <div className="arise-journal-layout" style={{
      display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 58px)',
      background: 'var(--surface)', transition: 'background 0.3s',
    }}>

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <div className="arise-journal-sidebar" style={{
        width: '100%', flexShrink: 0,
        background: 'var(--surface-container-low)',
        borderBottom: '1px solid rgba(66,73,79,0.2)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        maxHeight: 300,
        transition: 'background 0.3s',
      }}>
        {/* Sidebar header */}
        <div style={{
          padding: '20px 20px', borderBottom: '1px solid rgba(66,73,79,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <span className="font-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--secondary)', display: 'block', marginBottom: 4 }}>
              Lab Journal
            </span>
            <div className="serif" style={{ fontSize: 18, fontWeight: 300, color: 'var(--primary)' }}>
              {journalEntries.length} {journalEntries.length === 1 ? 'Entry' : 'Entries'}
            </div>
          </div>
          <Link to="/dashboard"
            className="font-label"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--on-surface-variant)', textDecoration: 'none', transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--on-surface-variant)')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Dashboard
          </Link>
        </div>

        {/* Entry list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {journalEntries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 16px' }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>🧪</div>
              <h3 className="serif" style={{ fontSize: 18, fontWeight: 300, color: 'var(--primary)', marginBottom: 8 }}>No entries yet</h3>
              <p className="font-body" style={{ fontSize: 13, color: 'var(--on-surface-variant)', lineHeight: 1.6, marginBottom: 20 }}>
                Complete a lab experiment and save your observations to see them here.
              </p>
              <Link to="/labs"
                className="font-label"
                style={{
                  display: 'inline-block', padding: '9px 20px',
                  background: 'var(--secondary)', color: 'var(--surface)',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                  borderRadius: 8, textDecoration: 'none',
                }}>
                Browse Labs
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {journalEntries.map(entry => {
                const isActive = displayEntry?.id === entry.id;
                return (
                  <div key={entry.id} onClick={() => setSelectedEntry(entry)}
                    style={{
                      padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                      border: `1px solid ${isActive ? 'rgba(135,160,192,0.4)' : 'rgba(66,73,79,0.15)'}`,
                      background: isActive ? 'rgba(135,160,192,0.08)' : 'transparent',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface-container)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div className="font-label" style={{
                        fontSize: 13, fontWeight: 700, color: 'var(--on-surface)',
                        flex: 1, marginRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {entry.lab}
                      </div>
                      <span className="font-label" style={{
                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                        padding: '2px 8px', borderRadius: 999, flexShrink: 0,
                        background: 'rgba(5,150,105,0.15)', color: '#6EE7B7',
                      }}>Saved</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="font-label" style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{entry.date}</span>
                      <span className="font-label" style={{ fontSize: 11, fontWeight: 700, color: isActive ? 'var(--secondary)' : 'var(--on-surface-variant)' }}>
                        {entry.score} pts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'clamp(16px, 4vw, 32px)' }}>
        {!displayEntry ? (
          <div style={{
            height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--on-surface-variant)',
          }}>
            <p className="font-body" style={{ fontSize: 14 }}>Select an entry from the list to view details.</p>
          </div>
        ) : (
          <motion.div
            key={displayEntry.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ maxWidth: 780, margin: '0 auto' }}
          >
            {/* ── Entry Header ───────────────────────────────── */}
            <div style={{
              background: 'var(--surface-container)', border: '1px solid rgba(66,73,79,0.2)',
              borderRadius: 16, padding: '28px 32px', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <span className="font-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--secondary)', display: 'block', marginBottom: 8 }}>
                    Lab Entry
                  </span>
                  <h1 className="serif" style={{ fontSize: 28, fontWeight: 300, color: 'var(--primary)', marginBottom: 12, letterSpacing: '-0.02em' }}>
                    {displayEntry.lab}
                  </h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    {[
                      { icon: <path d="M3 9h18M9 21V9M15 21V9M3 3h18v18H3z"/>, text: displayEntry.date },
                      { icon: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>, text: formatTime(displayEntry.timeSeconds) },
                      { icon: <><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18"/></>, text: `${displayEntry.observations.length} observations` },
                    ].map((item, i) => (
                      <span key={i} className="font-label" style={{ fontSize: 12, color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{item.icon}</svg>
                        {item.text}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
                  {/* Score */}
                  <div style={{ textAlign: 'right' }}>
                    <div className="serif" style={{ fontSize: 40, fontWeight: 300, color: 'var(--secondary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                      {displayEntry.score}
                    </div>
                    <div className="font-label" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--on-surface-variant)', marginTop: 4 }}>
                      pts scored
                    </div>
                  </div>

                  {/* Export PDF */}
                  <button onClick={handleExportPDF} disabled={exporting}
                    className="font-label"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '9px 16px', borderRadius: 10,
                      background: exporting ? 'var(--surface-container-high)' : 'rgba(135,160,192,0.12)',
                      border: '1px solid rgba(135,160,192,0.3)',
                      color: exporting ? 'var(--on-surface-variant)' : 'var(--secondary)',
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                      cursor: exporting ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { if (!exporting) e.currentTarget.style.background = 'rgba(135,160,192,0.2)'; }}
                    onMouseLeave={e => { if (!exporting) e.currentTarget.style.background = 'rgba(135,160,192,0.12)'; }}
                  >
                    {exporting ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                          <path d="M21 12a9 9 0 11-6.219-8.56"/>
                        </svg>
                        Preparing...
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Export PDF
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Observations Table ─────────────────────────── */}
            <div style={{
              background: 'var(--surface-container)', border: '1px solid rgba(66,73,79,0.2)',
              borderRadius: 16, overflow: 'hidden', marginBottom: 16,
            }}>
              <div style={{
                padding: '16px 24px', borderBottom: '1px solid rgba(66,73,79,0.15)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 3, height: 16, background: 'var(--secondary)', borderRadius: 999 }} />
                <span className="font-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--on-surface)' }}>
                  Recorded Observations
                </span>
              </div>

              {displayEntry.observations.length === 0 ? (
                <div style={{ padding: '28px 24px' }}>
                  <p className="font-body" style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>No observations were recorded for this session.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-container-low)' }}>
                        <th className="font-label" style={{ padding: '11px 18px', textAlign: 'left', color: 'var(--on-surface-variant)', fontWeight: 700, width: 40, borderBottom: '1px solid rgba(66,73,79,0.15)', fontSize: 11, letterSpacing: '0.06em' }}>#</th>
                        {Object.keys(displayEntry.observations[0]).map(key => (
                          <th key={key} className="font-label" style={{ padding: '11px 18px', textAlign: 'left', color: 'var(--on-surface)', fontWeight: 700, borderBottom: '1px solid rgba(66,73,79,0.15)', fontSize: 11, letterSpacing: '0.06em' }}>
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayEntry.observations.map((row, i) => (
                        <tr key={i}
                          style={{ borderBottom: i < displayEntry.observations.length - 1 ? '1px solid rgba(66,73,79,0.08)' : 'none', transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-container-high)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td className="font-label" style={{ padding: '11px 18px', color: 'var(--on-surface-variant)', fontFamily: 'monospace' }}>{i + 1}</td>
                          {Object.values(row).map((val: any, j) => (
                            <td key={j} className="font-label" style={{ padding: '11px 18px', color: 'var(--secondary)', fontFamily: 'monospace', fontWeight: 600 }}>
                              {typeof val === 'number' ? val.toFixed(3) : val}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Procedure Completion ──────────────────────── */}
            <div style={{
              background: 'var(--surface-container)', border: '1px solid rgba(66,73,79,0.2)',
              borderRadius: 16, overflow: 'hidden',
            }}>
              <div style={{
                padding: '16px 24px', borderBottom: '1px solid rgba(66,73,79,0.15)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 3, height: 16, background: 'var(--primary)', borderRadius: 999 }} />
                <span className="font-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--on-surface)' }}>
                  Procedure Completion
                </span>
              </div>
              <div style={{ padding: '20px 24px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  background: 'var(--surface-container-low)', borderRadius: 12, padding: '16px 20px',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                    background: displayEntry.completedSteps.length > 0 ? 'rgba(5,150,105,0.15)' : 'rgba(135,160,192,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                  }}>
                    {displayEntry.completedSteps.length > 0 ? '✓' : '○'}
                  </div>
                  <div>
                    <div className="font-label" style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', marginBottom: 4 }}>
                      {displayEntry.completedSteps.length} procedure step{displayEntry.completedSteps.length !== 1 ? 's' : ''} completed
                    </div>
                    <div className="font-body" style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                      Steps {displayEntry.completedSteps.map(s => s + 1).join(', ')} were marked complete during this session.
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </motion.div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 640px) {
          .arise-journal-layout { flex-direction: row !important; }
          .arise-journal-sidebar {
            width: 300px !important;
            max-height: none !important;
            border-bottom: none !important;
            border-right: 1px solid rgba(66,73,79,0.2) !important;
          }
        }
      `}</style>
    </div>
  );
}