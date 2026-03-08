// Multi-threaded DPI Engine - Fixed Version
// Architecture: Reader -> LB threads -> FP threads -> Output

#include <algorithm>
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <memory>
#include <mutex>
#include <optional>
#include <queue>
#include <thread>
#include <unordered_map>
#include <unordered_set>
#include <vector>

#include "ip_intelligence.h"
#include "live_capture.h"
#include "packet_parser.h"
#include "pcap_reader.h"
#include "sni_extractor.h"
#include "types.h"

using namespace PacketAnalyzer;
using namespace DPI;

// =============================================================================
// Hybrid Domain Intelligence Layer & DNS Correlation Engine
// =============================================================================
// The DNS correlation system extracts IP-to-Domain mappings from intercepted
// DNS response packets (UDP port 53). These mappings are stored in a
// thread-safe global table with a strict eviction strategy (10,000 limit) to
// prevent memory exhaustion. New flows check this correlation table to classify
// traffic (e.g., DoH, TLS with ECH) when the SNI is encrypted or missing.
// =============================================================================
namespace {
std::unordered_map<uint32_t, std::string> g_ip_to_domain;
std::queue<uint32_t> g_dns_fifo;
std::mutex g_dns_mutex;
const size_t MAX_DNS_CACHE_SIZE = 10000;

void addDnsMapping(uint32_t ip, const std::string &domain) {
  std::lock_guard<std::mutex> lock(g_dns_mutex);
  if (g_ip_to_domain.find(ip) == g_ip_to_domain.end()) {
    g_dns_fifo.push(ip);
  }
  g_ip_to_domain[ip] = domain;

  // Eviction strategy: remove oldest entries if size exceeds limit
  while (g_ip_to_domain.size() > MAX_DNS_CACHE_SIZE && !g_dns_fifo.empty()) {
    uint32_t oldest_ip = g_dns_fifo.front();
    g_dns_fifo.pop();
    g_ip_to_domain.erase(oldest_ip);
  }
}

void parseDNS(const uint8_t *payload, size_t length) {
  if (length < 12)
    return;
  uint16_t flags = (payload[2] << 8) | payload[3];
  if ((flags & 0x8000) == 0)
    return; // Not a response

  uint16_t qdcount = (payload[4] << 8) | payload[5];
  uint16_t ancount = (payload[6] << 8) | payload[7];

  size_t offset = 12;
  for (int i = 0; i < qdcount; ++i) {
    while (offset < length && payload[offset] != 0) {
      if ((payload[offset] & 0xC0) == 0xC0) {
        offset += 2;
        break;
      } else {
        offset += payload[offset] + 1;
      }
    }
    if (offset < length && payload[offset] == 0)
      offset++;
    offset += 4;
  }

  for (int i = 0; i < ancount; ++i) {
    if (offset >= length)
      break;

    std::string domain;
    size_t name_offset = offset;
    bool jumped = false;
    size_t jump_cnt = 0;

    while (name_offset < length && payload[name_offset] != 0) {
      if ((payload[name_offset] & 0xC0) == 0xC0) {
        if (!jumped)
          offset = name_offset + 2;
        if (name_offset + 1 >= length)
          break;
        name_offset =
            ((payload[name_offset] & 0x3F) << 8) | payload[name_offset + 1];
        jumped = true;
        if (++jump_cnt > 10)
          break;
      } else {
        uint8_t len = payload[name_offset];
        if (name_offset + 1 + len > length)
          break;
        if (!domain.empty())
          domain += ".";
        domain.append((const char *)(payload + name_offset + 1), len);
        name_offset += len + 1;
        if (!jumped)
          offset = name_offset;
      }
    }
    if (!jumped && offset < length && payload[offset] == 0)
      offset++;

    if (offset + 10 > length)
      break;
    uint16_t type = (payload[offset] << 8) | payload[offset + 1];
    uint16_t rdlength = (payload[offset + 8] << 8) | payload[offset + 9];
    offset += 10;

    if (type == 1 && rdlength == 4 && offset + 4 <= length) { // A record
      uint32_t ip = (payload[offset]) | (payload[offset + 1] << 8) |
                    (payload[offset + 2] << 16) | (payload[offset + 3] << 24);
      if (!domain.empty()) {
        addDnsMapping(ip, domain);
      }
    }
    offset += rdlength;
  }
}
} // namespace

