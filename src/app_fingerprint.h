#pragma once
// =============================================================================
// Application Fingerprinting Engine — IP-range based detection
// =============================================================================
// Maps destination IPv4 addresses to well-known application names using static
// CIDR-style ranges. This is the third classification layer, applied only when
// DNS correlation and TLS SNI extraction both fail to identify the application.
// The returned string is compatible with sniToAppType() for AppType conversion.
// =============================================================================
#include <cstdint>
#include <string>

// Detect application name from a destination IPv4 address (little-endian).
// Returns the application name (e.g. "YouTube"), or "HTTPS" if no match.
std::string detectAppFromIP(uint32_t ip);
