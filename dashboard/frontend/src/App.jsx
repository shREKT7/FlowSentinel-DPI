import { useState, useEffect, useCallback } from "react"
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts"
import { fetchStats, fetchSites, fetchFlows, fetchStatus, humanBytes, timeAgo } from "./api.js"

const APP_COLORS = {
  YOUTUBE:"#FF0000",GOOGLE:"#4285F4",FACEBOOK:"#1877F2",INSTAGRAM:"#E1306C",
  "TWITTER/X":"#1DA1F2",NETFLIX:"#E50914",AMAZON:"#FF9900",MICROSOFT:"#00BCF2",
  APPLE:"#86868b",TELEGRAM:"#2CA5E0",TIKTOK:"#69C9D0",SPOTIFY:"#1DB954",
  ZOOM:"#2D8CFF",DISCORD:"#5865F2",GITHUB:"#6e40c9",CLOUDFLARE:"#F48120",
  OPENAI:"#10a37f",HOTSTAR:"#ff2d55",REDDIT:"#FF4500",TWITCH:"#9146FF",
  LINKEDIN:"#0A66C2",DNS:"#10b981",HTTPS:"#475569",HTTP:"#64748b",
  QUIC:"#7c3aed",UNKNOWN:"#1e293b",
}
const getColor = (app) => APP_COLORS[(app||"").toUpperCase()] || "#334155"

const mono = { fontFamily:"'JetBrains Mono',monospace" }
const card = {
  background:"#0d1421", border:"1px solid #1a2540",
  borderRadius:8, padding:"16px 20px",
}

function Badge({ app }) {
  const c = getColor(app)
  return (
    <span style={{
      ...mono, display:"inline-block", padding:"2px 10px", borderRadius:4,
      fontSize:11, fontWeight:600, letterSpacing:"0.05em",
      background:c+"22", color:c, border:`1px solid ${c}44`,
    }}>{app||"UNKNOWN"}</span>
  )
}

function StatCard({ label, value, sub, accent="#00d4ff" }) {
  return (
    <div style={{
      ...card, flex:1, minWidth:160,
      borderLeft:`3px solid ${accent}`,
    }}>
      <div style={{
        ...mono, fontSize:10, color:"#64748b",
        letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8,
      }}>{label}</div>
      <div style={{ ...mono, fontSize:26, fontWeight:700, color:"#e2e8f0", lineHeight:1 }}>{value}</div>
      {sub && <div style={{ ...mono, fontSize:11, color:"#64748b", marginTop:6 }}>{sub}</div>}
    </div>
  )
}

function Panel({ title, children, style={} }) {
  return (
    <div style={{ ...card, ...style }}>
      {title && <div style={{
        ...mono, fontSize:10, color:"#64748b",
        letterSpacing:"0.12em", textTransform:"uppercase",
        fontWeight:600, marginBottom:16,
      }}>{title}</div>}
      {children}
    </div>
  )
}

function ChartTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div style={{
      background:"#0d1421", border:"1px solid #1a2540",
      borderRadius:8, padding:"10px 14px",
    }}>
      <div style={{ ...mono, fontSize:12, color:"#e2e8f0" }}>
        {p.name || p.payload?.app}
      </div>
      <div style={{ ...mono, fontSize:11, color:"#64748b" }}>
        {humanBytes(p.value)} — {p.payload?.pct_bytes?.toFixed(1)}%
      </div>
    </div>
  )
}

function BarTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background:"#0d1421", border:"1px solid #1a2540",
      borderRadius:8, padding:"10px 14px",
    }}>
      <div style={{ ...mono, fontSize:12, color:"#e2e8f0" }}>{label}</div>
      <div style={{ ...mono, fontSize:11, color:"#64748b" }}>{humanBytes(payload[0]?.value)}</div>
    </div>
  )
}