// =============================================================================
// Thread-Safe Queue
// =============================================================================
template <typename T> class TSQueue {
public:
  TSQueue(size_t max_size = 10000) : max_size_(max_size), shutdown_(false) {}

  void push(T item) {
    std::unique_lock<std::mutex> lock(mutex_);
    not_full_.wait(lock,
                   [this] { return queue_.size() < max_size_ || shutdown_; });
    if (shutdown_)
      return;
    queue_.push(std::move(item));
    not_empty_.notify_one();
  }

  std::optional<T> pop(int timeout_ms = 100) {
    std::unique_lock<std::mutex> lock(mutex_);
    if (!not_empty_.wait_for(lock, std::chrono::milliseconds(timeout_ms),
                             [this] { return !queue_.empty() || shutdown_; })) {
      return std::nullopt;
    }
    if (queue_.empty())
      return std::nullopt;
    T item = std::move(queue_.front());
    queue_.pop();
    not_full_.notify_one();
    return item;
  }

  void shutdown() {
    std::lock_guard<std::mutex> lock(mutex_);
    shutdown_ = true;
    not_empty_.notify_all();
    not_full_.notify_all();
  }

  size_t size() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return queue_.size();
  }

  bool is_shutdown() const { return shutdown_; }

private:
  std::queue<T> queue_;
  mutable std::mutex mutex_;
  std::condition_variable not_empty_;
  std::condition_variable not_full_;
  size_t max_size_;
  std::atomic<bool> shutdown_;
};

// =============================================================================
// Packet Job - Contains all packet data (self-contained, no pointers)
// =============================================================================
struct Packet {
  uint32_t id;
  uint32_t ts_sec;
  uint32_t ts_usec;
  FiveTuple tuple;
  std::vector<uint8_t> data;
  uint8_t tcp_flags;
  size_t payload_offset;
  size_t payload_length;
};

// =============================================================================
// Flow Entry
// =============================================================================
struct FlowEntry {
  FiveTuple tuple;
  AppType app_type = AppType::UNKNOWN;
  std::string sni;
  uint64_t packets = 0;
  uint64_t bytes = 0;
  bool blocked = false;
  bool classified = false;
};

// =============================================================================
// Blocking Rules
// =============================================================================
class Rules {
public:
  void blockIP(const std::string &ip) {
    std::lock_guard<std::mutex> lock(mutex_);
    blocked_ips_.insert(parseIP(ip));
    std::cout << "[Rules] Blocked IP: " << ip << "\n";
  }

  void blockApp(const std::string &app) {
    std::lock_guard<std::mutex> lock(mutex_);
    for (int i = 0; i < static_cast<int>(AppType::APP_COUNT); i++) {
      if (appTypeToString(static_cast<AppType>(i)) == app) {
        blocked_apps_.insert(static_cast<AppType>(i));
        std::cout << "[Rules] Blocked app: " << app << "\n";
        return;
      }
    }
    std::cerr << "[Rules] Unknown app: " << app << "\n";
  }

  void blockDomain(const std::string &domain) {
    std::lock_guard<std::mutex> lock(mutex_);
    blocked_domains_.push_back(domain);
    std::cout << "[Rules] Blocked domain: " << domain << "\n";
  }

  bool isBlocked(uint32_t src_ip, AppType app, const std::string &sni) const {
    std::lock_guard<std::mutex> lock(mutex_);
    if (blocked_ips_.count(src_ip))
      return true;
    if (blocked_apps_.count(app))
      return true;
    for (const auto &dom : blocked_domains_) {
      if (sni.find(dom) != std::string::npos)
        return true;
    }
    return false;
  }

private:
  static uint32_t parseIP(const std::string &ip) {
    uint32_t result = 0;
    int octet = 0, shift = 0;
    for (char c : ip) {
      if (c == '.') {
        result |= (octet << shift);
        shift += 8;
        octet = 0;
      } else if (c >= '0' && c <= '9')
        octet = octet * 10 + (c - '0');
    }
    return result | (octet << shift);
  }

  mutable std::mutex mutex_;
  std::unordered_set<uint32_t> blocked_ips_;
  std::unordered_set<AppType> blocked_apps_;
  std::vector<std::string> blocked_domains_;
};

