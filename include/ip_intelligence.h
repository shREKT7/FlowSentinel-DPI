#ifndef DPI_IP_INTELLIGENCE_H
#define DPI_IP_INTELLIGENCE_H

#include "types.h"
#include <cstdint>
#include <vector>


namespace DPI {

struct IPRange {
  uint32_t start;
  uint32_t end;
  AppType app;
};

class IPIntelligence {
public:
  static AppType classifyByIP(uint32_t ip);

private:
  static const std::vector<IPRange> known_ranges;
};

} // namespace DPI

#endif // DPI_IP_INTELLIGENCE_H