function Overview({ stats, sites }) {
  const pie = stats?.app_distribution?.filter(a => a.bytes > 0) || []
  const bars = stats?.app_distribution?.slice(0,8) || []
  const topSites = sites?.slice(0,8) || []

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* Stat cards */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        <StatCard label="Total Flows"      value={stats?.total_flows?.toLocaleString() || "—"} accent="#00d4ff" />
        <StatCard label="Data Transferred" value={stats?.total_bytes_human || "—"}
                  sub={`${(stats?.total_packets||0).toLocaleString()} packets`} accent="#7c3aed" />
        <StatCard label="Unique Domains"   value={stats?.unique_domains?.toLocaleString() || "—"} accent="#10b981" />
        <StatCard label="Blocked Flows"    value={stats?.blocked_flows?.toLocaleString() || "0"} accent="#ef4444" />
      </div>

      {/* Charts row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <Panel title="Traffic by Application">
          {pie.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pie} dataKey="bytes" nameKey="app"
                       innerRadius={60} outerRadius={95} paddingAngle={2}>
                    {pie.map((e,i) => <Cell key={i} fill={getColor(e.app)} />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                  <Legend
                    formatter={(v) => (
                      <span style={{ ...mono, color:"#94a3b8", fontSize:11 }}>{v}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div style={{ color:"#334155", textAlign:"center", padding:60, ...mono, fontSize:12 }}>
              Waiting for data…
            </div>
          )}
        </Panel>

        <Panel title="Top Apps by Bytes">
          {bars.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bars} layout="vertical" margin={{ left:8, right:40 }}>
                <XAxis type="number" tick={{ fill:"#64748b", fontSize:10, fontFamily:"JetBrains Mono" }}
                       tickFormatter={humanBytes} />
                <YAxis type="category" dataKey="app" width={85}
                       tick={{ fill:"#94a3b8", fontSize:11, fontFamily:"JetBrains Mono" }} />
                <Tooltip content={<BarTip />} />
                <Bar dataKey="bytes" radius={[0,4,4,0]}>
                  {bars.map((e,i) => <Cell key={i} fill={getColor(e.app)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color:"#334155", textAlign:"center", padding:60, ...mono, fontSize:12 }}>
              Waiting for data…
            </div>
          )}
        </Panel>
      </div>

      {/* Top sites table */}
      <Panel title="Top Sites by Traffic">
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:"1px solid #1a2540" }}>
              {["#","Domain","App","Bytes","Packets","Flows"].map(h => (
                <th key={h} style={{
                  textAlign:"left", padding:"6px 10px",
                  fontSize:10, color:"#475569", fontWeight:600,
                  textTransform:"uppercase", letterSpacing:"0.07em",
                  fontFamily:"JetBrains Mono",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topSites.map((s,i) => (
              <tr key={i} style={{ borderBottom:"1px solid #0d1421" }}>
                <td style={{ padding:"9px 10px", color:"#334155", ...mono, fontSize:11 }}>{i+1}</td>
                <td style={{
                  padding:"9px 10px", ...mono, fontSize:11,
                  color: s.blocked ? "#ef4444" : "#c7d2fe",
                  maxWidth:300, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                }}>{s.domain}</td>
                <td style={{ padding:"9px 10px" }}><Badge app={s.app} /></td>
                <td style={{ padding:"9px 10px", color:"#94a3b8", ...mono, fontSize:11 }}>{humanBytes(s.total_bytes)}</td>
                <td style={{ padding:"9px 10px", color:"#64748b", ...mono, fontSize:11 }}>{(s.total_packets||0).toLocaleString()}</td>
                <td style={{ padding:"9px 10px", color:"#64748b", ...mono, fontSize:11 }}>{s.flow_count}</td>
              </tr>
            ))}
            {topSites.length === 0 && (
              <tr><td colSpan={6} style={{ padding:40, textAlign:"center", color:"#334155", ...mono, fontSize:12 }}>
                No data yet — start the DPI engine
              </td></tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}

function SitesView({ sites }) {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState("total_bytes")
  const [sortDesc, setSortDesc] = useState(true)

  const toggleSort = (key) => {
    if (sortKey === key) setSortDesc(d => !d)
    else { setSortKey(key); setSortDesc(true) }
  }

  const filtered = (sites || [])
    .filter(s => !search || s.domain?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => sortDesc
      ? (b[sortKey]||0) - (a[sortKey]||0)
      : (a[sortKey]||0) - (b[sortKey]||0)
    )

  const SortHeader = ({ k, label }) => (
    <th onClick={() => toggleSort(k)} style={{
      textAlign:"left", padding:"8px 10px",
      fontSize:10, color: sortKey===k ? "#00d4ff" : "#475569",
      fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em",
      fontFamily:"JetBrains Mono", cursor:"pointer", userSelect:"none",
      whiteSpace:"nowrap",
    }}>
      {label} {sortKey===k ? (sortDesc?"↓":"↑") : ""}
    </th>
  )

  return (
    <div>
      <div style={{ display:"flex", gap:10, marginBottom:16, alignItems:"center" }}>
        <input placeholder="Filter by domain…" value={search}
               onChange={e => setSearch(e.target.value)} style={{ width:280 }} />
        <span style={{ ...mono, fontSize:11, color:"#475569" }}>{filtered.length} sites</span>
      </div>
      <Panel>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#080c14", borderBottom:"1px solid #1a2540" }}>
              <th style={{ padding:"8px 10px", fontSize:10, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", fontFamily:"JetBrains Mono", textAlign:"left" }}>#</th>
              <SortHeader k="domain" label="Domain" />
              <th style={{ padding:"8px 10px", fontSize:10, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", fontFamily:"JetBrains Mono", textAlign:"left" }}>App</th>
              <SortHeader k="total_bytes" label="Bytes" />
              <SortHeader k="total_packets" label="Packets" />
              <SortHeader k="flow_count" label="Flows" />
              <th style={{ padding:"8px 10px", fontSize:10, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", fontFamily:"JetBrains Mono", textAlign:"left" }}>Last Seen</th>
              <th style={{ padding:"8px 10px", fontSize:10, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", fontFamily:"JetBrains Mono", textAlign:"left" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s,i) => (
              <tr key={i} style={{ borderBottom:"1px solid #0d1421", background: i%2===0?"transparent":"#0a0f1c" }}>
                <td style={{ padding:"8px 10px", color:"#334155", ...mono, fontSize:11 }}>{i+1}</td>
                <td style={{
                  padding:"8px 10px", ...mono, fontSize:11,
                  color: s.blocked ? "#ef4444" : "#c7d2fe",
                  maxWidth:280, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                }}>{s.domain}</td>
                <td style={{ padding:"8px 10px" }}><Badge app={s.app} /></td>
                <td style={{ padding:"8px 10px", color:"#94a3b8", ...mono, fontSize:11 }}>{humanBytes(s.total_bytes)}</td>
                <td style={{ padding:"8px 10px", color:"#64748b", ...mono, fontSize:11 }}>{(s.total_packets||0).toLocaleString()}</td>
                <td style={{ padding:"8px 10px", color:"#64748b", ...mono, fontSize:11 }}>{s.flow_count}</td>
                <td style={{ padding:"8px 10px", color:"#475569", ...mono, fontSize:10 }}>{timeAgo(s.last_seen)}</td>
                <td style={{ padding:"8px 10px" }}>
                  {s.blocked
                    ? <span style={{ color:"#ef4444", ...mono, fontSize:10, fontWeight:700 }}>BLOCKED</span>
                    : <span style={{ color:"#10b981", ...mono, fontSize:10 }}>OK</span>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding:40, textAlign:"center", color:"#334155", ...mono, fontSize:12 }}>
                No sites found
              </td></tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}

function FlowsView({ flows }) {
  const [domain, setDomain] = useState("")
  const [app, setApp] = useState("")
  const [blockedOnly, setBlockedOnly] = useState(false)

  const apps = [...new Set((flows||[]).map(f => f.app).filter(Boolean))].sort()

  const filtered = (flows||[]).filter(f =>
    (!domain || f.domain?.toLowerCase().includes(domain.toLowerCase())) &&
    (!app || f.app === app) &&
    (!blockedOnly || f.blocked)
  )

  return (
    <div>
      <div style={{ display:"flex", gap:10, marginBottom:16, alignItems:"center", flexWrap:"wrap" }}>
        <input placeholder="Filter domain…" value={domain}
               onChange={e => setDomain(e.target.value)} style={{ width:200 }} />
        <select value={app} onChange={e => setApp(e.target.value)}>
          <option value="">All apps</option>
          {apps.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", color:"#64748b", fontSize:12 }}>
          <input type="checkbox" checked={blockedOnly} onChange={e => setBlockedOnly(e.target.checked)} />
          Blocked only
        </label>
        <span style={{ ...mono, fontSize:11, color:"#475569" }}>{filtered.length} flows</span>
      </div>
      <Panel>
        <div style={{ overflowX:"auto", maxHeight:"calc(100vh - 240px)", overflowY:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:900 }}>
            <thead style={{ position:"sticky", top:0, background:"#0d1421", zIndex:1 }}>
              <tr style={{ borderBottom:"1px solid #1a2540" }}>
                {["Source","Destination","Domain","App","Proto","Bytes","Packets","Flags"].map(h => (
                  <th key={h} style={{
                    textAlign:"left", padding:"8px 10px",
                    fontSize:10, color:"#475569", fontWeight:600,
                    textTransform:"uppercase", letterSpacing:"0.07em",
                    fontFamily:"JetBrains Mono", whiteSpace:"nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f,i) => (
                <tr key={i} style={{
                  borderBottom:"1px solid #0a0f1c",
                  background: f.blocked ? "#2b0d0d18" : (i%2===0?"transparent":"#0a0f1c"),
                }}>
                  <td style={{ padding:"7px 10px", ...mono, fontSize:11, color:"#94a3b8", whiteSpace:"nowrap" }}>
                    {f.src_ip}:{f.src_port}
                  </td>
                  <td style={{ padding:"7px 10px", ...mono, fontSize:11, color:"#94a3b8", whiteSpace:"nowrap" }}>
                    {f.dst_ip}:{f.dst_port}
                  </td>
                  <td style={{
                    padding:"7px 10px", ...mono, fontSize:11, color:"#c7d2fe",
                    maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                  }}>{f.domain || <span style={{ color:"#334155" }}>—</span>}</td>
                  <td style={{ padding:"7px 10px" }}><Badge app={f.app} /></td>
                  <td style={{ padding:"7px 10px", ...mono, fontSize:11, color:"#475569" }}>
                    {f.protocol===6?"TCP":f.protocol===17?"UDP":f.protocol}
                  </td>
                  <td style={{ padding:"7px 10px", ...mono, fontSize:11, color:"#94a3b8", whiteSpace:"nowrap" }}>
                    {humanBytes(f.bytes)}
                  </td>
                  <td style={{ padding:"7px 10px", ...mono, fontSize:11, color:"#64748b" }}>
                    {(f.packets||0).toLocaleString()}
                  </td>
                  <td style={{ padding:"7px 10px" }}>
                    {f.is_quic && <span style={{ ...mono, fontSize:10, color:"#7c3aed", fontWeight:700, marginRight:4 }}>QUIC</span>}
                    {f.blocked && <span style={{ ...mono, fontSize:10, color:"#ef4444", fontWeight:700 }}>BLOCKED</span>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ padding:40, textAlign:"center", color:"#334155", ...mono, fontSize:12 }}>
                  No flows matching filters
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

function BlockedView({ flows }) {
  const blocked = (flows||[]).filter(f => f.blocked)
  if (blocked.length === 0) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:400, gap:20 }}>
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
        <path d="M32 4L8 16v20c0 13.3 10.3 25.7 24 28 13.7-2.3 24-14.7 24-28V16L32 4z"
              stroke="#1a2540" strokeWidth="2" fill="#0d1421"/>
        <path d="M32 4L8 16v20c0 13.3 10.3 25.7 24 28 13.7-2.3 24-14.7 24-28V16L32 4z"
              stroke="#00d4ff" strokeWidth="1.5" fill="none"/>
        <path d="M22 32l8 8 12-12" stroke="#10b981" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div style={{ textAlign:"center" }}>
        <div style={{ ...mono, fontSize:14, color:"#64748b", marginBottom:8 }}>No blocked flows</div>
        <div style={{ ...mono, fontSize:11, color:"#334155" }}>
          Add rules with --block-app YouTube or --block-domain tiktok.com
        </div>
      </div>
    </div>
  )

  return (
    <Panel>
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead>
          <tr style={{ borderBottom:"1px solid #1a2540" }}>
            {["Source IP","Destination","Domain","App","Bytes Blocked","Packets"].map(h => (
              <th key={h} style={{
                textAlign:"left", padding:"8px 12px",
                fontSize:10, color:"#475569", fontWeight:600,
                textTransform:"uppercase", letterSpacing:"0.07em",
                fontFamily:"JetBrains Mono",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {blocked.map((f,i) => (
            <tr key={i} style={{ borderBottom:"1px solid #0d1421", background:"#2b0d0d18" }}>
              <td style={{ padding:"9px 12px", ...mono, fontSize:11, color:"#ef4444" }}>{f.src_ip}</td>
              <td style={{ padding:"9px 12px", ...mono, fontSize:11, color:"#94a3b8" }}>{f.dst_ip}:{f.dst_port}</td>
              <td style={{ padding:"9px 12px", ...mono, fontSize:11, color:"#fca5a5" }}>{f.domain||"—"}</td>
              <td style={{ padding:"9px 12px" }}><Badge app={f.app} /></td>
              <td style={{ padding:"9px 12px", ...mono, fontSize:11, color:"#ef4444" }}>{humanBytes(f.bytes)}</td>
              <td style={{ padding:"9px 12px", ...mono, fontSize:11, color:"#ef4444" }}>{(f.packets||0).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

const TABS = ["Overview","Sites Visited","Live Flows","Blocked"]

export default function App() {
  const [tab, setTab] = useState("Overview")
  const [stats, setStats] = useState(null)
  const [sites, setSites] = useState([])
  const [flows, setFlows] = useState([])
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [s, si, st, fl] = await Promise.allSettled([
        fetchStats(), fetchSites(200), fetchStatus(), fetchFlows({ limit:300 })
      ])
      if (s.status  === "fulfilled") setStats(s.value)
      if (si.status === "fulfilled") setSites(si.value)
      if (st.status === "fulfilled") setStatus(st.value)
      if (fl.status === "fulfilled") setFlows(fl.value)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [])

  useEffect(() => {
    const id = setInterval(refresh, 4000)
    return () => clearInterval(id)
  }, [])

  const ok = status?.flows_file_found
  const blocked = (flows||[]).filter(f => f.blocked)

  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden", background:"#080c14" }}>
      {/* Sidebar */}
      <div style={{
        width:220, flexShrink:0,
        background:"#0d1421", borderRight:"1px solid #1a2540",
        display:"flex", flexDirection:"column", height:"100vh",
      }}>
        {/* Logo */}
        <div style={{ padding:"20px 16px 16px", borderBottom:"1px solid #1a2540" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{
              width:32, height:32, borderRadius:8,
              background:"#00d4ff11", border:"1px solid #00d4ff44",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:16, fontWeight:700, color:"#00d4ff", fontFamily:"JetBrains Mono",
            }}>F</div>
            <div>
              <div style={{ fontWeight:600, fontSize:13, color:"#e2e8f0", fontFamily:"Inter,sans-serif" }}>FlowSentinel</div>
              <div style={{ fontSize:10, color:"#475569", letterSpacing:"0.08em", textTransform:"uppercase", fontFamily:"JetBrains Mono" }}>DPI Dashboard</div>
            </div>
          </div>
        </div>

        {/* Engine status */}
        <div style={{ padding:"12px 16px", borderBottom:"1px solid #1a2540" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:ok?6:0 }}>
            <div style={{
              width:8, height:8, borderRadius:"50%",
              background: ok ? "#10b981" : "#ef4444",
              animation: ok ? "pulse 2s ease-in-out infinite" : "none",
            }} />
            <span style={{
              fontSize:10, fontWeight:600, letterSpacing:"0.08em",
              color: ok ? "#10b981" : "#ef4444",
              fontFamily:"JetBrains Mono",
            }}>{ok ? "ENGINE ACTIVE" : "ENGINE OFFLINE"}</span>
          </div>
          {ok && <>
            <div style={{ ...mono, fontSize:11, color:"#64748b" }}>{status.total_flows} flows tracked</div>
            <div style={{ ...mono, fontSize:10, color:"#334155", wordBreak:"break-all", marginTop:2 }}>{status.flows_file}</div>
          </>}
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:"8px 0" }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              display:"block", width:"100%", textAlign:"left",
              background:"none", border:"none",
              borderLeft: tab===t ? "2px solid #00d4ff" : "2px solid transparent",
              padding:"10px 16px",
              color: tab===t ? "#00d4ff" : "#64748b",
              fontFamily:"Inter,sans-serif", fontSize:13,
              fontWeight: tab===t ? 500 : 400,
              cursor:"pointer", transition:"color 0.1s",
              borderRadius:0,
            }}>
              {t}{t==="Blocked" && blocked.length > 0 ? ` (${blocked.length})` : ""}
            </button>
          ))}
        </nav>

        {/* Refresh */}
        <div style={{ padding:"12px 16px", borderTop:"1px solid #1a2540" }}>
          <button onClick={refresh} style={{
            width:"100%", background:"#111827", border:"1px solid #1a2540",
            color:"#64748b", padding:"7px 0", borderRadius:6,
            fontFamily:"JetBrains Mono", fontSize:11, cursor:"pointer",
            transition:"all 0.15s",
          }}>{loading ? "…" : "↻  Refresh"}</button>
        </div>
      </div>

      {/* Main */}
      <main style={{ flex:1, overflow:"auto", padding:24 }}>
        <style>{`
          @keyframes pulse {
            0%,100%{opacity:1;transform:scale(1)}
            50%{opacity:0.5;transform:scale(0.85)}
          }
          input,select{
            background:#111827;border:1px solid #243050;color:#e2e8f0;
            padding:7px 12px;border-radius:6px;font-size:12px;
            font-family:'JetBrains Mono',monospace;outline:none;
          }
          input:focus,select:focus{border-color:#00d4ff}
          button:hover{border-color:#00d4ff!important;color:#00d4ff!important}
        `}</style>
        {tab === "Overview"      && <Overview stats={stats} sites={sites} />}
        {tab === "Sites Visited" && <SitesView sites={sites} />}
        {tab === "Live Flows"    && <FlowsView flows={flows} />}
        {tab === "Blocked"       && <BlockedView flows={flows} />}
      </main>
    </div>
  )
}
