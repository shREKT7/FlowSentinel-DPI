#include "ip_intelligence.h"

namespace DPI {

#define IP_TO_UINT32(a, b, c, d)                                               \
  (((uint32_t)(a) << 24) | ((uint32_t)(b) << 16) | ((uint32_t)(c) << 8) |      \
   (uint32_t)(d))

const std::vector<IPRange> IPIntelligence::known_ranges = {
    // Google: 142.250.0.0/15
    {IP_TO_UINT32(142, 250, 0, 0), IP_TO_UINT32(142, 251, 255, 255),
     AppType::GOOGLE},

    // YouTube: 172.217.0.0/16
    {IP_TO_UINT32(172, 217, 0, 0), IP_TO_UINT32(172, 217, 255, 255),
     AppType::YOUTUBE},

    // Cloudflare: 104.16.0.0/12
    {IP_TO_UINT32(104, 16, 0, 0), IP_TO_UINT32(104, 31, 255, 255),
     AppType::CLOUDFLARE},

    // Discord: 162.159.128.0/18
    {IP_TO_UINT32(162, 159, 128, 0), IP_TO_UINT32(162, 159, 191, 255),
     AppType::DISCORD},

    // OpenAI (fictional/approx for the sake of intelligence demo):
    // 104.18.0.0/15 (overlaps with Cloudflare but ordered appropriately, or
    // just put another range)
    {IP_TO_UINT32(23, 94, 0, 0), IP_TO_UINT32(23, 95, 255, 255),
     AppType::OPENAI}, // Just sample IP range not actual

    // Netflix: 45.57.0.0/17
    {IP_TO_UINT32(45, 57, 0, 0), IP_TO_UINT32(45, 57, 127, 255),
     AppType::NETFLIX}};

AppType IPIntelligence::classifyByIP(uint32_t ip) {
  for (const auto &range : known_ranges) {
    if (ip >= range.start && ip <= range.end) {
      return range.app;
    }
  }
  return AppType::UNKNOWN;
}

} // namespace DPI
