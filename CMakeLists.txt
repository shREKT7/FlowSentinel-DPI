cmake_minimum_required(VERSION 3.16)

project(FlowSentinel VERSION 1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Include headers
include_directories(${CMAKE_SOURCE_DIR}/include)

# Source files for FlowSentinel DPI Engine
set(SOURCES
    src/dpi_mt.cpp
    src/pcap_reader.cpp
    src/packet_parser.cpp
    src/sni_extractor.cpp
    src/types.cpp
    src/rule_manager.cpp
    src/connection_tracker.cpp
    src/load_balancer.cpp
    src/fast_path.cpp
)

# Create executable
add_executable(flowsentinel ${SOURCES})

# Thread support (MinGW handles this automatically, but safe to keep)
if(WIN32)
    target_link_libraries(flowsentinel)
else()
    target_link_libraries(flowsentinel pthread)
endif()