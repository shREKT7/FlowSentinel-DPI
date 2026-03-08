#include "app_fingerprint.h"

// =============================================================================
// IP-to-app fingerprint table
// =============================================================================
// IPs in dpi_mt.cpp are stored little-endian (first octet in the lowest byte),
// so we encode ranges using the same convention:
//   IP4(a, b, c, d) → a | (b<<8) | (c<<16) | (d<<24)
// =============================================================================

#define IP4(a, b, c, d)                                                        \
  ((uint32_t)(a) | ((uint32_t)(b) << 8) | ((uint32_t)(c) << 16) |              \
   ((uint32_t)(d) << 24))

struct IPRange {
  uint32_t start;
  uint32_t end;
  const char *app;
};

// Keep ranges ordered from most-specific to least-specific within each vendor.
static const IPRange kRanges[] = {
    // ---- YouTube / Google ----
    {IP4(142, 250, 0, 0), IP4(142, 250, 255, 255), "YouTube"},
    {IP4(172, 217, 0, 0), IP4(172, 217, 255, 255), "YouTube"},
    {IP4(142, 251, 0, 0), IP4(142, 251, 255, 255), "Google"},
    {IP4(74, 125, 0, 0), IP4(74, 125, 255, 255), "Google"},
    {IP4(216, 58, 0, 0), IP4(216, 58, 255, 255), "Google"},
    {IP4(34, 64, 0, 0), IP4(34, 95, 255, 255), "Google"},

    // ---- Cloudflare (includes Discord CDN) ----
    {IP4(104, 16, 0, 0), IP4(104, 31, 255, 255), "Cloudflare"},
    {IP4(162, 159, 0, 0), IP4(162, 159, 255, 255), "Cloudflare"},
    {IP4(141, 101, 64, 0), IP4(141, 101, 65, 255), "Cloudflare"},
    {IP4(198, 41, 128, 0), IP4(198, 41, 191, 255), "Cloudflare"},

    // ---- Discord (voice / media servers) ----
    {IP4(66, 22, 192, 0), IP4(66, 22, 207, 255), "Discord"},

    // ---- GitHub ----
    {IP4(140, 82, 112, 0), IP4(140, 82, 127, 255), "GitHub"},
    {IP4(192, 30, 252, 0), IP4(192, 30, 255, 255), "GitHub"},
    {IP4(185, 199, 108, 0), IP4(185, 199, 111, 255), "GitHub"},

    // ---- Netflix ----
    {IP4(52, 89, 124, 0), IP4(52, 89, 127, 255), "Netflix"},
    {IP4(54, 148, 0, 0), IP4(54, 148, 255, 255), "Netflix"},
    {IP4(198, 38, 112, 0), IP4(198, 38, 127, 255), "Netflix"},
    {IP4(45, 57, 0, 0), IP4(45, 57, 127, 255), "Netflix"},

    // ---- Amazon AWS (broad) ----
    {IP4(52, 94, 0, 0), IP4(52, 95, 255, 255), "Amazon"},
    {IP4(54, 240, 0, 0), IP4(54, 241, 255, 255), "Amazon"},
    {IP4(205, 251, 0, 0), IP4(205, 251, 255, 255), "Amazon"},
    {IP4(99, 77, 0, 0), IP4(99, 95, 255, 255), "Amazon"},

    // ---- Microsoft / Azure ----
    {IP4(20, 0, 0, 0), IP4(20, 255, 255, 255), "Microsoft"},
    {IP4(13, 0, 0, 0), IP4(13, 255, 255, 255), "Microsoft"},
    {IP4(40, 64, 0, 0), IP4(40, 127, 255, 255), "Microsoft"},

    // ---- Spotify ----
    {IP4(35, 186, 224, 0), IP4(35, 186, 255, 255), "Spotify"},
    {IP4(185, 18, 208, 0), IP4(185, 18, 215, 255), "Spotify"},

    // ---- OpenAI ----
    {IP4(104, 18, 12, 0), IP4(104, 18, 15, 255), "OpenAI"},
    {IP4(23, 227, 148, 0), IP4(23, 227, 150, 255), "OpenAI"},

    // ---- Facebook / Meta (Instagram shares this range) ----
    {IP4(157, 240, 0, 0), IP4(157, 240, 255, 255), "Facebook"},
    {IP4(31, 13, 64, 0), IP4(31, 13, 127, 255), "Facebook"},
    {IP4(179, 60, 96, 0), IP4(179, 60, 99, 255), "Facebook"},
    {IP4(129, 134, 128, 0), IP4(129, 134, 255, 255), "Instagram"},

    // ---- Apple (iCloud, CDN) ----
    {IP4(17, 0, 0, 0), IP4(17, 255, 255, 255), "Apple"},
    {IP4(63, 132, 128, 0), IP4(63, 132, 201, 255), "Apple"},
    {IP4(144, 178, 0, 0), IP4(144, 178, 255, 255), "Apple"},

    // ---- Telegram ----
    {IP4(149, 154, 160, 0), IP4(149, 154, 175, 255), "Telegram"},
    {IP4(91, 108, 4, 0), IP4(91, 108, 63, 255), "Telegram"},
};

static const size_t kRangeCount = sizeof(kRanges) / sizeof(kRanges[0]);

std::string detectAppFromIP(uint32_t ip) {
  for (size_t i = 0; i < kRangeCount; ++i) {
    if (ip >= kRanges[i].start && ip <= kRanges[i].end) {
      return kRanges[i].app;
    }
  }
  return "HTTPS"; // fallback — port-based assumption
}