// =============================================================================
// Statistics (thread-safe)
// =============================================================================
struct Stats {
  std::atomic<uint64_t> total_packets{0};
  std::atomic<uint64_t> total_bytes{0};
  std::atomic<uint64_t> forwarded{0};
  std::atomic<uint64_t> dropped{0};
  std::atomic<uint64_t> tcp_packets{0};
  std::atomic<uint64_t> udp_packets{0};
  std::atomic<uint64_t> active_flows{0};

  // Per-app stats (protected by mutex)
  std::mutex app_mutex;
  std::unordered_map<AppType, uint64_t> app_counts;
  std::unordered_map<std::string, AppType> detected_snis;

  void recordApp(AppType app, const std::string &sni) {
    std::lock_guard<std::mutex> lock(app_mutex);
    app_counts[app]++;
    if (!sni.empty()) {
      detected_snis[sni] = app;
    }
  }
};

// =============================================================================
// Fast Path Processor (one per FP thread)
// =============================================================================
class FastPath {
public:
  FastPath(int id, Rules *rules, Stats *stats, TSQueue<Packet> *output_queue)
      : id_(id), rules_(rules), stats_(stats), output_queue_(output_queue) {}

  void start() {
    running_ = true;
    thread_ = std::thread(&FastPath::run, this);
  }

  void stop() {
    running_ = false;
    input_queue_.shutdown();
    if (thread_.joinable())
      thread_.join();
  }

  TSQueue<Packet> &queue() { return input_queue_; }

  uint64_t processed() const { return processed_; }

private:
  int id_;
  Rules *rules_;
  Stats *stats_;
  TSQueue<Packet> *output_queue_;
  TSQueue<Packet> input_queue_;
  std::unordered_map<FiveTuple, FlowEntry, FiveTupleHash> flows_;

  std::atomic<bool> running_{false};
  std::thread thread_;
  std::atomic<uint64_t> processed_{0};

  void run() {
    while (running_) {
      auto pkt_opt = input_queue_.pop(100);
      if (!pkt_opt)
        continue;

      processed_++;
      Packet &pkt = *pkt_opt;

      // Get or create flow
      FlowEntry &flow = flows_[pkt.tuple];
      if (flow.packets == 0) {
        flow.tuple = pkt.tuple;
        stats_->active_flows++;
      }
      flow.packets++;
      flow.bytes += pkt.data.size();

      // Try to classify if not done yet
      if (!flow.classified) {
        classifyFlow(pkt, flow);
      }

      // Check blocking
      if (!flow.blocked) {
        flow.blocked =
            rules_->isBlocked(pkt.tuple.src_ip, flow.app_type, flow.sni);
      }

      // Record stats
      stats_->recordApp(flow.app_type, flow.sni);

      // Forward or drop
      if (flow.blocked) {
        stats_->dropped++;
      } else {
        stats_->forwarded++;
        output_queue_->push(std::move(pkt));
      }
    }
  }

  void classifyFlow(Packet &pkt, FlowEntry &flow) {
    // 1. Check DNS correlation table (IP -> domain)
    {
      std::lock_guard<std::mutex> lock(g_dns_mutex);
      auto it = g_ip_to_domain.find(pkt.tuple.dst_ip);
      if (it != g_ip_to_domain.end()) {
        flow.sni = it->second;
        flow.app_type = sniToAppType(it->second);
        if (flow.app_type != AppType::UNKNOWN &&
            flow.app_type != AppType::HTTPS) {
          flow.classified = true;
          return;
        }
      }
    }

    // 2. Try SNI extraction for HTTPS
    if (pkt.tuple.dst_port == 443 && pkt.payload_length > 5) {
      const uint8_t *payload = pkt.data.data() + pkt.payload_offset;
      auto sni = SNIExtractor::extract(payload, pkt.payload_length);
      if (sni) {
        flow.sni = *sni;
        flow.app_type = sniToAppType(*sni);
        flow.classified = true;
        return;
      }
    }

    // 2.b Try HTTP Host extraction
    if (pkt.tuple.dst_port == 80 && pkt.payload_length > 10) {
      const uint8_t *payload = pkt.data.data() + pkt.payload_offset;
      auto host = HTTPHostExtractor::extract(payload, pkt.payload_length);
      if (host) {
        flow.sni = *host;
        flow.app_type = sniToAppType(*host);
        flow.classified = true;
        return;
      }
    }

    // DNS (extract mappings for feature 1, and mark flow as DNS)
    if (pkt.tuple.dst_port == 53 || pkt.tuple.src_port == 53) {
      if (pkt.tuple.src_port == 53 && pkt.payload_length > 0) {
        parseDNS(pkt.data.data() + pkt.payload_offset, pkt.payload_length);
      }
      flow.app_type = AppType::DNS;
      flow.classified = true;
      return;
    }

    // 3. Use IP intelligence lookup
    AppType ip_app = IPIntelligence::classifyByIP(pkt.tuple.dst_ip);
    if (ip_app != AppType::UNKNOWN) {
      flow.app_type = ip_app;
      if (flow.sni.empty())
        flow.sni = appTypeToString(ip_app);
      flow.classified = true;
      return;
    }

    // 4. Port-based fallback
    if (pkt.tuple.dst_port == 443) {
      flow.app_type = AppType::HTTPS;
    } else if (pkt.tuple.dst_port == 80) {
      flow.app_type = AppType::HTTP;
    }
  }
};

