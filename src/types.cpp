#include "types.h"
#include <algorithm>
#include <cctype>
#include <iomanip>
#include <sstream>


namespace DPI {

std::string FiveTuple::toString() const {
  std::ostringstream ss;

  auto formatIP = [](uint32_t ip) {
    std::ostringstream s;
    s << ((ip >> 0) & 0xFF) << "." << ((ip >> 8) & 0xFF) << "."
      << ((ip >> 16) & 0xFF) << "." << ((ip >> 24) & 0xFF);
    return s.str();
  };

  ss << formatIP(src_ip) << ":" << src_port << " -> " << formatIP(dst_ip) << ":"
     << dst_port << " ("
     << (protocol == 6    ? "TCP"
         : protocol == 17 ? "UDP"
                          : "?")
     << ")";

  return ss.str();
}

std::string appTypeToString(AppType type) {
  switch (type) {
  case AppType::UNKNOWN:   return "Unknown";
  case AppType::HTTP:      return "HTTP";
  case AppType::HTTPS:     return "HTTPS";
  case AppType::DNS:       return "DNS";
  case AppType::TLS:       return "TLS";
  case AppType::QUIC:      return "QUIC";
  case AppType::GOOGLE:    return "Google";
  case AppType::FACEBOOK:  return "Facebook";
  case AppType::YOUTUBE:   return "YouTube";
  case AppType::TWITTER:   return "Twitter/X";
  case AppType::INSTAGRAM: return "Instagram";
  case AppType::NETFLIX:   return "Netflix";
  case AppType::AMAZON:    return "Amazon";
  case AppType::MICROSOFT: return "Microsoft";
  case AppType::APPLE:     return "Apple";
  case AppType::WHATSAPP:  return "WhatsApp";
  case AppType::TELEGRAM:  return "Telegram";
  case AppType::TIKTOK:    return "TikTok";
  case AppType::SPOTIFY:   return "Spotify";
  case AppType::ZOOM:      return "Zoom";
  case AppType::DISCORD:   return "Discord";
  case AppType::GITHUB:    return "GitHub";
  case AppType::CLOUDFLARE:return "Cloudflare";
  case AppType::OPENAI:    return "OpenAI";
  case AppType::HOTSTAR:   return "Hotstar";
  case AppType::REDDIT:    return "Reddit";
  case AppType::TWITCH:    return "Twitch";
  case AppType::LINKEDIN:  return "LinkedIn";
  case AppType::SNAPCHAT:  return "Snapchat";
  case AppType::PINTEREST: return "Pinterest";
  case AppType::DROPBOX:   return "Dropbox";
  case AppType::SLACK:     return "Slack";
  default:                 return "Unknown";
  }
}

// Map SNI/domain to application type
AppType sniToAppType(const std::string &sni) {
  if (sni.empty())
    return AppType::UNKNOWN;

  std::string s = sni;
  std::transform(s.begin(), s.end(), s.begin(),
                 [](unsigned char c) { return std::tolower(c); });

  // YouTube — must check BEFORE Google (googlevideo is YouTube CDN)
  if (s.find("youtube") != std::string::npos ||
      s.find("googlevideo") != std::string::npos ||
      s.find("ytimg") != std::string::npos ||
      s.find("yt3.ggpht") != std::string::npos ||
      s.find("youtu.be") != std::string::npos)
    return AppType::YOUTUBE;

  // Google
  if (s.find("google") != std::string::npos ||
      s.find("gstatic") != std::string::npos ||
      s.find("gvt1") != std::string::npos ||
      s.find("googleapis") != std::string::npos ||
      s.find("googleusercontent") != std::string::npos ||
      s.find("ggpht") != std::string::npos ||
      s.find("2mdn.net") != std::string::npos ||
      s.find("doubleclick") != std::string::npos)
    return AppType::GOOGLE;

  // Facebook / Meta
  if (s.find("facebook") != std::string::npos ||
      s.find("fbcdn") != std::string::npos ||
      s.find("fb.com") != std::string::npos ||
      s.find("fbsbx") != std::string::npos)
    return AppType::FACEBOOK;

  // Instagram
  if (s.find("instagram") != std::string::npos ||
      s.find("cdninstagram") != std::string::npos)
    return AppType::INSTAGRAM;

  // WhatsApp
  if (s.find("whatsapp") != std::string::npos)
    return AppType::WHATSAPP;

  // Twitter / X
  if (s.find("twitter") != std::string::npos ||
      s.find("twimg") != std::string::npos ||
      s.find("x.com") != std::string::npos ||
      s.find("t.co") != std::string::npos)
    return AppType::TWITTER;

  // Netflix
  if (s.find("netflix") != std::string::npos ||
      s.find("nflxvideo") != std::string::npos ||
      s.find("nflximg") != std::string::npos)
    return AppType::NETFLIX;

  // Amazon
  if (s.find("amazon") != std::string::npos ||
      s.find("amazonaws") != std::string::npos ||
      s.find("cloudfront") != std::string::npos ||
      s.find("amazonvideo") != std::string::npos ||
      s.find("primevideo") != std::string::npos)
    return AppType::AMAZON;

  // Microsoft
  if (s.find("microsoft") != std::string::npos ||
      s.find("msn.com") != std::string::npos ||
      s.find("live.com") != std::string::npos ||
      s.find("outlook.com") != std::string::npos ||
      s.find("office.com") != std::string::npos ||
      s.find("office365") != std::string::npos ||
      s.find("windows.net") != std::string::npos ||
      s.find("azure") != std::string::npos ||
      s.find("bing.com") != std::string::npos)
    return AppType::MICROSOFT;

  // Apple
  if (s.find("apple.com") != std::string::npos ||
      s.find("icloud.com") != std::string::npos ||
      s.find("mzstatic") != std::string::npos ||
      s.find("aaplimg") != std::string::npos ||
      s.find("cdn-apple") != std::string::npos)
    return AppType::APPLE;

  // Telegram
  if (s.find("telegram") != std::string::npos ||
      s.find("t.me") != std::string::npos)
    return AppType::TELEGRAM;

  // TikTok
  if (s.find("tiktok") != std::string::npos ||
      s.find("ttwstatic") != std::string::npos ||
      s.find("bytedance") != std::string::npos ||
      s.find("muscdn") != std::string::npos)
    return AppType::TIKTOK;

  // Spotify
  if (s.find("spotify") != std::string::npos ||
      s.find("scdn.co") != std::string::npos)
    return AppType::SPOTIFY;

  // Zoom
  if (s.find("zoom") != std::string::npos ||
      s.find("zoomgov") != std::string::npos)
    return AppType::ZOOM;

  // Discord
  if (s.find("discord") != std::string::npos ||
      s.find("discordapp") != std::string::npos)
    return AppType::DISCORD;

  // GitHub
  if (s.find("github") != std::string::npos ||
      s.find("githubusercontent") != std::string::npos ||
      s.find("githubassets") != std::string::npos)
    return AppType::GITHUB;

  // Cloudflare
  if (s.find("cloudflare") != std::string::npos ||
      s.find("1.1.1.1") != std::string::npos)
    return AppType::CLOUDFLARE;

  // OpenAI / ChatGPT — extended CDN patterns
  if (s.find("openai") != std::string::npos ||
      s.find("chatgpt") != std::string::npos ||
      s.find("oaistatic") != std::string::npos ||
      s.find("oaiusercontent") != std::string::npos ||
      s.find("openaiapi") != std::string::npos ||
      s.find("sora.com") != std::string::npos)
    return AppType::OPENAI;

  // Hotstar / Disney+
  if (s.find("hotstar") != std::string::npos ||
      s.find("disney") != std::string::npos ||
      s.find("dssott") != std::string::npos ||
      s.find("bamgrid") != std::string::npos ||
      s.find("starott") != std::string::npos ||
      s.find("mxplay") != std::string::npos)
    return AppType::HOTSTAR;

  // Reddit
  if (s.find("reddit") != std::string::npos ||
      s.find("redd.it") != std::string::npos ||
      s.find("redditmedia") != std::string::npos ||
      s.find("redditstatic") != std::string::npos ||
      s.find("reddituploads") != std::string::npos)
    return AppType::REDDIT;

  // Twitch
  if (s.find("twitch") != std::string::npos ||
      s.find("twitchsvc") != std::string::npos ||
      s.find("jtvnw") != std::string::npos ||
      s.find("twitchapps") != std::string::npos ||
      s.find("ext-twitch") != std::string::npos)
    return AppType::TWITCH;

  // LinkedIn
  if (s.find("linkedin") != std::string::npos ||
      s.find("licdn") != std::string::npos ||
      s.find("linkedin-ei") != std::string::npos)
    return AppType::LINKEDIN;

  // Snapchat
  if (s.find("snapchat") != std::string::npos ||
      s.find("snap.com") != std::string::npos ||
      s.find("snapkit") != std::string::npos)
    return AppType::SNAPCHAT;

  // Pinterest
  if (s.find("pinterest") != std::string::npos ||
      s.find("pinimg") != std::string::npos)
    return AppType::PINTEREST;

  // Dropbox
  if (s.find("dropbox") != std::string::npos ||
      s.find("dropboxstatic") != std::string::npos ||
      s.find("dropboxusercontent") != std::string::npos)
    return AppType::DROPBOX;

  // Slack
  if (s.find("slack") != std::string::npos ||
      s.find("slack-edge") != std::string::npos ||
      s.find("slack-msgs") != std::string::npos ||
      s.find("slack-files") != std::string::npos ||
      s.find("slackb") != std::string::npos)
    return AppType::SLACK;

  // Cloudflare CDN catch-all
  if (s.find("cloudflare") != std::string::npos ||
      s.find("cloudflareinsights") != std::string::npos ||
      s.find("cfdata.org") != std::string::npos)
    return AppType::CLOUDFLARE;

  // SNI present but unrecognised — still TLS confirmed
  return AppType::HTTPS;
}

} // namespace DPI
