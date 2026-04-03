# FlowSentinel Dashboard

Real-time network traffic analysis dashboard for the FlowSentinel DPI engine.

## Architecture

```
C++ DPI Engine → flows.json (every 3s)
                     ↓
FastAPI Backend  → reads flows.json, serves REST at :8000
                     ↓
React Frontend   → polls /api/* every 4s, renders at :5173
```

## Quick Start

### 1. Start the DPI Engine

```bash
# Live capture
./build/flowsentinel.exe --live "Realtek RTL8822CE 802.11ac PCIe Adapter"

# PCAP file
./build/flowsentinel.exe input.pcap output.pcap
```

This writes `flows.json` to the current directory every 3 seconds.

### 2. Start the Backend

```bash
cd dashboard/backend
pip install -r requirements.txt
# Point to flows.json (run from project root):
FLOWS_JSON_PATH=../../flows.json uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Start the Frontend

```bash
cd dashboard/frontend
npm install
npm run dev
# Open http://localhost:5173
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/status` | Engine status + flows.json path |
| `GET /api/stats` | Aggregate bytes, packets, app distribution |
| `GET /api/sites` | Unique domains sorted by bytes |
| `GET /api/flows` | Raw flow list (supports filtering) |
| `GET /api/blocklist` | Blocked flows only |
| `GET /api/traffic_timeline` | Bytes bucketed by time |

## Dashboard Tabs

- **Overview** — stat cards, traffic pie chart, top apps bar chart, top sites table  
- **Sites Visited** — all unique domains with bytes, packets, app classification  
- **Live Flows** — per-flow 5-tuple table with domain/app filter and sort  
- **Blocked** — flows blocked by `--block-app` or `--block-domain` rules
