#include "live_capture.h"
#include <iostream>

namespace DPI {

LiveCapture::LiveCapture() { errbuf_.resize(PCAP_ERRBUF_SIZE); }

LiveCapture::~LiveCapture() { close(); }

std::vector<std::string> LiveCapture::listInterfaces() {
  std::vector<std::string> interfaces;
  pcap_if_t *alldevs;
  char errbuf[PCAP_ERRBUF_SIZE];

  if (pcap_findalldevs(&alldevs, errbuf) == -1) {
    std::cerr << "Error in pcap_findalldevs: " << errbuf << "\n";
    return interfaces;
  }

  for (pcap_if_t *d = alldevs; d != nullptr; d = d->next) {
    std::string name = d->name ? d->name : "Unknown";
    std::string desc = d->description ? d->description : name;
    if (d->description) {
      interfaces.push_back(desc);
    } else {
      interfaces.push_back(name);
    }
  }

  pcap_freealldevs(alldevs);
  return interfaces;
}

bool LiveCapture::start(const std::string &interface_name) {
  pcap_if_t *alldevs;
  pcap_if_t *d;
  pcap_if_t *selected_dev = nullptr;

  // Retrieve the device list
  if (pcap_findalldevs(&alldevs, errbuf_.data()) == -1) {
    std::cerr << "Error in pcap_findalldevs: " << errbuf_ << "\n";
    return false;
  }

  if (alldevs == nullptr) {
    std::cerr << "No interfaces found! Make sure Npcap/libpcap is installed.\n";
    return false;
  }

  if (interface_name.empty()) {
    selected_dev = alldevs;
  } else {
    for (d = alldevs; d != nullptr; d = d->next) {
      std::string name = d->name ? d->name : "";
      std::string desc = d->description ? d->description : "";
      if (name == interface_name || desc == interface_name ||
          desc.find(interface_name) != std::string::npos) {
        selected_dev = d;
        break;
      }
    }
  }

  if (selected_dev == nullptr) {
    std::cerr << "Interface '" << interface_name << "' not found.\n";
    pcap_freealldevs(alldevs);
    return false;
  }

  std::cout << "[LiveCapture] Opening device: ";
  if (selected_dev->description)
    std::cout << selected_dev->description << "\n";
  else
    std::cout << selected_dev->name << "\n";

  // Open the device
  // 65535: snaplen, 1: promiscuous mode, 1000: read timeout (ms)
  handle_ = pcap_open_live(selected_dev->name, 65535, 1, 1000, errbuf_.data());

  if (handle_ == nullptr) {
    std::cerr << "Unable to open the adapter. " << selected_dev->name
              << " is not supported by Npcap/libpcap\n";
    pcap_freealldevs(alldevs);
    return false;
  }

  pcap_freealldevs(alldevs);
  return true;
}

void LiveCapture::close() {
  if (handle_) {
    pcap_close(handle_);
    handle_ = nullptr;
  }
}

bool LiveCapture::readNextPacket(PacketAnalyzer::RawPacket &packet) {
  if (!handle_)
    return false;

  struct pcap_pkthdr *header;
  const u_char *pkt_data;
  int res;

  // Read the next packet
  while ((res = pcap_next_ex(handle_, &header, &pkt_data)) >= 0) {
    if (res == 0) {
      // Timeout elapsed, keep trying in live mode
      continue;
    }

    // We got a packet
    packet.header.ts_sec = header->ts.tv_sec;
    packet.header.ts_usec = header->ts.tv_usec;
    packet.header.incl_len = header->caplen;
    packet.header.orig_len = header->len;

    packet.data.assign(pkt_data, pkt_data + header->caplen);
    return true;
  }

  if (res == -1) {
    std::cerr << "Error reading the packets: " << pcap_geterr(handle_) << "\n";
    return false;
  }

  return false; // EOF or other error
}

} // namespace DPI