// =============================================================================
// Load Balancer (one per LB thread)
// =============================================================================
class LoadBalancer {
public:
  LoadBalancer(int id, std::vector<FastPath *> fps)
      : id_(id), fps_(std::move(fps)), num_fps_(fps_.size()) {}

  void start() {
    running_ = true;
    thread_ = std::thread(&LoadBalancer::run, this);
  }

  void stop() {
    running_ = false;
    input_queue_.shutdown();
    if (thread_.joinable())
      thread_.join();
  }

  TSQueue<Packet> &queue() { return input_queue_; }

  uint64_t dispatched() const { return dispatched_; }

private:
  int id_;
  std::vector<FastPath *> fps_;
  size_t num_fps_;
  TSQueue<Packet> input_queue_;

  std::atomic<bool> running_{false};
  std::thread thread_;
  std::atomic<uint64_t> dispatched_{0};

  void run() {
    while (running_) {
      auto pkt_opt = input_queue_.pop(100);
      if (!pkt_opt)
        continue;

      // Hash to select FP
      FiveTupleHash hasher;
      size_t fp_idx = hasher(pkt_opt->tuple) % num_fps_;

      fps_[fp_idx]->queue().push(std::move(*pkt_opt));
      dispatched_++;
    }
  }
};

// =============================================================================
// DPI Engine
// =============================================================================
class DPIEngine {
public:
  struct Config {
    int num_lbs = 2;
    int fps_per_lb = 2;
  };

  DPIEngine(const Config &cfg) : config_(cfg) {
    int total_fps = cfg.num_lbs * cfg.fps_per_lb;

    std::cout << "\n";
    std::cout
        << "==============================================================\n";
    std::cout
        << "             FlowSentinel v1.0 (Multi-threaded DPI)          \n";
    std::cout
        << "==============================================================\n";
    std::cout << "Load Balancers: " << cfg.num_lbs
              << " | FPs per LB: " << cfg.fps_per_lb
              << " | Total FPs: " << total_fps << "\n";
    std::cout
        << "==============================================================\n\n";

    // Create FP threads
    for (int i = 0; i < total_fps; i++) {
      fps_.push_back(
          std::make_unique<FastPath>(i, &rules_, &stats_, &output_queue_));
    }

    // Create LB threads, each managing a subset of FPs
    for (int lb = 0; lb < cfg.num_lbs; lb++) {
      std::vector<FastPath *> lb_fps;
      int start = lb * cfg.fps_per_lb;
      for (int i = 0; i < cfg.fps_per_lb; i++) {
        lb_fps.push_back(fps_[start + i].get());
      }
      lbs_.push_back(std::make_unique<LoadBalancer>(lb, std::move(lb_fps)));
    }
  }

  void blockIP(const std::string &ip) { rules_.blockIP(ip); }
  void blockApp(const std::string &app) { rules_.blockApp(app); }
  void blockDomain(const std::string &dom) { rules_.blockDomain(dom); }

