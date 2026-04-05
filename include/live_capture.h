#ifndef LIVE_CAPTURE_H
#define LIVE_CAPTURE_H

#include "pcap_reader.h"
#include <string>


#ifdef _WIN32
#include <winsock2.h>
#define HAVE_REMOTE
#endif
#include <pcap.h>

#include <vector>

namespace DPI {

class LiveCapture {
public:
  LiveCapture();
  ~LiveCapture();

  // List available network interfaces
  static std::vector<std::string> listInterfaces();

  // Open network interface for live capture. Uses first available if
  // interface_name is empty.
  bool start(const std::string &interface_name = "");

  // Close capture
  void close();

  // Read the next packet, blocks until a packet arrives
  bool readNextPacket(PacketAnalyzer::RawPacket &packet);

private:
  pcap_t *handle_ = nullptr;
  std::string errbuf_;
};

} // namespace DPI

#endif // LIVE_CAPTURE_H
