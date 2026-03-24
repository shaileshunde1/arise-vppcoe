import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { supabase } from '../lib/supabaseClient';

interface LeaderboardEntry {
  id: string;
  name: string;
  institution: string;
  year: string;
  class_division: string;
  totalScore: number;
  labsCompleted: number;
  lastActive: string;
  scoreHistory: number[]; // last 5 lab scores for sparkline
}

// Tiny sparkline SVG component
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const w = 52, h = 20;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
      {/* last dot */}
      {data.length > 0 && (() => {
        const last = data[data.length - 1];
        const lx = w;
        const ly = h - (last / max) * h;
        return <circle cx={lx} cy={ly} r="2.5" fill={color} />;
      })()}
    </svg>
  );
}

export default function Leaderboard() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { profile } = useUser();

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDivision, setFilterDivision] = useState('All');
  const [filterYear, setFilterYear] = useState('All');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const tk = {
    pageBg:    dark ? '#0F111A' : '#F0EEE9',
    cardBg:    dark ? '#1C1F2E' : '#FFFFFF',
    border:    dark ? '#232840' : '#E8E5DF',
    divider:   dark ? '#1E2235' : '#F0EDE8',
    heading:   dark ? '#EDEDF0' : '#111111',
    body:      dark ? '#8890A4' : '#666666',
    muted:     dark ? '#525870' : '#AAAAAA',
    alt:       dark ? '#161929' : '#F5F3EE',
    hoverBg:   dark ? 'rgba(255,255,255,0.03)' : '#FAFAF8',
    inputBg:   dark ? '#0F111A' : '#FAFAF8',
    shadow:    dark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
    theadBg:   dark ? '#161929' : '#F5F3EE',
    gridLine:  dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
    tooltipBg: dark ? '#1C1F2E' : '#FFFFFF',
  };

  const card: React.CSSProperties = {
    background: tk.cardBg,
    border: `1px solid ${tk.border}`,
    borderRadius: 16,
    boxShadow: tk.shadow,
    overflow: 'hidden',
  };

  useEffect(() => {
    const loadLeaderboard = async () => {
      setLoading(true);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, institution, year, class_division')
        .eq('role', 'student');

      if (!profiles) { setLoading(false); return; }

      const { data: journals } = await supabase
        .from('journal_entries')
        .select('user_id, score, created_at')
        .order('created_at', { ascending: true });

      // Aggregate per user
      const scoreMap: Record<string, {
        total: number; count: number; lastActive: string; history: number[];
      }> = {};
      if (journals) {
        journals.forEach(j => {
          if (!scoreMap[j.user_id]) {
            scoreMap[j.user_id] = { total: 0, count: 0, lastActive: j.created_at, history: [] };
          }
          scoreMap[j.user_id].total += j.score;
          scoreMap[j.user_id].count += 1;
          scoreMap[j.user_id].history.push(j.score);
          if (j.created_at > scoreMap[j.user_id].lastActive) {
            scoreMap[j.user_id].lastActive = j.created_at;
          }
        });
      }

      const leaderboard: LeaderboardEntry[] = profiles.map(p => ({
        id: p.id,
        name: p.name || 'Unknown',
        institution: p.institution || '—',
        year: p.year || '—',
        class_division: p.class_division || 'Unassigned',
        totalScore: scoreMap[p.id]?.total || 0,
        labsCompleted: scoreMap[p.id]?.count || 0,
        lastActive: scoreMap[p.id]?.lastActive || '',
        scoreHistory: (scoreMap[p.id]?.history || []).slice(-5),
      }));

      leaderboard.sort((a, b) => b.totalScore - a.totalScore);
      setEntries(leaderboard);
      setLoading(false);
    };
    loadLeaderboard();
  }, []);

  const formatActive = (dateStr: string) => {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (mins < 2) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const divisions = ['All', ...Array.from(new Set(entries.map(e => e.class_division).filter(d => d && d !== 'Unassigned')))];
  const years = ['All', ...Array.from(new Set(entries.map(e => e.year).filter(Boolean)))];

  const filtered = entries.filter(e => {
    const matchDiv = filterDivision === 'All' || e.class_division === filterDivision;
    const matchYear = filterYear === 'All' || e.year === filterYear;
    return matchDiv && matchYear;
  });

  const myRank = filtered.findIndex(e => e.id === profile?.id) + 1;

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return '#F59E0B';
    if (rank === 2) return '#94A3B8';
    if (rank === 3) return '#B45309';
    return tk.muted;
  };

  // Build score distribution buckets for chart
  const buckets = [
    { label: '0–99', min: 0, max: 99 },
    { label: '100–199', min: 100, max: 199 },
    { label: '200–299', min: 200, max: 299 },
    { label: '300–399', min: 300, max: 399 },
    { label: '400+', min: 400, max: Infinity },
  ];
  const distributionData = buckets.map(b => ({
    label: b.label,
    count: filtered.filter(e => e.totalScore >= b.min && e.totalScore <= b.max).length,
  }));

  return (
    <div style={{ minHeight: '100vh', background: tk.pageBg, transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: tk.heading, marginBottom: 4, letterSpacing: '-0.3px' }}>
              Leaderboard
            </h1>
            <p style={{ fontSize: 13, color: tk.body }}>
              Ranked by total score across all lab experiments.
            </p>
          </div>
          {myRank > 0 && (
            <div style={{
              background: dark ? 'rgba(29,78,216,0.12)' : '#EEF2FF',
              border: `1px solid ${dark ? 'rgba(29,78,216,0.3)' : '#C7D7FD'}`,
              borderRadius: 12, padding: '10px 18px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
                Your Rank
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: tk.heading, fontFamily: 'monospace' }}>
                #{myRank}
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={filterDivision} onChange={e => setFilterDivision(e.target.value)}
            style={{ background: tk.inputBg, border: `1px solid ${tk.border}`, color: tk.heading, borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer' }}>
            {divisions.map(d => <option key={d} value={d}>{d === 'All' ? 'All Divisions' : `Division ${d}`}</option>)}
          </select>
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
            style={{ background: tk.inputBg, border: `1px solid ${tk.border}`, color: tk.heading, borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer' }}>
            {years.map(y => <option key={y} value={y}>{y === 'All' ? 'All Classes' : `Class ${y}`}</option>)}
          </select>
          <div style={{ marginLeft: 'auto', fontSize: 13, color: tk.muted, display: 'flex', alignItems: 'center' }}>
            {filtered.length} student{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Top 3 Podium */}
        {!loading && filtered.length >= 3 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.08fr 1fr', gap: 12, marginBottom: 20, alignItems: 'end' }}>
            {([filtered[1], filtered[0], filtered[2]] as LeaderboardEntry[]).map((entry, podiumIdx) => {
              const actualRank = podiumIdx === 0 ? 2 : podiumIdx === 1 ? 1 : 3;
              const isFirst = actualRank === 1;
              const isMe = entry?.id === profile?.id;
              if (!entry) return <div key={podiumIdx} />;

              const podiumHeights = [80, 110, 65];
              return (
                <div key={entry.id} style={{
                  ...card,
                  padding: '20px 16px',
                  textAlign: 'center',
                  border: isFirst
                    ? `2px solid #F59E0B`
                    : isMe ? `2px solid #1D4ED8` : `1px solid ${tk.border}`,
                  position: 'relative',
                  overflow: 'visible',
                }}>
                  {isMe && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      fontSize: 9, fontWeight: 700, color: '#1D4ED8',
                      background: dark ? 'rgba(29,78,216,0.15)' : '#EEF2FF',
                      padding: '2px 6px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>You</div>
                  )}

                  {/* Podium base visual */}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: podiumHeights[podiumIdx],
                    background: isFirst
                      ? (dark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.04)')
                      : (dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'),
                    borderTop: `1px dashed ${isFirst ? 'rgba(245,158,11,0.2)' : tk.border}`,
                    borderRadius: '0 0 16px 16px',
                  }} />

                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{getRankDisplay(actualRank)}</div>
                    <div style={{
                      width: 46, height: 46, borderRadius: '50%', overflow: 'hidden',
                      margin: '0 auto 8px', border: `2.5px solid ${getRankColor(actualRank)}`,
                    }}>
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.name}`} alt="" style={{ width: '100%', height: '100%' }} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: tk.heading, marginBottom: 2 }}>{entry.name}</div>
                    <div style={{ fontSize: 11, color: tk.muted, marginBottom: 10 }}>{entry.institution}</div>

                    {/* Score trend */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                      <Sparkline data={entry.scoreHistory} color={getRankColor(actualRank)} />
                    </div>

                    <div style={{ fontSize: 20, fontWeight: 800, color: '#1D4ED8', fontFamily: 'monospace' }}>
                      {entry.totalScore.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 10, color: tk.muted, marginTop: 2 }}>
                      {entry.labsCompleted} lab{entry.labsCompleted !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Score distribution chart + Full table side-by-side (or stacked) */}
        <div style={{ display: 'grid', gridTemplateColumns: filtered.length > 0 ? '1fr 280px' : '1fr', gap: 16, marginBottom: 16, alignItems: 'start' }}>

          {/* Full table */}
          <div style={card}>
            {loading ? (
              <div style={{ padding: '48px', textAlign: 'center', color: tk.muted, fontSize: 14 }}>
                Loading leaderboard...
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🏆</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: tk.heading, marginBottom: 6 }}>No scores yet</div>
                <div style={{ fontSize: 13, color: tk.muted, marginBottom: 20 }}>
                  Complete lab experiments and save them to your journal to appear here.
                </div>
                <Link to="/labs" style={{
                  display: 'inline-block', padding: '9px 20px',
                  background: '#1D4ED8', color: '#fff',
                  fontSize: 13, fontWeight: 700, borderRadius: 9, textDecoration: 'none',
                }}>Browse Labs</Link>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: tk.theadBg }}>
                      {['Rank', 'Student', 'Class', 'Trend', 'Labs', 'Total Score', 'Last Active'].map(h => (
                        <th key={h} style={{
                          padding: '12px 16px', textAlign: h === 'Total Score' ? 'right' : 'left',
                          fontSize: 11, fontWeight: 700, color: tk.muted,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          borderBottom: `1px solid ${tk.border}`,
                          whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((entry, i) => {
                      const rank = i + 1;
                      const isMe = entry.id === profile?.id;
                      const isHighlighted = highlightedId === entry.id;
                      return (
                        <tr key={entry.id}
                          onMouseEnter={() => setHighlightedId(entry.id)}
                          onMouseLeave={() => setHighlightedId(null)}
                          style={{
                            borderBottom: `1px solid ${tk.divider}`,
                            background: isMe
                              ? (dark ? 'rgba(29,78,216,0.07)' : '#EEF2FF')
                              : isHighlighted ? tk.hoverBg : 'transparent',
                            transition: 'background 0.15s',
                          }}>
                          {/* Rank */}
                          <td style={{ padding: '13px 16px', width: 56 }}>
                            <span style={{
                              fontSize: rank <= 3 ? 18 : 13,
                              fontWeight: 800,
                              color: getRankColor(rank),
                              fontFamily: 'monospace',
                            }}>{getRankDisplay(rank)}</span>
                          </td>

                          {/* Student */}
                          <td style={{ padding: '13px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: `1.5px solid ${isMe ? '#1D4ED8' : tk.border}` }}>
                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.name}`} alt="" style={{ width: '100%', height: '100%' }} />
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: tk.heading, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                                  {entry.name}
                                  {isMe && (
                                    <span style={{ fontSize: 9, fontWeight: 700, color: '#1D4ED8', background: dark ? 'rgba(29,78,216,0.15)' : '#EEF2FF', padding: '1px 6px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.06em' }}>You</span>
                                  )}
                                </div>
                                <div style={{ fontSize: 11, color: tk.muted }}>{entry.institution}</div>
                              </div>
                            </div>
                          </td>

                          {/* Class */}
                          <td style={{ padding: '13px 16px', color: tk.body, whiteSpace: 'nowrap' }}>
                            {entry.year ? `Yr ${entry.year}` : '—'}
                            {entry.class_division !== 'Unassigned' && (
                              <span style={{ marginLeft: 6, fontSize: 11, color: tk.muted }}>{entry.class_division}</span>
                            )}
                          </td>

                          {/* Sparkline trend */}
                          <td style={{ padding: '13px 16px' }}>
                            <Sparkline data={entry.scoreHistory} color={isMe ? '#1D4ED8' : (dark ? '#525870' : '#94A3B8')} />
                          </td>

                          {/* Labs */}
                          <td style={{ padding: '13px 16px', color: tk.body, fontFamily: 'monospace', fontWeight: 600 }}>
                            {entry.labsCompleted}
                          </td>

                          {/* Score */}
                          <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                            <span style={{ fontSize: 15, fontWeight: 800, color: '#1D4ED8', fontFamily: 'monospace' }}>
                              {entry.totalScore > 0 ? entry.totalScore.toLocaleString() : '—'}
                            </span>
                          </td>

                          {/* Last active */}
                          <td style={{ padding: '13px 16px', color: tk.muted, fontSize: 12, whiteSpace: 'nowrap' }}>
                            {formatActive(entry.lastActive)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Score distribution sidebar */}
          {!loading && filtered.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Distribution chart */}
              <div style={{ ...card, padding: '18px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: tk.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                  Score Distribution
                </div>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distributionData} margin={{ left: -16, right: 4, top: 4, bottom: 0 }} barCategoryGap="20%">
                      <CartesianGridless />
                      <XAxis dataKey="label" tick={{ fill: tk.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: tk.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                        contentStyle={{ background: tk.tooltipBg, border: `1px solid ${tk.border}`, borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: tk.heading, fontWeight: 700 }}
                        formatter={(v: number) => [`${v} student${v !== 1 ? 's' : ''}`, 'Count']}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {distributionData.map((_, index) => (
                          <Cell key={index} fill={index === 0 ? '#94A3B8' : index === 1 ? '#60A5FA' : index === 2 ? '#3B82F6' : index === 3 ? '#2563EB' : '#1D4ED8'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Quick stats */}
              <div style={{ ...card, padding: '18px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: tk.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                  Class Stats
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    {
                      label: 'Avg Score',
                      value: filtered.length > 0
                        ? Math.round(filtered.reduce((s, e) => s + e.totalScore, 0) / filtered.filter(e => e.totalScore > 0).length || 0).toLocaleString()
                        : '—',
                    },
                    {
                      label: 'Top Score',
                      value: filtered[0]?.totalScore > 0 ? filtered[0].totalScore.toLocaleString() : '—',
                    },
                    {
                      label: 'Total Labs',
                      value: filtered.reduce((s, e) => s + e.labsCompleted, 0).toString(),
                    },
                    {
                      label: 'Active Students',
                      value: filtered.filter(e => e.labsCompleted > 0).length.toString(),
                    },
                  ].map(stat => (
                    <div key={stat.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: tk.muted }}>{stat.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: tk.heading, fontFamily: 'monospace' }}>{stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer note */}
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: tk.muted }}>
          Scores are calculated from all submitted lab experiments. Complete more labs to climb the ranks.
        </div>
      </div>
    </div>
  );
}

// Recharts doesn't export CartesianGrid with no lines cleanly, so just a no-op for the dist chart
function CartesianGridless() { return null; }