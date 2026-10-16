# Native tests against a fake HIDAPI, on every platform; no device or MōBrowser needed.
# Run with `npm run test:native`. Built as Debug, since the tests use assert().
cmake_minimum_required(VERSION 3.21)
project(native_tests LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
enable_testing()

# The fake hidapi.h in this folder stands in for the real one.
include_directories(${CMAKE_CURRENT_SOURCE_DIR})

add_executable(via_test via_test.cc ../via_keyboard.cc)
add_executable(hidpp_test hidpp_test.cc ../hidpp_mouse.cc)
add_test(NAME via_test COMMAND via_test)
add_test(NAME hidpp_test COMMAND hidpp_test)
