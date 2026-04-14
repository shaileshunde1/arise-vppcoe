import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion } from 'framer-motion';
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
  scoreHistory: number[];
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] } }),
};

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

      const scoreMap: Record<string, { total: number; count: number; lastActive: string; history: number[] }> = {};
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
  const years     = ['All', ...Array.from(new Set(entries.map(e => e.year).filter(y => y && y !== '—')))];

  const filtered = entries.filter(e => {
    const matchDiv  = filterDivision === 'All' || e.class_division === filterDivision;
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
    return 'var(--on-surface-variant)';
  };

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

  const selectStyle: React.CSSProperties = {
    background: 'var(--surface-container)',
    border: '1px solid rgba(66,73,79,0.2)',
    color: 'var(--on-surface)',
    borderRadius: 10, padding: '9px 16px',
    fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)', transition: 'background 0.3s', color: 'var(--on-background)' }}>
      <div style={{ maxWidth: 1060, margin: '0 auto', padding: '40px 32px' }}>

        {/* ── Header ────────────────────────────────────────── */}
        <motion.div variants={fadeUp} initial="hidden" animate="show"
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <span className="font-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--secondary)', display: 'block', marginBottom: 8 }}>
              Competition
            </span>
            <h1 className="serif" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 300, color: 'var(--primary)', letterSpacing: '-0.03em', marginBottom: 8, lineHeight: 1.1 }}>
              Leaderboard
            </h1>
            <p className="font-body" style={{ fontSize: 14, color: 'var(--on-surface-variant)' }}>
              Ranked by total score across all lab experiments — all students, all divisions.
            </p>
          </div>

          {myRank > 0 && (
            <div style={{
              background: 'rgba(135,160,192,0.08)', border: '1px solid rgba(135,160,192,0.3)',
              borderRadius: 14, padding: '14px 22px', textAlign: 'center', flexShrink: 0,
            }}>
              <div className="font-label" style={{ fontSize: 10, fontWeight: 700, color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>
                Your Rank
              </div>
              <div className="serif" style={{ fontSize: 28, fontWeight: 300, color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>
                #{myRank}
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Filters ───────────────────────────────────────── */}
        <motion.div variants={fadeUp} custom={1} initial="hidden" animate="show"
          style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={filterDivision} onChange={e => setFilterDivision(e.target.value)} className="font-label" style={selectStyle}>
            {divisions.map(d => <option key={d} value={d}>{d === 'All' ? 'All Divisions' : `Division ${d}`}</option>)}
          </select>
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="font-label" style={selectStyle}>
            {years.map(y => <option key={y} value={y}>{y === 'All' ? 'All Classes' : `Class ${y}`}</option>)}
          </select>
          <span className="font-label" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--on-surface-variant)', letterSpacing: '0.06em' }}>
            {filtered.length} student{filtered.length !== 1 ? 's' : ''}
          </span>
        </motion.div>

        {/* ── Top 3 Podium ──────────────────────────────────── */}
        {!loading && filtered.length >= 3 && (
          <motion.div variants={fadeUp} custom={2} initial="hidden" animate="show"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1.08fr 1fr', gap: 12, marginBottom: 20, alignItems: 'end' }}>
            {([filtered[1], filtered[0], filtered[2]] as LeaderboardEntry[]).map((entry, podiumIdx) => {
              const actualRank = podiumIdx === 0 ? 2 : podiumIdx === 1 ? 1 : 3;
              const isFirst = actualRank === 1;
              const isMe = entry?.id === profile?.id;
              if (!entry) return <div key={podiumIdx} />;

              const podiumHeights = [80, 110, 65];
              return (
                <div key={entry.id} style={{
                  background: 'var(--surface-container)',
                  border: `1px solid ${isFirst ? 'rgba(245,158,11,0.4)' : isMe ? 'rgba(135,160,192,0.4)' : 'rgba(66,73,79,0.2)'}`,
                  borderRadius: 16, padding: '20px 16px', textAlign: 'center',
                  position: 'relative', overflow: 'visible',
                }}>
                  {isMe && (
                    <div className="font-label" style={{
                      position: 'absolute', top: 10, right: 10,
                      fontSize: 9, fontWeight: 700, color: 'var(--secondary)',
                      background: 'rgba(135,160,192,0.12)',
                      padding: '2px 7px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>You</div>
                  )}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: podiumHeights[podiumIdx],
                    background: isFirst ? 'rgba(245,158,11,0.04)' : 'rgba(135,160,192,0.02)',
                    borderTop: `1px dashed ${isFirst ? 'rgba(245,158,11,0.2)' : 'rgba(66,73,79,0.15)'}`,
                    borderRadius: '0 0 16px 16px',
                  }} />
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>{getRankDisplay(actualRank)}</div>
                    <div style={{ width: 46, height: 46, borderRadius: '50%', overflow: 'hidden', margin: '0 auto 10px', border: `2px solid ${getRankColor(actualRank)}` }}>
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.name}`} alt="" style={{ width: '100%', height: '100%' }} />
                    </div>
                    <div className="font-label" style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', marginBottom: 2 }}>{entry.name}</div>
                    <div className="font-label" style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginBottom: 10 }}>{entry.institution}</div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                      <Sparkline data={entry.scoreHistory} color={getRankColor(actualRank)} />
                    </div>
                    <div className="serif" style={{ fontSize: 24, fontWeight: 300, color: 'var(--secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {entry.totalScore.toLocaleString()}
                    </div>
                    <div className="font-label" style={{ fontSize: 10, color: 'var(--on-surface-variant)', marginTop: 2, letterSpacing: '0.06em' }}>
                      {entry.labsCompleted} lab{entry.labsCompleted !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* ── Table + Distribution ──────────────────────────── */}
        <motion.div variants={fadeUp} custom={3} initial="hidden" animate="show"
          style={{ display: 'grid', gridTemplateColumns: filtered.length > 0 ? '1fr 280px' : '1fr', gap: 16, marginBottom: 16, alignItems: 'start' }}>

          {/* Table */}
          <div style={{ background: 'var(--surface-container)', border: '1px solid rgba(66,73,79,0.2)', borderRadius: 16, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <p className="font-body" style={{ fontSize: 14, color: 'var(--on-surface-variant)' }}>Loading leaderboard...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>🏆</div>
                <h3 className="serif" style={{ fontSize: 22, fontWeight: 300, color: 'var(--primary)', marginBottom: 8 }}>No scores yet</h3>
                <p className="font-body" style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginBottom: 24 }}>
                  Complete lab experiments and save them to your journal to appear here.
                </p>
                <Link to="/labs" className="font-label" style={{
                  display: 'inline-block', padding: '10px 24px',
                  background: 'var(--secondary)', color: 'var(--surface)',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                  borderRadius: 9, textDecoration: 'none',
                }}>Browse Labs</Link>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-container-low)' }}>
                      {['Rank', 'Student', 'Class', 'Trend', 'Labs', 'Total Score', 'Last Active'].map(h => (
                        <th key={h} className="font-label" style={{
                          padding: '13px 16px', textAlign: h === 'Total Score' ? 'right' : 'left',
                          fontSize: 10, fontWeight: 700, color: 'var(--on-surface-variant)',
                          textTransform: 'uppercase', letterSpacing: '0.1em',
                          borderBottom: '1px solid rgba(66,73,79,0.15)', whiteSpace: 'nowrap',
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
                            borderBottom: '1px solid rgba(66,73,79,0.08)',
                            background: isMe
                              ? 'rgba(135,160,192,0.06)'
                              : isHighlighted ? 'var(--surface-container-high)' : 'transparent',
                            transition: 'background 0.15s',
                          }}>
                          <td style={{ padding: '13px 16px', width: 56 }}>
                            <span className="font-label" style={{ fontSize: rank <= 3 ? 18 : 13, fontWeight: 800, color: getRankColor(rank), fontVariantNumeric: 'tabular-nums' }}>
                              {getRankDisplay(rank)}
                            </span>
                          </td>
                          <td style={{ padding: '13px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: `1.5px solid ${isMe ? 'var(--secondary)' : 'rgba(66,73,79,0.3)'}` }}>
                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.name}`} alt="" style={{ width: '100%', height: '100%' }} />
                              </div>
                              <div>
                                <div className="font-label" style={{ fontWeight: 700, color: 'var(--on-surface)', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                                  {entry.name}
                                  {isMe && (
                                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--secondary)', background: 'rgba(135,160,192,0.12)', padding: '1px 7px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.08em' }}>You</span>
                                  )}
                                </div>
                                <div className="font-label" style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{entry.institution}</div>
                              </div>
                            </div>
                          </td>
                          <td className="font-label" style={{ padding: '13px 16px', color: 'var(--on-surface-variant)', whiteSpace: 'nowrap', fontSize: 12 }}>
                            {entry.year && entry.year !== '—' ? `Yr ${entry.year}` : '—'}
                            {entry.class_division !== 'Unassigned' && (
                              <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--outline-variant)' }}>{entry.class_division}</span>
                            )}
                          </td>
                          <td style={{ padding: '13px 16px' }}>
                            <Sparkline data={entry.scoreHistory} color={isMe ? 'var(--secondary)' : 'rgba(135,160,192,0.5)'} />
                          </td>
                          <td className="font-label" style={{ padding: '13px 16px', color: 'var(--on-surface-variant)', fontFamily: 'monospace', fontWeight: 600 }}>
                            {entry.labsCompleted}
                          </td>
                          <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                            <span className="serif" style={{ fontSize: 16, fontWeight: 300, color: 'var(--secondary)', fontVariantNumeric: 'tabular-nums' }}>
                              {entry.totalScore > 0 ? entry.totalScore.toLocaleString() : '—'}
                            </span>
                          </td>
                          <td className="font-label" style={{ padding: '13px 16px', color: 'var(--on-surface-variant)', fontSize: 11, whiteSpace: 'nowrap' }}>
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

          {/* Distribution sidebar */}
          {!loading && filtered.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Score distribution chart */}
              <div style={{ background: 'var(--surface-container)', border: '1px solid rgba(66,73,79,0.2)', borderRadius: 16, padding: '20px 18px' }}>
                <span className="font-label" style={{ fontSize: 10, fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 16 }}>
                  Score Distribution
                </span>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distributionData} margin={{ left: -16, right: 4, top: 4, bottom: 0 }} barCategoryGap="20%">
                      <XAxis dataKey="label" tick={{ fill: 'var(--on-surface-variant)', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: 'var(--on-surface-variant)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: 'rgba(135,160,192,0.06)' }}
                        contentStyle={{ background: 'var(--surface-container-high)', border: '1px solid rgba(66,73,79,0.2)', borderRadius: 10, fontSize: 12 }}
                        labelStyle={{ color: 'var(--on-surface)', fontWeight: 700 }}
                        formatter={(v: number) => [`${v} student${v !== 1 ? 's' : ''}`, 'Count']}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {distributionData.map((_, index) => (
                          <Cell key={index} fill={
                            index === 0 ? 'rgba(135,160,192,0.3)' :
                            index === 1 ? 'rgba(135,160,192,0.5)' :
                            index === 2 ? 'rgba(135,160,192,0.7)' :
                            index === 3 ? 'rgba(135,160,192,0.85)' :
                            'var(--secondary)'
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Class stats */}
              <div style={{ background: 'var(--surface-container)', border: '1px solid rgba(66,73,79,0.2)', borderRadius: 16, padding: '20px 18px' }}>
                <span className="font-label" style={{ fontSize: 10, fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 16 }}>
                  Class Stats
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    {
                      label: 'Avg Score',
                      value: (() => {
                        const active = filtered.filter(e => e.totalScore > 0);
                        return active.length > 0
                          ? Math.round(active.reduce((s, e) => s + e.totalScore, 0) / active.length).toLocaleString()
                          : '—';
                      })(),
                    },
                    { label: 'Top Score',      value: filtered[0]?.totalScore > 0 ? filtered[0].totalScore.toLocaleString() : '—' },
                    { label: 'Total Labs',      value: filtered.reduce((s, e) => s + e.labsCompleted, 0).toString() },
                    { label: 'Active Students', value: filtered.filter(e => e.labsCompleted > 0).length.toString() },
                  ].map(stat => (
                    <div key={stat.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid rgba(66,73,79,0.08)' }}>
                      <span className="font-label" style={{ fontSize: 11, color: 'var(--on-surface-variant)', letterSpacing: '0.04em' }}>{stat.label}</span>
                      <span className="serif" style={{ fontSize: 18, fontWeight: 300, color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>{stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>

        <p className="font-label" style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: 'var(--outline-variant)', letterSpacing: '0.04em' }}>
          Scores are calculated from all submitted lab experiments across all divisions.
        </p>
      </div>
    </div>
  );
}