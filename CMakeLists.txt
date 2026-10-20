cmake_minimum_required(VERSION 3.21)

# Configures your project.
project(native LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(PROJECT_ROOT_DIR ${CMAKE_CURRENT_SOURCE_DIR})
cmake_path(ABSOLUTE_PATH PROJECT_ROOT_DIR NORMALIZE)

# Imports the MōBrowser app configuration and setups the auxiliary targets, resources, etc.
# Important: Do not move this include above the project declaration.
include(${PROJECT_ROOT_DIR}/node_modules/@mobrowser/native/cmake/MoBrowser.cmake)

# The source files of your app.
set(APP_SOURCES
        src/native/main.cc
        src/native/chroma_device.h
        src/native/chroma_device.cc
        src/native/hardware_service.h
        src/native/hardware_service.cc
        src/native/hidpp_mouse.h
        src/native/hidpp_mouse.cc
        src/native/via_keyboard.h
        src/native/via_keyboard.cc
        src/native/platform/platform.h
)

# Defines the main target of the application.
add_library(mobrowser_lib STATIC ${APP_SOURCES} ${GENERATED_SOURCES})

mobrowser_configure_app_lib(mobrowser_lib)

# Supported platforms. Each block compiles that platform's implementation of
# src/native/platform/platform.h and sets its HIDAPI backend; see "Supported platforms"
# in README.md. Keep platform-specific dependencies, sources, and definitions inside these
# blocks.
if (OS_MAC)
    target_sources(mobrowser_lib PRIVATE src/native/platform/mac.cc)
elseif (OS_WIN)
    target_sources(mobrowser_lib PRIVATE src/native/platform/windows.cc)
elseif (OS_LINUX)
    target_sources(mobrowser_lib PRIVATE src/native/platform/linux.cc)
    # The kernel hidraw backend only (needs libudev-dev), not libusb.
    set(HIDAPI_WITH_LIBUSB OFF)
else ()
    message(FATAL_ERROR "Unsupported platform: see \"Supported platforms\" in README.md.")
endif ()

# HIDAPI talks to keyboards and mice over HID on every platform.
include(FetchContent)
set(BUILD_SHARED_LIBS OFF)
FetchContent_Declare(hidapi
        URL https://github.com/libusb/hidapi/archive/refs/tags/hidapi-0.15.0.tar.gz
        URL_HASH SHA256=5d84dec684c27b97b921d2f3b73218cb773cf4ea915caee317ac8fc73cef8136
)
FetchContent_MakeAvailable(hidapi)
target_link_libraries(mobrowser_lib PRIVATE hidapi::hidapi)
