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

  const tk = {
    pageBg:     dark ? '#0F111A' : '#F0EEE9',
    sidebarBg:  dark ? '#161929' : '#FAFAF8',
    cardBg:     dark ? '#1C1F2E' : '#FFFFFF',
    border:     dark ? '#232840' : '#E8E5DF',
    divider:    dark ? '#1E2235' : '#F0EDE8',
    heading:    dark ? '#EDEDF0' : '#111111',
    body:       dark ? '#8890A4' : '#666666',
    muted:      dark ? '#525870' : '#AAAAAA',
    alt:        dark ? '#232840' : '#F5F3EE',
    hoverBg:    dark ? 'rgba(255,255,255,0.03)' : '#F5F3EE',
    activeCard: dark ? 'rgba(29,78,216,0.12)' : '#EEF2FF',
    activeBorder: dark ? 'rgba(29,78,216,0.4)' : '#BFDBFE',
    blueBg:     dark ? 'rgba(29,78,216,0.12)' : '#EEF2FF',
    blueText:   '#1D4ED8',
    shadow:     dark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
    tableHead:  dark ? '#161929' : '#F5F3EE',
    tableRow:   dark ? 'rgba(255,255,255,0.02)' : '#FAFAF8',
    cyan:       dark ? '#00d4ff' : '#0284C7',
  };

  // PDF export: inject a print stylesheet, trigger window.print(), then clean up
  const handleExportPDF = () => {
    if (!displayEntry) return;
    setExporting(true);

    const styleId = 'arise-print-style';
    if (document.getElementById(styleId)) document.getElementById(styleId)!.remove();

    const obsHeaders = displayEntry.observations.length > 0
      ? Object.keys(displayEntry.observations[0])
      : [];

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
          
          <!-- Header -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #111">
            <div>
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#666;margin-bottom:6px">
                ARISE — Virtual Science Lab
              </div>
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

          <!-- Observations -->
          <div style="margin-bottom:32px">
            <h2 style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#444;margin-bottom:12px;display:flex;align-items:center;gap:8px">
              <span style="display:inline-block;width:3px;height:16px;background:#1D4ED8;border-radius:2px"></span>
              Recorded Observations
            </h2>
            ${obsHeaders.length === 0 ? `<p style="color:#888;font-size:13px">No observations recorded.</p>` : `
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead>
                <tr style="background:#F5F3EE">
                  <th style="padding:9px 12px;text-align:left;font-family:monospace;color:#888;font-weight:700;border-bottom:1px solid #ddd">#</th>
                  ${obsHeaders.map(h => `<th style="padding:9px 12px;text-align:left;color:#111;font-weight:700;border-bottom:1px solid #ddd">${h}</th>`).join('')}
                </tr>
              </thead>
              <tbody>${obsRows}</tbody>
            </table>`}
          </div>

          <!-- Procedure -->
          <div>
            <h2 style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#444;margin-bottom:12px;display:flex;align-items:center;gap:8px">
              <span style="display:inline-block;width:3px;height:16px;background:#7C3AED;border-radius:2px"></span>
              Procedure Completion
            </h2>
            <div style="background:#F5F3EE;border-radius:10px;padding:14px 16px;font-size:13px;color:#444">
              ${stepsText}
            </div>
          </div>

          <!-- Footer -->
          <div style="margin-top:48px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#aaa;display:flex;justify-content:space-between">
            <span>ARISE Virtual Science Lab — Lab Journal Export</span>
            <span>Printed ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      </div>
    `;

    // Inject print overlay + CSS
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

    // Short delay so DOM paints, then print
    setTimeout(() => {
      window.print();
      // Cleanup after print dialog closes
      setTimeout(() => {
        document.getElementById('arise-print-wrapper')?.remove();
        document.getElementById(styleId)?.remove();
        setExporting(false);
      }, 500);
    }, 100);
  };

  return (
    <div style={{
      display: 'flex', height: '100%', minHeight: 'calc(100vh - 58px)',
      background: tk.pageBg, transition: 'background 0.3s',
    }}>

      {/* Sidebar */}
      <div style={{
        width: 300, flexShrink: 0,
        background: tk.sidebarBg, borderRight: `1px solid ${tk.border}`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transition: 'background 0.3s',
      }}>
        {/* Sidebar header */}
        <div style={{
          padding: '16px 18px', borderBottom: `1px solid ${tk.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: tk.heading }}>Lab Journal</div>
            <div style={{ fontSize: 11, color: tk.muted, marginTop: 2 }}>
              {journalEntries.length} {journalEntries.length === 1 ? 'entry' : 'entries'}
            </div>
          </div>
          <Link to="/dashboard" style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 12, fontWeight: 600, color: tk.muted, textDecoration: 'none',
            transition: 'color 0.2s',
          }}
            onMouseEnter={e => (e.currentTarget.style.color = tk.heading)}
            onMouseLeave={e => (e.currentTarget.style.color = tk.muted)}
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
              <div style={{ fontSize: 32, marginBottom: 12 }}>🧪</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: tk.heading, marginBottom: 6 }}>No entries yet</div>
              <div style={{ fontSize: 12, color: tk.muted, lineHeight: 1.6 }}>
                Complete a lab experiment and save your observations to see them here.
              </div>
              <Link to="/labs" style={{
                display: 'inline-block', marginTop: 16, padding: '8px 16px',
                background: '#1D4ED8', color: '#fff', fontSize: 12, fontWeight: 700,
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
                      padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                      border: `1px solid ${isActive ? tk.activeBorder : tk.border}`,
                      background: isActive ? tk.activeCard : 'transparent',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = tk.hoverBg; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: tk.heading, flex: 1, marginRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.lab}
                      </div>
                      <span style={{
                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                        padding: '2px 7px', borderRadius: 999,
                        background: dark ? 'rgba(5,150,105,0.15)' : '#ECFDF5',
                        color: dark ? '#6EE7B7' : '#065F46',
                        flexShrink: 0,
                      }}>Saved</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: tk.muted }}>
                      <span>{entry.date}</span>
                      <span style={{ fontWeight: 700, color: isActive ? tk.blueText : tk.muted }}>
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

      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px' }}>
        {!displayEntry ? (
          <div style={{
            height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: tk.muted, fontSize: 14,
          }}>
            Select an entry from the list to view details.
          </div>
        ) : (
          <motion.div
            key={displayEntry.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            style={{ maxWidth: 780, margin: '0 auto' }}
          >
            {/* Entry header card */}
            <div style={{
              background: tk.cardBg, border: `1px solid ${tk.border}`,
              borderRadius: 16, padding: '24px 28px', marginBottom: 16,
              boxShadow: tk.shadow,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 800, color: tk.heading, marginBottom: 8, letterSpacing: '-0.3px' }}>
                    {displayEntry.lab}
                  </h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: tk.muted }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      {displayEntry.date}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      {formatTime(displayEntry.timeSeconds)}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18"/>
                      </svg>
                      {displayEntry.observations.length} observations
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                  {/* Score */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 36, fontWeight: 800, color: tk.blueText, lineHeight: 1, fontFamily: 'monospace' }}>
                      {displayEntry.score}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: tk.muted, marginTop: 3 }}>
                      pts scored
                    </div>
                  </div>

                  {/* Export PDF button */}
                  <button
                    onClick={handleExportPDF}
                    disabled={exporting}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '8px 14px', borderRadius: 9,
                      background: exporting
                        ? (dark ? 'rgba(255,255,255,0.06)' : '#F0EEE9')
                        : (dark ? 'rgba(29,78,216,0.15)' : '#EEF2FF'),
                      border: `1px solid ${dark ? 'rgba(29,78,216,0.3)' : '#BFDBFE'}`,
                      color: exporting ? tk.muted : tk.blueText,
                      fontSize: 12, fontWeight: 700,
                      cursor: exporting ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      if (!exporting) e.currentTarget.style.background = dark ? 'rgba(29,78,216,0.22)' : '#DBEAFE';
                    }}
                    onMouseLeave={e => {
                      if (!exporting) e.currentTarget.style.background = dark ? 'rgba(29,78,216,0.15)' : '#EEF2FF';
                    }}
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

            {/* Observations table */}
            <div style={{
              background: tk.cardBg, border: `1px solid ${tk.border}`,
              borderRadius: 16, overflow: 'hidden', marginBottom: 16, boxShadow: tk.shadow,
            }}>
              <div style={{
                padding: '14px 20px', borderBottom: `1px solid ${tk.border}`,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 3, height: 16, background: tk.blueText, borderRadius: 999 }}></div>
                <div style={{ fontSize: 13, fontWeight: 700, color: tk.heading }}>Recorded Observations</div>
              </div>

              {displayEntry.observations.length === 0 ? (
                <div style={{ padding: '24px 20px', fontSize: 13, color: tk.muted }}>
                  No observations were recorded for this session.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: tk.tableHead }}>
                        <th style={{ padding: '10px 16px', textAlign: 'left', color: tk.muted, fontFamily: 'monospace', fontWeight: 700, width: 40, borderBottom: `1px solid ${tk.border}` }}>#</th>
                        {Object.keys(displayEntry.observations[0]).map(key => (
                          <th key={key} style={{ padding: '10px 16px', textAlign: 'left', color: tk.heading, fontWeight: 700, borderBottom: `1px solid ${tk.border}` }}>
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayEntry.observations.map((row, i) => (
                        <tr key={i}
                          style={{ borderBottom: i < displayEntry.observations.length - 1 ? `1px solid ${tk.divider}` : 'none', transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = tk.hoverBg)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td style={{ padding: '10px 16px', color: tk.muted, fontFamily: 'monospace' }}>{i + 1}</td>
                          {Object.values(row).map((val: any, j) => (
                            <td key={j} style={{ padding: '10px 16px', color: tk.cyan, fontFamily: 'monospace', fontWeight: 600 }}>
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

            {/* Procedure completion */}
            <div style={{
              background: tk.cardBg, border: `1px solid ${tk.border}`,
              borderRadius: 16, overflow: 'hidden', boxShadow: tk.shadow,
            }}>
              <div style={{
                padding: '14px 20px', borderBottom: `1px solid ${tk.border}`,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 3, height: 16, background: '#7C3AED', borderRadius: 999 }}></div>
                <div style={{ fontSize: 13, fontWeight: 700, color: tk.heading }}>Procedure Completion</div>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  background: tk.alt, borderRadius: 10, padding: '14px 16px',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: displayEntry.completedSteps.length > 0
                      ? (dark ? 'rgba(5,150,105,0.15)' : '#ECFDF5')
                      : tk.blueBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}>
                    {displayEntry.completedSteps.length > 0 ? '✓' : '○'}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: tk.heading }}>
                      {displayEntry.completedSteps.length} procedure step{displayEntry.completedSteps.length !== 1 ? 's' : ''} completed
                    </div>
                    <div style={{ fontSize: 12, color: tk.muted, marginTop: 2 }}>
                      Steps {displayEntry.completedSteps.map(s => s + 1).join(', ')} were marked complete during this session.
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </motion.div>
        )}
      </div>

      {/* Spin keyframe for loading state */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}