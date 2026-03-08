#include "live_capture.h"
#include <iostream>

namespace DPI {

LiveCapture::LiveCapture() {
    errbuf_.resize(PCAP_ERRBUF_SIZE);
}

LiveCapture::~LiveCapture() {
    close();
}

bool LiveCapture::start() {
    pcap_if_t *alldevs;
    pcap_if_t *d;

    // Retrieve the device list
    if (pcap_findalldevs(&alldevs, errbuf_.data()) == -1) {
        std::cerr << "Error in pcap_findalldevs: " << errbuf_ << "\n";
        return false;
    }

    if (alldevs == nullptr) {
        std::cerr << "No interfaces found! Make sure Npcap/libpcap is installed.\n";
        return false;
    }

    // Use the first device
    d = alldevs;
    std::cout << "[LiveCapture] Opening device: ";
    if (d->description)
        std::cout << d->description << "\n";
    else
        std::cout << d->name << "\n";

    // Open the device
    // 65535: snaplen, 1: promiscuous mode, 1000: read timeout (ms)
    handle_ = pcap_open_live(d->name, 65535, 1, 1000, errbuf_.data());
    
    if (handle_ == nullptr) {
        std::cerr << "Unable to open the adapter. " << d->name << " is not supported by Npcap/libpcap\n";
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

bool LiveCapture::readNextPacket(PacketAnalyzer::RawPacket& packet) {
    if (!handle_) return false;

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