  bool process(const std::string &input_file, const std::string &output_file,
               const std::string &live_interface = "") {
    bool is_live = (input_file == "--live");
    PcapReader reader;
    LiveCapture live_reader;

    if (is_live) {
      if (!live_reader.start(live_interface))
        return false;
    } else {
      if (!reader.open(input_file))
        return false;
    }

    std::ofstream output;
    if (!output_file.empty()) {
      output.open(output_file, std::ios::binary);
      if (!output.is_open()) {
        std::cerr << "Cannot open output file\n";
        return false;
      }

      if (!is_live) {
        const auto &hdr = reader.getGlobalHeader();
        output.write(reinterpret_cast<const char *>(&hdr), sizeof(hdr));
      } else {
        PcapGlobalHeader hdr = {0xa1b2c3d4, 2, 4, 0, 0, 65535, 1};
        output.write(reinterpret_cast<const char *>(&hdr), sizeof(hdr));
      }
    }

    // Start all threads
    for (auto &fp : fps_)
      fp->start();
    for (auto &lb : lbs_)
      lb->start();

    std::atomic<bool> stats_running{true};
    std::thread stats_thread;

    if (is_live) {
      stats_thread = std::thread([&]() {
        uint64_t last_packets = 0;
        while (stats_running) {
          std::this_thread::sleep_for(std::chrono::seconds(1));
          if (!stats_running)
            break;

          uint64_t current_packets = stats_.total_packets.load();
          uint64_t pps = current_packets - last_packets;
          last_packets = current_packets;

          std::cout << "\033[2J\033[1;1H"; // Clear screen and home cursor
          std::cout << "## FlowSentinel Live Monitor\n\n";
          std::cout << "Packets/sec: " << pps << "\n";
          std::cout << "Total Packets: " << current_packets << "\n";
          std::cout << "Active Flows: " << stats_.active_flows.load() << "\n\n";
          std::cout << "Top Applications\n";

          std::lock_guard<std::mutex> lock(stats_.app_mutex);
          std::vector<std::pair<AppType, uint64_t>> sorted_apps(
              stats_.app_counts.begin(), stats_.app_counts.end());
          std::sort(
              sorted_apps.begin(), sorted_apps.end(),
              [](const auto &a, const auto &b) { return a.second > b.second; });

          int count = 0;
          for (const auto &[app, cnt] : sorted_apps) {
            if (count++ >= 4)
              break;
            double pct =
                current_packets > 0 ? (100.0 * cnt / current_packets) : 0;
            std::cout << std::setw(10) << std::left << appTypeToString(app)
                      << " " << std::setw(3) << std::right
                      << static_cast<int>(pct) << "%\n";
          }
          std::cout << std::flush;
        }
      });
    }

    // Start output writer thread
    std::atomic<bool> output_running{true};
    std::thread output_thread([&]() {
      while (output_running || output_queue_.size() > 0) {
        auto pkt_opt = output_queue_.pop(50);
        if (!pkt_opt)
          continue;

        if (output.is_open()) {
          PcapPacketHeader phdr;
          phdr.ts_sec = pkt_opt->ts_sec;
          phdr.ts_usec = pkt_opt->ts_usec;
          phdr.incl_len = pkt_opt->data.size();
          phdr.orig_len = pkt_opt->data.size();

          output.write(reinterpret_cast<const char *>(&phdr), sizeof(phdr));
          output.write(reinterpret_cast<const char *>(pkt_opt->data.data()),
                       pkt_opt->data.size());
        }
      }
    });

    // Read and dispatch packets
    std::cout
        << (is_live
                ? "[LiveCapture] Processing live packets (Ctrl+C to stop)...\n"
                : "[Reader] Processing packets...\n");
    RawPacket raw;
    ParsedPacket parsed;
    uint32_t pkt_id = 0;

    auto readNext = [&]() -> bool {
      return is_live ? live_reader.readNextPacket(raw)
                     : reader.readNextPacket(raw);
    };

    while (readNext()) {
      if (!PacketParser::parse(raw, parsed))
        continue;
      if (!parsed.has_ip || (!parsed.has_tcp && !parsed.has_udp))
        continue;

      // Create packet
      Packet pkt;
      pkt.id = pkt_id++;
      pkt.ts_sec = raw.header.ts_sec;
      pkt.ts_usec = raw.header.ts_usec;
      pkt.tcp_flags = parsed.tcp_flags;
      pkt.data = std::move(raw.data);

      // Parse 5-tuple
      auto parseIP = [](const std::string &ip) -> uint32_t {
        uint32_t result = 0;
        int octet = 0, shift = 0;
        for (char c : ip) {
          if (c == '.') {
            result |= (octet << shift);
            shift += 8;
            octet = 0;
          } else if (c >= '0' && c <= '9')
            octet = octet * 10 + (c - '0');
        }
        return result | (octet << shift);
      };

      pkt.tuple.src_ip = parseIP(parsed.src_ip);
      pkt.tuple.dst_ip = parseIP(parsed.dest_ip);
      pkt.tuple.src_port = parsed.src_port;
      pkt.tuple.dst_port = parsed.dest_port;
      pkt.tuple.protocol = parsed.protocol;

      // Calculate payload offset
      pkt.payload_offset = 14; // Ethernet
      if (pkt.data.size() > 14) {
        uint8_t ip_ihl = pkt.data[14] & 0x0F;
        pkt.payload_offset += ip_ihl * 4;

        if (parsed.has_tcp && pkt.payload_offset + 12 < pkt.data.size()) {
          uint8_t tcp_off = (pkt.data[pkt.payload_offset + 12] >> 4) & 0x0F;
          pkt.payload_offset += tcp_off * 4;
        } else if (parsed.has_udp) {
          pkt.payload_offset += 8;
        }

        if (pkt.payload_offset < pkt.data.size()) {
          pkt.payload_length = pkt.data.size() - pkt.payload_offset;
        } else {
          pkt.payload_length = 0;
        }
      }

      // Update stats
      stats_.total_packets++;
      stats_.total_bytes += pkt.data.size();
      if (parsed.has_tcp)
        stats_.tcp_packets++;
      else if (parsed.has_udp)
        stats_.udp_packets++;

      // Dispatch to LB (hash-based)
      FiveTupleHash hasher;
      size_t lb_idx = hasher(pkt.tuple) % lbs_.size();
      lbs_[lb_idx]->queue().push(std::move(pkt));
    }

    std::cout << (is_live ? "[LiveCapture] Stopped" : "[Reader] Done reading")
              << " " << pkt_id << " packets\n";
    if (is_live)
      live_reader.close();
    else
      reader.close();

    // Wait for queues to drain
    std::this_thread::sleep_for(std::chrono::milliseconds(500));

    // Stop all threads
    for (auto &lb : lbs_)
      lb->stop();
    for (auto &fp : fps_)
      fp->stop();

    output_running = false;
    output_queue_.shutdown();
    output_thread.join();

    if (output.is_open())
      output.close();

    if (is_live) {
      stats_running = false;
      if (stats_thread.joinable())
        stats_thread.join();
    } else {
      // Print report
      printReport();
    }

    return true;
  }

private:
  Config config_;
  Rules rules_;
  Stats stats_;
  TSQueue<Packet> output_queue_;
  std::vector<std::unique_ptr<FastPath>> fps_;
  std::vector<std::unique_ptr<LoadBalancer>> lbs_;

