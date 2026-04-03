#include "flow_logger.h"
#include <iostream>
#include <sstream>
#include <fstream>

namespace DPI {

FlowLogger::FlowLogger(const std::string& output_path, int flush_interval_sec)
    : output_path_(output_path), flush_interval_sec_(flush_interval_sec) {}

FlowLogger::~FlowLogger() { stop(); }

void FlowLogger::start() {
    if (running_) return;
    running_ = true;
    flush_thread_ = std::thread(&FlowLogger::flushThreadFunc, this);
    std::cout << "[FlowLogger] Started. Writing to: " << output_path_ << "\n";
}

void FlowLogger::stop() {
    if (!running_) return;
    running_ = false;
    if (flush_thread_.joinable()) flush_thread_.join();
    flush();
    std::cout << "[FlowLogger] Stopped. Final flush complete.\n";
}

void FlowLogger::record(const FlowSnapshot& snap) {
    std::lock_guard<std::mutex> lock(mutex_);
    // Update existing entry with the same 5-tuple
    for (auto& e : buffer_) {
        if (e.src_ip == snap.src_ip && e.dst_ip == snap.dst_ip &&
            e.src_port == snap.src_port && e.dst_port == snap.dst_port &&
            e.protocol == snap.protocol) {
            if (e.domain.empty() && !snap.domain.empty()) {
                e.domain   = snap.domain;
                e.app_name = snap.app_name;
            }
            e.packets      = snap.packets;
            e.bytes        = snap.bytes;
            e.blocked      = snap.blocked;
            e.last_seen_ms = snap.last_seen_ms;
            return;
        }
    }
    // Cap at 10 000 flows; remove oldest first
    if (buffer_.size() >= 10000) buffer_.erase(buffer_.begin());
    buffer_.push_back(snap);
}

void FlowLogger::flush() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (buffer_.empty()) return;

    std::string json = toJSON();
    std::string tmp  = output_path_ + ".tmp";
    std::ofstream f(tmp, std::ios::trunc);
    if (!f.is_open()) {
        std::cerr << "[FlowLogger] Cannot open: " << tmp << "\n";
        return;
    }
    f << json;
    f.close();
    if (std::rename(tmp.c_str(), output_path_.c_str()) != 0)
        std::cerr << "[FlowLogger] Rename failed: " << tmp << " -> " << output_path_ << "\n";
}

void FlowLogger::flushThreadFunc() {
    while (running_) {
        std::this_thread::sleep_for(std::chrono::seconds(flush_interval_sec_));
        flush();
    }
}

size_t FlowLogger::count() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return buffer_.size();
}

std::string FlowLogger::toJSON() const {
    std::ostringstream ss;
    ss << "[\n";
    for (size_t i = 0; i < buffer_.size(); i++) {
        const auto& f = buffer_[i];
        ss << "  {\n";
        ss << "    \"src_ip\": \""    << escapeJSON(f.src_ip)   << "\",\n";
        ss << "    \"dst_ip\": \""    << escapeJSON(f.dst_ip)   << "\",\n";
        ss << "    \"src_port\": "    << f.src_port              << ",\n";
        ss << "    \"dst_port\": "    << f.dst_port              << ",\n";
        ss << "    \"protocol\": "    << (int)f.protocol         << ",\n";
        ss << "    \"domain\": \""    << escapeJSON(f.domain)    << "\",\n";
        ss << "    \"app\": \""       << escapeJSON(f.app_name)  << "\",\n";
        ss << "    \"packets\": "     << f.packets               << ",\n";
        ss << "    \"bytes\": "       << f.bytes                 << ",\n";
        ss << "    \"blocked\": "     << (f.blocked ? "true" : "false") << ",\n";
        ss << "    \"is_quic\": "     << (f.is_quic ? "true" : "false") << ",\n";
        ss << "    \"first_seen\": "  << f.first_seen_ms         << ",\n";
        ss << "    \"last_seen\": "   << f.last_seen_ms          << "\n";
        ss << "  }";
        if (i + 1 < buffer_.size()) ss << ",";
        ss << "\n";
    }
    ss << "]\n";
    return ss.str();
}

std::string FlowLogger::escapeJSON(const std::string& s) {
    std::string r;
    r.reserve(s.size());
    for (char c : s) {
        switch (c) {
            case '"':  r += "\\\""; break;
            case '\\': r += "\\\\"; break;
            case '\n': r += "\\n";  break;
            case '\r': r += "\\r";  break;
            case '\t': r += "\\t";  break;
            default:   r += c;      break;
        }
    }
    return r;
}

} // namespace DPI
