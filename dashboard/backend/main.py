"""
FlowSentinel Dashboard Backend
Run: uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json
import os
import time
from pathlib import Path
from typing import Optional
from collections import defaultdict

app = FastAPI(title="FlowSentinel Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FLOWS_FILE_CANDIDATES = [
    Path(os.environ.get("FLOWS_JSON_PATH", "flows.json")),
    Path("flows.json"),
    Path("../../flows.json"),
    Path("../../build/flows.json"),
    Path("../../../flows.json"),
    Path("../../../build/flows.json"),
    Path(__file__).parent.parent.parent / "flows.json",
    Path(__file__).parent.parent.parent / "build" / "flows.json",
]


def find_flows_file():
    for p in FLOWS_FILE_CANDIDATES:
        if p.exists():
            return p
    return None


def load_flows():
    path = find_flows_file()
    if path is None:
        return []
    try:
        with open(path, "r") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception:
        return []


def human_bytes(b):
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if b < 1024:
            return f"{b:.1f} {unit}"
        b /= 1024
    return f"{b:.1f} PB"


@app.get("/api/status")
def get_status():
    path = find_flows_file()
    flows = load_flows()
    return {
        "flows_file": str(path) if path else None,
        "flows_file_found": path is not None,
        "total_flows": len(flows),
        "last_updated": os.path.getmtime(path) if path and path.exists() else None,
    }


@app.get("/api/flows")
def get_flows(
    limit: int = 500,
    app_filter: Optional[str] = None,
    domain_filter: Optional[str] = None,
    blocked_only: bool = False,
    sort_by: str = "bytes",
    sort_desc: bool = True,
):
    flows = load_flows()
    if blocked_only:
        flows = [f for f in flows if f.get("blocked")]
    if app_filter:
        flows = [f for f in flows if f.get("app", "").lower() == app_filter.lower()]
    if domain_filter:
        flows = [f for f in flows if domain_filter.lower() in f.get("domain", "").lower()]
    valid_keys = {"bytes", "packets", "last_seen", "domain", "app"}
    if sort_by not in valid_keys:
        sort_by = "bytes"
    flows.sort(key=lambda f: f.get(sort_by, 0) or 0, reverse=sort_desc)
    return flows[:limit]


@app.get("/api/sites")
def get_sites(limit: int = 100):
    flows = load_flows()
    site_stats = defaultdict(lambda: {
        "domain": "",
        "app": "UNKNOWN",
        "total_bytes": 0,
        "total_packets": 0,
        "flow_count": 0,
        "blocked": False,
        "last_seen": 0,
    })
    for flow in flows:
        domain = flow.get("domain", "")
        app = flow.get("app", "UNKNOWN")
        # Skip flows with no domain and generic app types
        if not domain:
            if app and app not in ("Unknown", "UNKNOWN", "HTTPS", "HTTP", ""):
                domain = f"[{app} traffic]"
            else:
                continue
        key = domain
        site_stats[key]["domain"] = domain
        site_stats[key]["app"] = app
        site_stats[key]["total_bytes"] += flow.get("bytes", 0)
        site_stats[key]["total_packets"] += flow.get("packets", 0)
        site_stats[key]["flow_count"] += 1
        if flow.get("blocked"):
            site_stats[key]["blocked"] = True
        site_stats[key]["last_seen"] = max(
            site_stats[key]["last_seen"],
            flow.get("last_seen", 0)
        )
    result = list(site_stats.values())
    result.sort(key=lambda x: x["total_bytes"], reverse=True)
    return result[:limit]


@app.get("/api/stats")
def get_stats():
    flows = load_flows()
    total_bytes = sum(f.get("bytes", 0) for f in flows)
    total_packets = sum(f.get("packets", 0) for f in flows)
    blocked_flows = sum(1 for f in flows if f.get("blocked"))

    app_bytes = defaultdict(int)
    app_packets = defaultdict(int)
    app_flows = defaultdict(int)
    for flow in flows:
        a = flow.get("app", "UNKNOWN")
        app_bytes[a] += flow.get("bytes", 0)
        app_packets[a] += flow.get("packets", 0)
        app_flows[a] += 1

    app_distribution = [
        {
            "app": a,
            "bytes": app_bytes[a],
            "packets": app_packets[a],
            "flows": app_flows[a],
            "pct_bytes": round(100.0 * app_bytes[a] / total_bytes, 1) if total_bytes > 0 else 0,
        }
        for a in app_bytes
    ]
    app_distribution.sort(key=lambda x: x["bytes"], reverse=True)

    # Count unique real domains only (not [App traffic] entries)
    unique_domains = len({
        f.get("domain", "")
        for f in flows
        if f.get("domain", "") and not f.get("domain", "").startswith("[")
    })

    return {
        "total_flows": len(flows),
        "total_bytes": total_bytes,
        "total_bytes_human": human_bytes(total_bytes),
        "total_packets": total_packets,
        "blocked_flows": blocked_flows,
        "unique_domains": unique_domains,
        "app_distribution": app_distribution,
    }


@app.get("/api/blocklist")
def get_blocklist():
    flows = load_flows()
    blocked = [f for f in flows if f.get("blocked")]
    blocked.sort(key=lambda f: f.get("bytes", 0), reverse=True)
    return blocked


@app.get("/api/traffic_timeline")
def get_traffic_timeline(bucket_count: int = 60):
    flows = load_flows()
    if not flows:
        return {"buckets": [], "labels": []}
    timestamps = [f.get("last_seen", 0) for f in flows if f.get("last_seen", 0) > 0]
    if not timestamps:
        return {"buckets": [], "labels": []}
    min_t = min(timestamps)
    max_t = max(timestamps)
    if max_t == min_t:
        return {"buckets": [sum(f.get("bytes", 0) for f in flows)], "labels": ["now"]}
    bucket_size = (max_t - min_t) / bucket_count
    buckets = [0] * bucket_count
    for flow in flows:
        t = flow.get("last_seen", 0)
        if t <= 0:
            continue
        idx = min(int((t - min_t) / bucket_size), bucket_count - 1)
        buckets[idx] += flow.get("bytes", 0)
    labels = [
        time.strftime("%H:%M:%S", time.localtime((min_t + i * bucket_size) / 1000))
        for i in range(bucket_count)
    ]
    return {"buckets": buckets, "labels": labels}