  void printReport() {
    std::cout << "\n";
    std::cout
        << "==============================================================\n";
    std::cout
        << "                     PROCESSING REPORT                        \n";
    std::cout
        << "==============================================================\n";

    std::cout << "Total Packets : " << stats_.total_packets.load() << "\n";
    std::cout << "Total Bytes   : " << stats_.total_bytes.load() << "\n";
    std::cout << "TCP Packets   : " << stats_.tcp_packets.load() << "\n";
    std::cout << "UDP Packets   : " << stats_.udp_packets.load() << "\n";

    std::cout
        << "--------------------------------------------------------------\n";
    std::cout << "Forwarded     : " << stats_.forwarded.load() << "\n";
    std::cout << "Dropped       : " << stats_.dropped.load() << "\n";

    std::cout
        << "--------------------------------------------------------------\n";
    std::cout << "THREAD STATISTICS\n";

    for (size_t i = 0; i < lbs_.size(); i++) {
      std::cout << "  LB" << i << " dispatched : " << lbs_[i]->dispatched()
                << "\n";
    }

    for (size_t i = 0; i < fps_.size(); i++) {
      std::cout << "  FP" << i << " processed  : " << fps_[i]->processed()
                << "\n";
    }

    std::cout
        << "--------------------------------------------------------------\n";
    std::cout << "APPLICATION BREAKDOWN\n";
    std::cout
        << "--------------------------------------------------------------\n";

    std::lock_guard<std::mutex> lock(stats_.app_mutex);

    std::vector<std::pair<AppType, uint64_t>> sorted_apps(
        stats_.app_counts.begin(), stats_.app_counts.end());

    std::sort(sorted_apps.begin(), sorted_apps.end(),
              [](const auto &a, const auto &b) { return a.second > b.second; });

    uint64_t total = stats_.total_packets.load();

    for (const auto &[app, count] : sorted_apps) {
      double pct = total > 0 ? (100.0 * count / total) : 0;
      int bar = static_cast<int>(pct / 5);
      std::string bar_str(bar, '#');

      std::cout << std::setw(15) << std::left << appTypeToString(app) << " "
                << std::setw(8) << std::right << count << " " << std::setw(6)
                << std::fixed << std::setprecision(1) << pct << "% " << bar_str
                << "\n";
    }

    std::cout
        << "==============================================================\n";

    if (!stats_.detected_snis.empty()) {
      std::cout << "\nDetected Domains/SNIs:\n";
      for (const auto &[sni, app] : stats_.detected_snis) {
        std::cout << "  - " << sni << " -> " << appTypeToString(app) << "\n";
      }
    }
  }
};

