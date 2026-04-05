import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { fetchStats, fetchSites, fetchFlows, fetchStatus, humanBytes, timeAgo } from './api';

const APP_COLORS = {
  YOUTUBE:   '#FF0000', GOOGLE:    '#4285F4', FACEBOOK:  '#1877F2',
  INSTAGRAM: '#E1306C', TWITTER:   '#1DA1F2', NETFLIX:   '#E50914',
  AMAZON:    '#FF9900', MICROSOFT: '#00BCF2', APPLE:     '#86868b',
  TELEGRAM:  '#2CA5E0', TIKTOK:    '#010101', SPOTIFY:   '#1DB954',
  ZOOM:      '#2D8CFF', DISCORD:   '#5865F2', GITHUB:    '#6e40c9',
  CLOUDFLARE:'#F48120', OPENAI:    '#10a37f', HOTSTAR:   '#ff2d55',
  REDDIT:    '#FF4500', TWITCH:    '#9146FF', LINKEDIN:  '#0A66C2',
  SNAPCHAT:  '#FFFC00', PINTEREST: '#E60023', DROPBOX:   '#0061FF',
  SLACK:     '#4A154B', HTTPS:     '#334155', HTTP:      '#475569',
  DNS:       '#059669', QUIC:      '#7c3aed', UNKNOWN:   '#1e293b',
}
const getColor = (app) => APP_COLORS[app?.toUpperCase?.()] || '#334155'

