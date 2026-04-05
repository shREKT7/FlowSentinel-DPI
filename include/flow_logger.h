#ifndef FLOW_LOGGER_H
#define FLOW_LOGGER_H

#include "types.h"
#include <string>
#include <fstream>
#include <mutex>
#include <vector>
#include <chrono>
#include <thread>
#include <atomic>

namespace DPI {

// Snapshot of one flow taken while processing packets
struct FlowSnapshot {
    std::string src_ip;
    std::string dst_ip;
    uint16_t    src_port;
    uint16_t    dst_port;
    uint8_t     protocol;
    std::string domain;        // SNI / HTTP host / DNS-cache lookup
    std::string app_name;      // appTypeToString(app_type)
    uint64_t    packets;
    uint64_t    bytes;
    bool        blocked;
    bool        is_quic;       // true if UDP + dst_port 443
    int64_t     first_seen_ms; // ms since epoch
    int64_t     last_seen_ms;
};

// Thread-safe JSON flow logger.
// Writes flows.json atomically every flush_interval_sec seconds.
// The web dashboard backend reads this file.
class FlowLogger {
public:
    explicit FlowLogger(const std::string& output_path = "flows.json",
                        int flush_interval_sec = 3);
    ~FlowLogger();

    void record(const FlowSnapshot& snap);  // called from FP threads
    void flush();                           // force flush to disk
    void start();                           // begin background flush thread
    void stop();                            // stop thread + final flush
    size_t count() const;

private:
    std::string output_path_;
    int flush_interval_sec_;

    mutable std::mutex mutex_;
    std::vector<FlowSnapshot> buffer_;

    std::atomic<bool> running_{false};
    std::thread flush_thread_;

    void flushThreadFunc();
    std::string toJSON() const;   // called with mutex_ held
    static std::string escapeJSON(const std::string& s);
};

} // namespace DPI

#endif // FLOW_LOGGER_H