// =============================================================================
// Main
// =============================================================================
void printUsage(const char *prog) {
  std::cout
      << R"(
DPI Engine v2.0 - Multi-threaded Deep Packet Inspection
========================================================

Usage: )"
      << prog << R"( <input.pcap> <output.pcap> [options]
       )"
      << prog << R"( --live [interface_name] [options]
       )"
      << prog << R"( --interfaces

Options:
  --block-ip <ip>        Block source IP
  --block-app <app>      Block application (YouTube, Facebook, etc.)
  --block-domain <dom>   Block domain (substring match)
  --lbs <n>              Number of load balancer threads (default: 2)
  --fps <n>              FP threads per LB (default: 2)

Example:
  )" << prog
      << R"( capture.pcap filtered.pcap --block-app YouTube --block-ip 192.168.1.50
  )" << prog
      << R"( --live "Wi-Fi" --block-app Facebook
)";
}

int main(int argc, char *argv[]) {
  if (argc >= 2 && std::string(argv[1]) == "--interfaces") {
    auto interfaces = DPI::LiveCapture::listInterfaces();
    std::cout << "\n## Available Network Interfaces\n\n";
    for (size_t i = 0; i < interfaces.size(); ++i) {
      std::cout << (i + 1) << ". " << interfaces[i] << "\n\n";
    }
    return 0;
  }

  if (argc < 2) {
    printUsage(argv[0]);
    return 1;
  }

  std::string input = argv[1];
  std::string output = "";
  std::string live_interface = "";
  int arg_start = 2;

  if (input == "--live") {
    if (argc > 2 && argv[2][0] != '-') {
      live_interface = argv[2];
      arg_start = 3;
    }
  } else {
    if (argc < 3) {
      printUsage(argv[0]);
      return 1;
    }
    output = argv[2];
    arg_start = 3;
  }

  DPIEngine::Config cfg;
  std::vector<std::string> block_ips, block_apps, block_domains;

  for (int i = arg_start; i < argc; i++) {
    std::string arg = argv[i];
    if (arg == "--block-ip" && i + 1 < argc)
      block_ips.push_back(argv[++i]);
    else if (arg == "--block-app" && i + 1 < argc)
      block_apps.push_back(argv[++i]);
    else if (arg == "--block-domain" && i + 1 < argc)
      block_domains.push_back(argv[++i]);
    else if (arg == "--lbs" && i + 1 < argc)
      cfg.num_lbs = std::stoi(argv[++i]);
    else if (arg == "--fps" && i + 1 < argc)
      cfg.fps_per_lb = std::stoi(argv[++i]);
  }

  DPIEngine engine(cfg);

  for (const auto &ip : block_ips)
    engine.blockIP(ip);
  for (const auto &app : block_apps)
    engine.blockApp(app);
  for (const auto &dom : block_domains)
    engine.blockDomain(dom);

  if (!engine.process(input, output, live_interface)) {
    return 1;
  }

  if (!output.empty()) {
    std::cout << "\nOutput written to: " << output << "\n";
  }
  return 0;
}
