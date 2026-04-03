import React, { useState, useEffect, useCallback } from 'react'
import { fetchStats, fetchSites, fetchFlows, fetchStatus, humanBytes, timeAgo } from './api.js'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

// ── Color palette for app types ───────────────────────────────────────────────
const APP_COLORS = {
  YOUTUBE:'#FF0000', GOOGLE:'#4285F4', FACEBOOK:'#1877F2',
  INSTAGRAM:'#E1306C', TWITTER:'#1DA1F2', NETFLIX:'#E50914',
  AMAZON:'#FF9900', MICROSOFT:'#00BCF2', APPLE:'#555555',
  TELEGRAM:'#2CA5E0', TIKTOK:'#010101', SPOTIFY:'#1DB954',
  ZOOM:'#2D8CFF', DISCORD:'#5865F2', GITHUB:'#24292E',
  CLOUDFLARE:'#F48120', OPENAI:'#10a37f',
  HTTPS:'#6B7280', HTTP:'#9CA3AF', DNS:'#10B981',
  QUIC:'#8B5CF6', UNKNOWN:'#374151',
}
const getColor = (app) => APP_COLORS[app?.toUpperCase()] || '#6B7280'

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }) {
  return (
    <div style={{
      background:'#1a1d27', border:'1px solid #2d3148',
      borderRadius:10, padding:'16px 20px', flex:1, minWidth:140,
    }}>
      <div style={{fontSize:12, color:'#64748b', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em'}}>{label}</div>
      <div style={{fontSize:24, fontWeight:600, color:'#e2e8f0'}}>{value}</div>
      {sub && <div style={{fontSize:11, color:'#475569', marginTop:4}}>{sub}</div>}
    </div>
  )
}

function AppBadge({ app }) {
  const color = getColor(app)
  return (
    <span style={{
      display:'inline-block', padding:'2px 8px', borderRadius:4,
      fontSize:11, fontWeight:600, letterSpacing:'0.04em',
      background:color+'22', color, border:`1px solid ${color}44`,
    }}>{app || 'UNKNOWN'}</span>
  )
}

function StatusBar({ status }) {
  if (!status) return null
  const ok = status.flows_file_found
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8,
      padding:'6px 14px', borderRadius:6,
      background: ok ? '#0d2b1a' : '#2b0d0d',
      border:`1px solid ${ok ? '#166534' : '#7f1d1d'}`,
      fontSize:12, color: ok ? '#4ade80' : '#f87171',
    }}>
      <span style={{width:8, height:8, borderRadius:'50%', background: ok ? '#4ade80' : '#f87171', display:'inline-block'}} />
      {ok
        ? `Engine active · ${status.total_flows} flows · ${status.flows_file}`
        : 'flows.json not found — start the DPI engine first'}
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = ['Overview', 'Sites Visited', 'Live Flows', 'Blocked']

export default function App() {
  const [tab, setTab] = useState('Overview')
  const [stats, setStats]   = useState(null)
  const [sites, setSites]   = useState([])
  const [flows, setFlows]   = useState([])
  const [status, setStatus] = useState(null)
  const [domainFilter, setDomainFilter] = useState('')
  const [appFilter, setAppFilter]       = useState('')
  const [sortBy, setSortBy]             = useState('bytes')
  const [loading, setLoading]           = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [s, si, st, fl] = await Promise.allSettled([
        fetchStats(), fetchSites(200), fetchStatus(),
        fetchFlows({ limit:500, appFilter, domainFilter, sortBy }),
      ])
      if (s.status==='fulfilled')  setStats(s.value)
      if (si.status==='fulfilled') setSites(si.value)
      if (st.status==='fulfilled') setStatus(st.value)
      if (fl.status==='fulfilled') setFlows(fl.value)
    } finally { setLoading(false) }
  }, [appFilter, domainFilter, sortBy])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const id = setInterval(refresh, 4000)
    return () => clearInterval(id)
  }, [refresh])

  const blockedFlows = flows.filter(f => f.blocked)

  return (
    <div style={{minHeight:'100vh', background:'#0f1117'}}>
      {/* Header */}
      <div style={{
        background:'#13151f', borderBottom:'1px solid #1e2235',
        padding:'0 24px', display:'flex', alignItems:'center',
        justifyContent:'space-between', height:56,
      }}>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <div style={{width:28, height:28, borderRadius:6, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700}}>F</div>
          <span style={{fontWeight:700, fontSize:16, color:'#e2e8f0'}}>FlowSentinel</span>
          <span style={{fontSize:11, color:'#475569', marginLeft:4}}>DPI Dashboard</span>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <StatusBar status={status} />
          <button onClick={refresh} style={{
            background:'#1e2130', border:'1px solid #334155', color:'#94a3b8',
            padding:'5px 12px', borderRadius:6, cursor:'pointer', fontSize:12,
          }}>{loading ? '…' : '⟳ Refresh'}</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{background:'#13151f', borderBottom:'1px solid #1e2235', padding:'0 24px', display:'flex', gap:0}}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background:'none', border:'none', padding:'12px 16px',
            cursor:'pointer', fontSize:13, fontWeight: tab===t ? 600 : 400,
            color: tab===t ? '#a5b4fc' : '#64748b',
            borderBottom: tab===t ? '2px solid #6366f1' : '2px solid transparent',
          }}>
            {t}{t==='Blocked' && blockedFlows.length>0 ? ` (${blockedFlows.length})` : ''}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{padding:24, maxWidth:1400, margin:'0 auto'}}>
        {tab==='Overview'      && <Overview stats={stats} sites={sites.slice(0,8)} />}
        {tab==='Sites Visited' && <SitesView sites={sites} domainFilter={domainFilter} setDomainFilter={setDomainFilter} />}
        {tab==='Live Flows'    && <FlowsView flows={flows} appFilter={appFilter} setAppFilter={setAppFilter} domainFilter={domainFilter} setDomainFilter={setDomainFilter} sortBy={sortBy} setSortBy={setSortBy} />}
        {tab==='Blocked'       && <BlockedView flows={blockedFlows} />}
      </div>
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function Overview({ stats, sites }) {
  if (!stats) return <div style={{color:'#475569', padding:40, textAlign:'center'}}>Loading…</div>

  const pieData = stats.app_distribution
    .filter(a => a.bytes > 0).slice(0,10)
    .map(a => ({ name:a.app, value:a.bytes, pct:a.pct_bytes }))

  return (
    <div>
      <div style={{display:'flex', gap:12, flexWrap:'wrap', marginBottom:24}}>
        <StatCard label="Total Flows"      value={stats.total_flows.toLocaleString()} />
        <StatCard label="Data Transferred" value={stats.total_bytes_human} sub={`${stats.total_packets.toLocaleString()} packets`} />
        <StatCard label="Unique Domains"   value={stats.unique_domains.toLocaleString()} />
        <StatCard label="Blocked Flows"    value={stats.blocked_flows.toLocaleString()} sub={stats.blocked_flows > 0 ? 'Active blocks' : 'No blocks'} />
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:24}}>
        <div style={{background:'#1a1d27', border:'1px solid #2d3148', borderRadius:10, padding:20}}>
          <div style={{fontSize:13, fontWeight:600, color:'#94a3b8', marginBottom:16}}>Traffic by Application</div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" nameKey="name" paddingAngle={2}>
                  {pieData.map((entry, i) => <Cell key={i} fill={getColor(entry.name)} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [humanBytes(v), n]} contentStyle={{background:'#1e2130', border:'1px solid #334155', borderRadius:8}} />
                <Legend formatter={(v) => <span style={{color:'#94a3b8', fontSize:12}}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div style={{color:'#475569', textAlign:'center', padding:60}}>No data yet</div>}
        </div>

        <div style={{background:'#1a1d27', border:'1px solid #2d3148', borderRadius:10, padding:20}}>
          <div style={{fontSize:13, fontWeight:600, color:'#94a3b8', marginBottom:16}}>Top Apps by Bytes</div>
          {stats.app_distribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.app_distribution.slice(0,10)} layout="vertical" margin={{left:10, right:20}}>
                <XAxis type="number" tick={{fill:'#64748b', fontSize:11}} tickFormatter={v => humanBytes(v)} />
                <YAxis type="category" dataKey="app" tick={{fill:'#94a3b8', fontSize:12}} width={90} />
                <Tooltip formatter={(v) => humanBytes(v)} contentStyle={{background:'#1e2130', border:'1px solid #334155', borderRadius:8}} />
                <Bar dataKey="bytes" radius={[0,4,4,0]}>
                  {stats.app_distribution.slice(0,10).map((entry, i) => (
                    <Cell key={i} fill={getColor(entry.app)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div style={{color:'#475569', textAlign:'center', padding:60}}>No data yet</div>}
        </div>
      </div>

      <div style={{background:'#1a1d27', border:'1px solid #2d3148', borderRadius:10, padding:20}}>
        <div style={{fontSize:13, fontWeight:600, color:'#94a3b8', marginBottom:14}}>Top Sites by Traffic</div>
        <table style={{width:'100%', borderCollapse:'collapse'}}>
          <thead>
            <tr style={{borderBottom:'1px solid #1e2235'}}>
              {['Domain','App','Bytes','Packets','Flows'].map(h => (
                <th key={h} style={{textAlign:'left', padding:'6px 10px', fontSize:11, color:'#475569', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sites.map((s, i) => (
              <tr key={i} style={{borderBottom:'1px solid #1a1d2a'}}>
                <td style={{padding:'8px 10px', color: s.blocked ? '#f87171' : '#e2e8f0', fontFamily:'monospace', fontSize:12}}>{s.domain}</td>
                <td style={{padding:'8px 10px'}}><AppBadge app={s.app} /></td>
                <td style={{padding:'8px 10px', color:'#94a3b8', fontVariantNumeric:'tabular-nums'}}>{humanBytes(s.total_bytes)}</td>
                <td style={{padding:'8px 10px', color:'#64748b', fontVariantNumeric:'tabular-nums'}}>{s.total_packets.toLocaleString()}</td>
                <td style={{padding:'8px 10px', color:'#64748b'}}>{s.flow_count}</td>
              </tr>
            ))}
            {sites.length === 0 && (
              <tr><td colSpan={5} style={{padding:40, textAlign:'center', color:'#334155'}}>No data yet — start the DPI engine</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Sites Visited Tab ─────────────────────────────────────────────────────────
function SitesView({ sites, domainFilter, setDomainFilter }) {
  const filtered = sites.filter(s =>
    !domainFilter || s.domain.toLowerCase().includes(domainFilter.toLowerCase())
  )
  return (
    <div>
      <div style={{display:'flex', gap:10, marginBottom:16}}>
        <input placeholder="Filter by domain…" value={domainFilter} onChange={e => setDomainFilter(e.target.value)} style={{width:280}} />
        <span style={{color:'#475569', fontSize:12, alignSelf:'center'}}>{filtered.length} sites</span>
      </div>
      <div style={{background:'#1a1d27', border:'1px solid #2d3148', borderRadius:10, overflow:'hidden'}}>
        <table style={{width:'100%', borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:'#13151f', borderBottom:'1px solid #2d3148'}}>
              {['#','Domain / Site','App','Total Bytes','Packets','Connections','Last Seen','Status'].map(h => (
                <th key={h} style={{textAlign:'left', padding:'10px 12px', fontSize:11, color:'#475569', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={i} style={{borderBottom:'1px solid #1a1d2a', background: i%2===0 ? 'transparent' : '#161927'}}>
                <td style={{padding:'9px 12px', color:'#334155', fontSize:12}}>{i+1}</td>
                <td style={{padding:'9px 12px', fontFamily:'monospace', fontSize:12, color: s.blocked ? '#f87171' : '#c7d2fe', maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.domain}</td>
                <td style={{padding:'9px 12px'}}><AppBadge app={s.app} /></td>
                <td style={{padding:'9px 12px', color:'#94a3b8', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap'}}>{humanBytes(s.total_bytes)}</td>
                <td style={{padding:'9px 12px', color:'#64748b', fontVariantNumeric:'tabular-nums'}}>{s.total_packets.toLocaleString()}</td>
                <td style={{padding:'9px 12px', color:'#64748b'}}>{s.flow_count}</td>
                <td style={{padding:'9px 12px', color:'#475569', whiteSpace:'nowrap', fontSize:11}}>{timeAgo(s.last_seen)}</td>
                <td style={{padding:'9px 12px'}}>
                  {s.blocked
                    ? <span style={{color:'#f87171', fontSize:11, fontWeight:600}}>BLOCKED</span>
                    : <span style={{color:'#4ade80', fontSize:11}}>OK</span>}
                </td>
              </tr>
            ))}
            {filtered.length===0 && <tr><td colSpan={8} style={{padding:40, textAlign:'center', color:'#334155'}}>No sites found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Live Flows Tab ────────────────────────────────────────────────────────────
function FlowsView({ flows, appFilter, setAppFilter, domainFilter, setDomainFilter, sortBy, setSortBy }) {
  const apps = [...new Set(flows.map(f => f.app).filter(Boolean))].sort()
  return (
    <div>
      <div style={{display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center'}}>
        <input placeholder="Filter by domain…" value={domainFilter} onChange={e => setDomainFilter(e.target.value)} style={{width:220}} />
        <select value={appFilter} onChange={e => setAppFilter(e.target.value)}>
          <option value="">All apps</option>
          {apps.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="bytes">Sort: Bytes</option>
          <option value="packets">Sort: Packets</option>
          <option value="last_seen">Sort: Last Seen</option>
          <option value="domain">Sort: Domain</option>
        </select>
        <span style={{color:'#475569', fontSize:12, marginLeft:4}}>{flows.length} flows</span>
      </div>
      <div style={{background:'#1a1d27', border:'1px solid #2d3148', borderRadius:10, overflow:'auto', maxHeight:'calc(100vh - 280px)'}}>
        <table style={{width:'100%', borderCollapse:'collapse', minWidth:900}}>
          <thead style={{position:'sticky', top:0, zIndex:1}}>
            <tr style={{background:'#13151f', borderBottom:'1px solid #2d3148'}}>
              {['Source','Destination','Domain / SNI','App','Proto','Bytes','Packets','Last Seen',''].map(h => (
                <th key={h} style={{textAlign:'left', padding:'10px 10px', fontSize:11, color:'#475569', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em', whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {flows.map((f, i) => (
              <tr key={i} style={{borderBottom:'1px solid #16192a', background: f.blocked ? '#2b0d0d22' : (i%2===0 ? 'transparent' : '#161927')}}>
                <td style={{padding:'7px 10px', fontFamily:'monospace', fontSize:11, color:'#94a3b8', whiteSpace:'nowrap'}}>{f.src_ip}:{f.src_port}</td>
                <td style={{padding:'7px 10px', fontFamily:'monospace', fontSize:11, color:'#94a3b8', whiteSpace:'nowrap'}}>{f.dst_ip}:{f.dst_port}</td>
                <td style={{padding:'7px 10px', fontFamily:'monospace', fontSize:11, color:'#c7d2fe', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{f.domain || <span style={{color:'#334155'}}>—</span>}</td>
                <td style={{padding:'7px 10px'}}><AppBadge app={f.app} /></td>
                <td style={{padding:'7px 10px', color:'#475569', fontSize:11}}>{f.protocol===6?'TCP':f.protocol===17?'UDP':f.protocol}</td>
                <td style={{padding:'7px 10px', color:'#94a3b8', fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap'}}>{humanBytes(f.bytes)}</td>
                <td style={{padding:'7px 10px', color:'#64748b', fontVariantNumeric:'tabular-nums'}}>{f.packets?.toLocaleString()}</td>
                <td style={{padding:'7px 10px', color:'#475569', fontSize:11, whiteSpace:'nowrap'}}>{timeAgo(f.last_seen)}</td>
                <td style={{padding:'7px 10px'}}>
                  {f.blocked && <span style={{color:'#f87171', fontSize:10, fontWeight:700}}>BLOCKED</span>}
                  {f.is_quic && <span style={{color:'#a78bfa', fontSize:10, marginLeft:4}}>QUIC</span>}
                </td>
              </tr>
            ))}
            {flows.length===0 && <tr><td colSpan={9} style={{padding:40, textAlign:'center', color:'#334155'}}>No flows yet — start the DPI engine</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Blocked Flows Tab ─────────────────────────────────────────────────────────
function BlockedView({ flows }) {
  return (
    <div>
      <div style={{marginBottom:16, fontSize:13, color:'#475569'}}>
        {flows.length} blocked flow{flows.length!==1?'s':''} detected
      </div>
      {flows.length===0 ? (
        <div style={{background:'#1a1d27', border:'1px solid #2d3148', borderRadius:10, padding:60, textAlign:'center', color:'#334155'}}>
          No blocked flows — add rules with --block-app or --block-domain flags
        </div>
      ) : (
        <div style={{background:'#1a1d27', border:'1px solid #2d3148', borderRadius:10, overflow:'hidden'}}>
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#13151f', borderBottom:'1px solid #2d3148'}}>
                {['Source IP','Destination','Domain','App','Bytes Blocked','Packets Blocked'].map(h => (
                  <th key={h} style={{textAlign:'left', padding:'10px 12px', fontSize:11, color:'#475569', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flows.map((f, i) => (
                <tr key={i} style={{borderBottom:'1px solid #1a1d2a', background:'#2b0d0d11'}}>
                  <td style={{padding:'9px 12px', fontFamily:'monospace', fontSize:12, color:'#f87171'}}>{f.src_ip}</td>
                  <td style={{padding:'9px 12px', fontFamily:'monospace', fontSize:11, color:'#94a3b8'}}>{f.dst_ip}:{f.dst_port}</td>
                  <td style={{padding:'9px 12px', fontFamily:'monospace', fontSize:12, color:'#fca5a5'}}>{f.domain||'—'}</td>
                  <td style={{padding:'9px 12px'}}><AppBadge app={f.app} /></td>
                  <td style={{padding:'9px 12px', color:'#f87171', fontVariantNumeric:'tabular-nums'}}>{humanBytes(f.bytes)}</td>
                  <td style={{padding:'9px 12px', color:'#f87171', fontVariantNumeric:'tabular-nums'}}>{f.packets?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