function Sidebar({ tab, setTab, status, onRefresh, loading }) {
  const tabs = ['Overview', 'Sites Visited', 'Live Flows', 'Blocked']
  const ok = status?.flows_file_found

  return (
    <div style={{
      width: 240, flexShrink: 0,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflow: 'hidden',
    }}>
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #00d4ff22, #7c3aed44)',
            border: '1px solid var(--cyan)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: 'var(--cyan)',
          }}>⬡</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>FlowSentinel</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>DPI Dashboard</div>
          </div>
        </div>
      </div>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div className="pulse-dot" style={{ background: ok ? 'var(--emerald)' : 'var(--red)' }} />
          <span style={{ fontSize: 11, color: ok ? 'var(--emerald)' : 'var(--red)', fontWeight: 500 }}>
            {ok ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
        {ok && (
          <>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted2)', marginBottom: 2 }}>
              {status?.total_flows || 0} flows tracked
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', wordBreak: 'break-all' }}>
              flows.json
            </div>
          </>
        )}
      </div>
      <nav style={{ flex: 1, padding: '8px 0' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            display: 'block', width: '100%', textAlign: 'left',
            background: 'none', border: 'none',
            borderLeft: tab === t ? '2px solid var(--cyan)' : '2px solid transparent',
            padding: '9px 16px',
            color: tab === t ? 'var(--cyan)' : 'var(--muted2)',
            fontFamily: 'var(--sans)', fontSize: 13,
            fontWeight: tab === t ? 500 : 400,
            cursor: 'pointer', transition: 'all 0.1s',
            borderRadius: 0,
          }}>{t}</button>
        ))}
      </nav>
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <button onClick={onRefresh} style={{ width: '100%' }}>
          {loading ? '…' : '↻  Refresh'}
        </button>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, accent = 'var(--cyan)' }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${accent}`,
      borderRadius: 8, padding: '16px 20px',
      flex: 1, minWidth: 160,
      animation: 'count-up 0.4s ease both',
    }}>
      <div style={{
        fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em',
        textTransform: 'uppercase', fontFamily: 'var(--mono)', marginBottom: 8,
      }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--mono)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, fontFamily: 'var(--mono)' }}>{sub}</div>}
    </div>
  )
}

function AppBadge({ app }) {
  const color = getColor(app)
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 4,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
      fontFamily: 'var(--mono)',
      background: color + '33',
      color: color,
      border: `1px solid ${color}66`,
    }}>{app || 'UNKNOWN'}</span>
  )
}

function Panel({ title, children, style = {} }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10, padding: 20,
      ...style,
    }}>
      {title && (
        <div style={{
          fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em',
          textTransform: 'uppercase', fontFamily: 'var(--mono)',
          marginBottom: 16, fontWeight: 500,
        }}>{title}</div>
      )}
      {children}
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#0d1421', border: '1px solid #1a2540',
      borderRadius: 8, padding: '10px 14px', fontSize: 12,
    }}>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || 'var(--text)', fontFamily: 'var(--mono)' }}>
          {p.name || label}: {typeof p.value === 'number' && p.value > 1000
            ? humanBytes(p.value) : p.value}
        </div>
      ))}
    </div>
  )
}

function Overview({ stats, sites }) {
  if (!stats) return null;
  const appData = Object.entries(stats.app_distribution || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a,b) => b.value - a.value);
    
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <StatCard label="TOTAL FLOWS" value={stats.total_flows} />
        <StatCard label="DATA TRANSFERRED" value={humanBytes(stats.total_bytes)} />
        <StatCard label="UNIQUE DOMAINS" value={stats.unique_domains || 0} />
        <StatCard label="BLOCKED FLOWS" value={stats.blocked_flows || 0} accent="var(--red)" />
      </div>
      <div style={{ display: 'flex', gap: 16, height: 320 }}>
        <Panel title="Traffic by Application" style={{ flex: '0 0 60%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={appData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" animationDuration={800}>
                {appData.map((entry, index) => <Cell key={`cell-${index}`} fill={getColor(entry.name)} stroke="none" />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 11, fontFamily: 'var(--sans)' }} />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Top Apps" style={{ flex: '0 0 40%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={appData.slice(0, 6)} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={80} stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} animationDuration={800}>
                {appData.slice(0, 6).map((entry, index) => <Cell key={`cell-${index}`} fill={getColor(entry.name)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
      <Panel title="Top Sites">
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
          <thead>
            <tr style={{ color: 'var(--muted)', fontFamily: 'var(--sans)' }}>
              <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>#</th>
              <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>Domain</th>
              <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>App</th>
              <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>Bytes</th>
              <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>Packets</th>
              <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>Flows</th>
            </tr>
          </thead>
          <tbody>
            {(sites || []).slice(0, 8).map((site, i) => (
              <tr key={site.domain} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--surface2)' : 'transparent' }}>
                <td style={{ padding: '12px', color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>{i + 1}</td>
                <td style={{ padding: '12px', color: 'var(--text)', fontFamily: 'var(--mono)' }}>{site.domain}</td>
                <td style={{ padding: '12px' }}><AppBadge app={site.app} /></td>
                <td style={{ padding: '12px', fontFamily: 'var(--mono)' }}>{humanBytes(site.total_bytes)}</td>
                <td style={{ padding: '12px', fontFamily: 'var(--mono)' }}>{site.total_packets.toLocaleString()}</td>
                <td style={{ padding: '12px', fontFamily: 'var(--mono)' }}>{site.flow_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!sites || sites.length === 0) && <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)' }}>No domain data yet</div>}
      </Panel>
    </div>
  )
}

function SitesView({ sites }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('bytes');
  const [sortDesc, setSortDesc] = useState(true);

  const filtered = (sites || []).filter(s => s.domain.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'domain') cmp = a.domain.localeCompare(b.domain);
    else if (sortBy === 'bytes') cmp = a.total_bytes - b.total_bytes;
    else if (sortBy === 'packets') cmp = a.total_packets - b.total_packets;
    return sortDesc ? -cmp : cmp;
  });

  const handleSort = (key) => {
    if (sortBy === key) setSortDesc(!sortDesc);
    else { setSortBy(key); setSortDesc(true); }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span style={{ opacity: 0.3 }}>↕</span>;
    return <span>{sortDesc ? '↓' : '↑'}</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%', paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 18, fontWeight: 500 }}>Sites Visited</h2>
        <input type="text" placeholder="Search domains..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 250 }} />
      </div>
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10 }}>
            <tr style={{ color: 'var(--muted)', fontFamily: 'var(--sans)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px', cursor: 'pointer' }}>#</th>
              <th style={{ padding: '12px', cursor: 'pointer' }} onClick={() => handleSort('domain')}>Domain <SortIcon col="domain" /></th>
              <th style={{ padding: '12px' }}>App</th>
              <th style={{ padding: '12px', cursor: 'pointer' }} onClick={() => handleSort('bytes')}>Total Bytes <SortIcon col="bytes" /></th>
              <th style={{ padding: '12px', cursor: 'pointer' }} onClick={() => handleSort('packets')}>Packets <SortIcon col="packets" /></th>
              <th style={{ padding: '12px' }}>Connections</th>
              <th style={{ padding: '12px' }}>Last Seen</th>
              <th style={{ padding: '12px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((site, i) => (
              <tr key={site.domain} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px', color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>{i + 1}</td>
                <td style={{ padding: '12px', color: 'var(--text)', fontFamily: 'var(--mono)', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={site.domain}>{site.domain}</td>
                <td style={{ padding: '12px' }}><AppBadge app={site.app} /></td>
                <td style={{ padding: '12px', fontFamily: 'var(--mono)' }}>{humanBytes(site.total_bytes)}</td>
                <td style={{ padding: '12px', fontFamily: 'var(--mono)' }}>{site.total_packets.toLocaleString()}</td>
                <td style={{ padding: '12px', fontFamily: 'var(--mono)' }}>{site.flow_count}</td>
                <td style={{ padding: '12px', color: 'var(--muted)' }}>{timeAgo(site.last_seen_ms)}</td>
                <td style={{ padding: '12px' }}>
                  {site.blocked ? 
                    <span style={{ color: 'var(--red)', background: 'var(--red)22', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>BLOCKED</span> :
                    <span style={{ color: 'var(--emerald)', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>OK</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No domains found</div>}
      </div>
    </div>
  );
}

function FlowsView({ flows }) {
  const [search, setSearch] = useState('');
  const [filterApp, setFilterApp] = useState('');
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [prevFlows, setPrevFlows] = useState(new Set());
  
  useEffect(() => {
    const keys = new Set((flows || []).map(f => `${f.src_ip}:${f.src_port}-${f.dst_ip}:${f.dst_port}`));
    setPrevFlows(keys);
  }, [flows]);

  const uniqueApps = Array.from(new Set((flows || []).map(f => f.app_name))).sort();

  const filtered = (flows || []).filter(f => {
    if (search && !((f.domain || '').toLowerCase().includes(search.toLowerCase()) || f.dst_ip.includes(search))) return false;
    if (filterApp && f.app_name !== filterApp) return false;
    if (blockedOnly && !f.blocked) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%', paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 18, fontWeight: 500 }}>Live Flows</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={filterApp} onChange={e => setFilterApp(e.target.value)}>
            <option value="">All Applications</option>
            {uniqueApps.map(app => <option key={app} value={app}>{app}</option>)}
          </select>
          <input type="text" placeholder="Filter domain/IP..." value={search} onChange={e => setSearch(e.target.value)} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
            <input type="checkbox" checked={blockedOnly} onChange={e => setBlockedOnly(e.target.checked)} />
            Blocked only
          </label>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10 }}>
            <tr style={{ color: 'var(--muted)', fontFamily: 'var(--sans)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px' }}>Connection</th>
              <th style={{ padding: '12px' }}>Domain</th>
              <th style={{ padding: '12px' }}>App / Proto</th>
              <th style={{ padding: '12px' }}>Bytes</th>
              <th style={{ padding: '12px' }}>Packets</th>
              <th style={{ padding: '12px' }}>Age</th>
              <th style={{ padding: '12px' }}>Flags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((f) => {
              const key = `${f.src_ip}:${f.src_port}-${f.dst_ip}:${f.dst_port}`;
              const isNew = !prevFlows.has(key);
              return (
                <tr key={key} style={{ borderBottom: '1px solid var(--border)', animation: isNew ? 'row-flash 1s' : 'none' }}>
                  <td style={{ padding: '12px', color: 'var(--muted2)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                    <span style={{ color: 'var(--muted)' }}>{f.src_ip}:{f.src_port}</span> <span style={{ color: 'var(--border2)' }}>→</span> <span style={{ color: 'var(--text)' }}>{f.dst_ip}:{f.dst_port}</span>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text)', fontFamily: 'var(--mono)' }}>{f.domain || '-'}</td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AppBadge app={f.app_name} />
                      <span style={{ fontSize: 10, color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>{f.protocol === 6 ? 'TCP' : 'UDP'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px', fontFamily: 'var(--mono)' }}>{humanBytes(f.bytes)}</td>
                  <td style={{ padding: '12px', fontFamily: 'var(--mono)' }}>{f.packets}</td>
                  <td style={{ padding: '12px', color: 'var(--emerald)' }}>{timeAgo(f.first_seen_ms)}</td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {f.is_quic && <span style={{ padding: '2px 6px', background: 'var(--violet)33', color: 'var(--violet)', borderRadius: 3, fontSize: 10, fontWeight: 700, border: '1px solid var(--violet)' }}>QUIC</span>}
                      {f.blocked && <span style={{ padding: '2px 6px', background: 'var(--red)33', color: 'var(--red)', borderRadius: 3, fontSize: 10, fontWeight: 700, border: '1px solid var(--red)' }}>BLOCK</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No live flows</div>}
      </div>
    </div>
  );
}

function BlockedView({ flows }) {
  const blocked = (flows || []).filter(f => f.blocked);
  if (blocked.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
        <p style={{ fontSize: 14 }}>No blocked flows</p>
        <p style={{ fontSize: 12, marginTop: 8 }}>Start blocking with --block-app or --block-domain flags</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%', paddingBottom: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--red)' }}>Blocked Flows</h2>
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--red)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10 }}>
            <tr style={{ color: 'var(--red)', fontFamily: 'var(--sans)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px' }}>Source → Destination</th>
              <th style={{ padding: '12px' }}>Domain</th>
              <th style={{ padding: '12px' }}>App</th>
              <th style={{ padding: '12px' }}>Blocked Bytes</th>
              <th style={{ padding: '12px' }}>Blocked Packets</th>
              <th style={{ padding: '12px' }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {blocked.map((f, i) => {
              const key = `${f.src_ip}:${f.src_port}-${f.dst_ip}:${f.dst_port}-${i}`;
              return (
                <tr key={key} style={{ borderBottom: '1px solid var(--border)', background: 'rgba(239, 68, 68, 0.05)' }}>
                  <td style={{ padding: '12px', color: 'var(--muted2)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                    <span style={{ color: 'var(--muted)' }}>{f.src_ip}:{f.src_port}</span> → <span style={{ color: 'var(--text)' }}>{f.dst_ip}:{f.dst_port}</span>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text)', fontFamily: 'var(--mono)' }}>{f.domain || '-'}</td>
                  <td style={{ padding: '12px' }}><AppBadge app={f.app_name} /></td>
                  <td style={{ padding: '12px', fontFamily: 'var(--mono)' }}>{humanBytes(f.bytes)}</td>
                  <td style={{ padding: '12px', fontFamily: 'var(--mono)' }}>{f.packets}</td>
                  <td style={{ padding: '12px', color: 'var(--muted)' }}>{timeAgo(f.last_seen_ms)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('Overview')
  const [stats, setStats] = useState(null)
  const [sites, setSites] = useState([])
  const [flows, setFlows] = useState([])
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [s, si, st, fl] = await Promise.allSettled([
        fetchStats(), fetchSites(200), fetchStatus(), fetchFlows({ limit: 300 })
      ])
      if (s.status  === 'fulfilled') setStats(s.value)
      if (si.status === 'fulfilled') setSites(si.value)
      if (st.status === 'fulfilled') setStatus(st.value)
      if (fl.status === 'fulfilled') setFlows(fl.value)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const id = setInterval(refresh, 4000)
    return () => clearInterval(id)
  }, [refresh])
  
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar tab={tab} setTab={setTab} status={status} onRefresh={refresh} loading={loading} />
      <main style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        {tab === 'Overview'      && <Overview stats={stats} sites={sites} />}
        {tab === 'Sites Visited' && <SitesView sites={sites} />}
        {tab === 'Live Flows'    && <FlowsView flows={flows} />}
        {tab === 'Blocked'       && <BlockedView flows={flows} />}
      </main>
    </div>
  )
}
