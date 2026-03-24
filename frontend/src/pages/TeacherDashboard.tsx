import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';

interface WeeklyPoint {
  week: string;
  classAvg: number;
  topPerformer: number;
  submissionCount: number;
}

interface Student {
  id: string;
  name: string;
  email: string;
  institution: string;
  year: string;
  stream: string;
  class_division: string;
  role: string;
}

interface JournalRow {
  id: string;
  lab: string;
  score: number;
  created_at: string;
  user_id: string;
  profiles: { name: string } | null;
}

// Build real weekly data from journal_entries
function buildWeeklyData(journals: JournalRow[]): WeeklyPoint[] {
  if (!journals.length) return [];

  // Group entries by ISO week
  const weekMap: Record<string, number[]> = {};
  journals.forEach(j => {
    const d = new Date(j.created_at);
    // ISO week key: YYYY-Www
    const jan4 = new Date(d.getFullYear(), 0, 4);
    const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
    const weekNum = Math.ceil((dayOfYear + jan4.getDay()) / 7);
    const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    if (!weekMap[key]) weekMap[key] = [];
    weekMap[key].push(j.score);
  });

  // Sort weeks chronologically, take last 8
  const sortedWeeks = Object.keys(weekMap).sort().slice(-8);

  return sortedWeeks.map((week, i) => {
    const scores = weekMap[week];
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const top = Math.max(...scores);
    // Short label: "Wk N" relative to first shown week
    const label = `Wk ${i + 1}`;
    return { week: label, classAvg: avg, topPerformer: top, submissionCount: scores.length };
  });
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [activeClass, setActiveClass] = useState('All');
  const [students, setStudents] = useState<Student[]>([]);
  const [recentActivity, setRecentActivity] = useState<JournalRow[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [teacherName, setTeacherName] = useState('Teacher');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'students'>('dashboard');

  const tk = {
    pageBg:    dark ? '#0F111A' : '#F0EEE9',
    sidebarBg: dark ? '#161929' : '#FAFAF8',
    cardBg:    dark ? '#1C1F2E' : '#FFFFFF',
    border:    dark ? '#232840' : '#E8E5DF',
    headerBg:  dark ? '#161929' : '#FFFFFF',
    heading:   dark ? '#EDEDF0' : '#111111',
    body:      dark ? '#8890A4' : '#666666',
    muted:     dark ? '#525870' : '#AAAAAA',
    alt:       dark ? '#232840' : '#F0EEE9',
    inputBg:   dark ? '#0F111A' : '#F5F3EE',
    gridLine:  dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
    tickColor: dark ? '#525870' : '#AAAAAA',
    divider:   dark ? '#1E2235' : '#F0EDE8',
    tooltipBg: dark ? '#1C1F2E' : '#FFFFFF',
  };

  const card: React.CSSProperties = {
    background: tk.cardBg,
    border: `1px solid ${tk.border}`,
    borderRadius: 16,
    padding: '20px 22px',
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, name')
        .eq('id', user.id)
        .single();

      if (!profile || profile.role !== 'teacher') {
        navigate('/dashboard');
        return;
      }

      setTeacherName(profile.name || 'Teacher');

      // Load all students
      const { data: studentsData } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('name');

      if (studentsData) setStudents(studentsData);

      // Load ALL journal entries for the weekly chart (no limit)
      const { data: allJournals } = await supabase
        .from('journal_entries')
        .select('id, lab, score, created_at, user_id, profiles(name)')
        .order('created_at', { ascending: true });

      if (allJournals) {
        const built = buildWeeklyData(allJournals as JournalRow[]);
        setWeeklyData(built);
        // For recent activity, show last 10 (reversed)
        const recent = [...allJournals].reverse().slice(0, 10);
        setRecentActivity(recent as JournalRow[]);
      }

      setLoading(false);
    };
    init();
  }, [navigate]);

  const filteredStudents = activeClass === 'All'
    ? students
    : students.filter(s => s.class_division === activeClass);

  const divisions = ['All', ...Array.from(new Set(students.map(s => s.class_division || 'Unassigned')))];

  const totalStudents = filteredStudents.length;
  const avgScore = recentActivity.length > 0
    ? Math.round(recentActivity.reduce((s, a) => s + a.score, 0) / recentActivity.length)
    : 0;
  const totalLabsDone = recentActivity.length;
  const lowScoreStudents = recentActivity.filter(a => a.score < 60).slice(0, 3);

  // Custom tooltip for the chart
  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: tk.tooltipBg, border: `1px solid ${tk.border}`,
        borderRadius: 10, padding: '10px 14px', fontSize: 12,
      }}>
        <div style={{ fontWeight: 700, color: tk.heading, marginBottom: 6 }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
            {p.name}: <strong>{p.value}</strong>
            {p.name === 'Class Avg' || p.name === 'Top Score' ? ' pts' : ''}
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: tk.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 14, color: tk.muted }}>Loading teacher dashboard...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: tk.pageBg, transition: 'background 0.3s' }}>

      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: tk.sidebarBg, borderRight: `1px solid ${tk.border}`,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '24px 20px', borderBottom: `1px solid ${tk.border}`, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', border: `2px solid #1D4ED8`, margin: '0 auto 10px', overflow: 'hidden' }}>
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${teacherName}`} alt="Teacher" style={{ width: '100%', height: '100%' }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: tk.heading }}>{teacherName}</div>
          <div style={{ fontSize: 11, color: '#1D4ED8', fontWeight: 600, marginTop: 2 }}>Teacher</div>
        </div>

        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            {
              label: 'Dashboard', key: 'dashboard',
              icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            },
            {
              label: 'Manage Students', key: 'students',
              icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
            },
          ].map(item => (
            <button key={item.key}
              onClick={() => setActiveTab(item.key as any)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 10, border: 'none',
                background: activeTab === item.key ? (dark ? 'rgba(29,78,216,0.15)' : '#EEF2FF') : 'transparent',
                color: activeTab === item.key ? '#1D4ED8' : tk.body,
                fontWeight: activeTab === item.key ? 700 : 500, fontSize: 13,
                cursor: 'pointer', width: '100%', textAlign: 'left',
              }}>
              {item.icon}{item.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '12px', borderTop: `1px solid ${tk.border}` }}>
          <Link to="/dashboard" style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 12, color: tk.muted, textDecoration: 'none', padding: '8px 12px', borderRadius: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Student View
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>

        {/* Header */}
        <header style={{
          height: 58, background: tk.headerBg, borderBottom: `1px solid ${tk.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 28px', position: 'sticky', top: 0, zIndex: 40,
        }}>
          <select value={activeClass} onChange={e => setActiveClass(e.target.value)}
            style={{
              background: tk.inputBg, border: `1px solid ${tk.border}`,
              color: tk.heading, borderRadius: 9, padding: '7px 14px',
              fontSize: 13, fontWeight: 700, outline: 'none', cursor: 'pointer',
            }}>
            {divisions.map(d => (
              <option key={d} value={d}>{d === 'All' ? 'All Students' : d}</option>
            ))}
          </select>
          <div style={{ fontSize: 13, color: tk.muted }}>
            {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} in view
          </div>
        </header>

        <div style={{ padding: '28px', maxWidth: 1200, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {activeTab === 'dashboard' && (
            <>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
                {[
                  { title: 'Total Students', val: totalStudents.toString(), badge: 'Registered', alert: false },
                  { title: 'Avg Score', val: avgScore > 0 ? `${avgScore}%` : '—', badge: 'Recent activity', alert: false },
                  { title: 'Labs Submitted', val: totalLabsDone.toString(), badge: 'Total entries', alert: false },
                  { title: 'Low Scorers', val: lowScoreStudents.length.toString(), badge: 'Score below 60%', alert: lowScoreStudents.length > 0 },
                ].map((s, i) => (
                  <div key={i} style={{
                    ...card,
                    borderColor: s.alert ? 'rgba(220,38,38,0.3)' : tk.border,
                    background: s.alert ? (dark ? 'rgba(220,38,38,0.06)' : '#FEF2F2') : tk.cardBg,
                  }}>
                    <div style={{ fontSize: 12, color: tk.muted, fontWeight: 600, marginBottom: 8 }}>{s.title}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: tk.heading, fontFamily: 'monospace', lineHeight: 1, marginBottom: 8 }}>{s.val}</div>
                    <div style={{
                      fontSize: 11, fontWeight: 700,
                      color: s.alert ? '#DC2626' : '#1D4ED8',
                      background: s.alert ? (dark ? 'rgba(220,38,38,0.12)' : '#FEE2E2') : (dark ? 'rgba(29,78,216,0.12)' : '#EEF2FF'),
                      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                    }}>{s.badge}</div>
                  </div>
                ))}
              </div>

              {/* Chart + Attention */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
                <div style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: tk.heading }}>
                      Class Performance — Last {weeklyData.length} Week{weeklyData.length !== 1 ? 's' : ''}
                    </h2>
                    {weeklyData.length === 0 && (
                      <span style={{ fontSize: 11, color: tk.muted, background: dark ? 'rgba(255,255,255,0.05)' : '#F5F3EE', padding: '3px 10px', borderRadius: 999 }}>
                        No data yet
                      </span>
                    )}
                  </div>

                  {weeklyData.length === 0 ? (
                    <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 28 }}>📊</div>
                      <div style={{ fontSize: 13, color: tk.muted, textAlign: 'center' }}>
                        Weekly chart will appear once students submit lab experiments.
                      </div>
                    </div>
                  ) : (
                    <div style={{ height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={weeklyData} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={tk.gridLine} />
                          <XAxis dataKey="week" tick={{ fill: tk.tickColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                          <YAxis
                            domain={[0, (dataMax: number) => Math.max(dataMax + 20, 100)]}
                            tick={{ fill: tk.tickColor, fontSize: 12 }}
                            axisLine={false} tickLine={false}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 12, color: tk.body, paddingTop: 12 }} />
                          <Line
                            type="monotone" dataKey="classAvg" name="Class Avg"
                            stroke="#1D4ED8" strokeWidth={2.5}
                            dot={{ fill: '#1D4ED8', r: 4 }} activeDot={{ r: 6 }}
                          />
                          <Line
                            type="monotone" dataKey="topPerformer" name="Top Score"
                            stroke="#059669" strokeWidth={2} strokeDasharray="5 4"
                            dot={{ fill: '#059669', r: 3 }} activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Submission count row */}
                  {weeklyData.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 8, paddingTop: 12, borderTop: `1px solid ${tk.border}` }}>
                      {weeklyData.map((w, i) => (
                        <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{
                            height: Math.max(4, w.submissionCount * 6),
                            background: dark ? 'rgba(29,78,216,0.3)' : '#DBEAFE',
                            borderRadius: 3, marginBottom: 3,
                          }} />
                          <div style={{ fontSize: 9, color: tk.muted }}>{w.submissionCount}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: tk.heading, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626', display: 'inline-block' }}></span>
                    Needs Attention
                  </h2>
                  {lowScoreStudents.length === 0 ? (
                    <div style={{ fontSize: 13, color: tk.muted, textAlign: 'center', padding: '20px 0' }}>
                      No students scoring below 60% yet.
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {lowScoreStudents.map((s, i) => (
                        <div key={i} style={{
                          padding: '12px 14px', borderRadius: 10,
                          background: dark ? 'rgba(220,38,38,0.07)' : '#FEF2F2',
                          border: '1px solid rgba(220,38,38,0.2)',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: tk.heading }}>
                              {s.profiles?.name || 'Unknown'}
                            </div>
                            <div style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>Low score on {s.lab}</div>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: tk.muted, fontFamily: 'monospace' }}>{s.score}%</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent activity */}
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: tk.heading }}>Recent Lab Submissions</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#059669' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', display: 'inline-block' }}></span>
                    Live
                  </div>
                </div>
                {recentActivity.length === 0 ? (
                  <div style={{ fontSize: 13, color: tk.muted, textAlign: 'center', padding: '20px 0' }}>
                    No lab submissions yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {recentActivity.slice(0, 6).map((a, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '12px 0',
                        borderBottom: i < Math.min(recentActivity.length, 6) - 1 ? `1px solid ${tk.divider}` : 'none',
                      }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                          background: dark ? 'rgba(5,150,105,0.12)' : '#ECFDF5',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 800, color: '#059669',
                        }}>
                          {(a.profiles?.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, fontSize: 14 }}>
                          <span style={{ fontWeight: 700, color: tk.heading }}>{a.profiles?.name || 'Unknown'}</span>
                          <span style={{ color: tk.body, margin: '0 4px' }}>submitted</span>
                          <span style={{ fontWeight: 700, color: '#059669' }}>{a.lab}</span>
                        </div>
                        <div style={{ fontSize: 12, color: tk.muted, whiteSpace: 'nowrap' }}>
                          {new Date(a.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: a.score >= 70 ? '#059669' : a.score >= 50 ? '#D97706' : '#DC2626', minWidth: 40, textAlign: 'right' }}>
                          {a.score} pts
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Students tab */}
          {activeTab === 'students' && (
            <div style={card}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: tk.heading, marginBottom: 20 }}>
                Registered Students ({filteredStudents.length})
              </h2>
              {filteredStudents.length === 0 ? (
                <div style={{ fontSize: 13, color: tk.muted, textAlign: 'center', padding: '40px 0' }}>
                  No students registered yet.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: tk.alt }}>
                      {['Name', 'Email', 'Institution', 'Class', 'Division', 'Stream'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: tk.muted, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${tk.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s) => (
                      <tr key={s.id} style={{ borderBottom: `1px solid ${tk.divider}`, transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.02)' : '#FAFAF8')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: tk.heading }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${s.name}`} alt="" style={{ width: '100%', height: '100%' }} />
                            </div>
                            {s.name}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', color: tk.body }}>{s.email}</td>
                        <td style={{ padding: '12px 14px', color: tk.body }}>{s.institution || '—'}</td>
                        <td style={{ padding: '12px 14px', color: tk.body }}>{s.year ? `Class ${s.year}` : '—'}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                            background: dark ? 'rgba(29,78,216,0.12)' : '#EEF2FF', color: '#1D4ED8',
                          }}>{s.class_division || 'Unassigned'}</span>
                        </td>
                        <td style={{ padding: '12px 14px', color: tk.body }}>{s.stream || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}