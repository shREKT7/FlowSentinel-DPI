const BASE = '/api'

export async function fetchStats() {
  const r = await fetch(`${BASE}/stats`)
  if (!r.ok) throw new Error('Failed to fetch stats')
  return r.json()
}

export async function fetchSites(limit = 100) {
  const r = await fetch(`${BASE}/sites?limit=${limit}`)
  if (!r.ok) throw new Error('Failed to fetch sites')
  return r.json()
}

export async function fetchFlows({ limit = 200, appFilter = '', domainFilter = '', blockedOnly = false, sortBy = 'bytes' } = {}) {
  const params = new URLSearchParams({
    limit,
    sort_by: sortBy,
    sort_desc: 'true',
    ...(appFilter && { app_filter: appFilter }),
    ...(domainFilter && { domain_filter: domainFilter }),
    ...(blockedOnly && { blocked_only: 'true' }),
  })
  const r = await fetch(`${BASE}/flows?${params}`)
  if (!r.ok) throw new Error('Failed to fetch flows')
  return r.json()
}

export async function fetchStatus() {
  const r = await fetch(`${BASE}/status`)
  if (!r.ok) throw new Error('Failed to fetch status')
  return r.json()
}

export function humanBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let b = bytes
  for (const unit of units) {
    if (b < 1024) return `${b.toFixed(1)} ${unit}`
    b /= 1024
  }
  return `${b.toFixed(1)} PB`
}

export function timeAgo(ms) {
  if (!ms) return '—'
  const diff = Date.now() - ms
  if (diff < 60000) return `${Math.round(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`
  return `${Math.round(diff / 3600000)}h ago`
}
