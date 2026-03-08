#ifndef LIVE_CAPTURE_H
#define LIVE_CAPTURE_H

#include <string>
#include "pcap_reader.h"

#ifdef _WIN32
#include <winsock2.h>
#define HAVE_REMOTE
#endif
#include <pcap.h>

namespace DPI {

class LiveCapture {
public:
    LiveCapture();
    ~LiveCapture();

    // Open first available network interface for live capture
    bool start();
    
    // Close capture
    void close();
    
    // Read the next packet, blocks until a packet arrives
    bool readNextPacket(PacketAnalyzer::RawPacket& packet);

private:
    pcap_t* handle_ = nullptr;
    std::string errbuf_;
};

} // namespace DPI

#endif // LIVE_CAPTURE_H
