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
        src/native/via_service.h
        src/native/via_service.cc
        src/native/via_keyboard.h
        src/native/via_keyboard.cc
)

# Defines the main target of the application.
add_library(mobrowser_lib STATIC ${APP_SOURCES} ${GENERATED_SOURCES})

mobrowser_configure_app_lib(mobrowser_lib)

# Add shared third party dependencies and configuration for all platforms here.
# HIDAPI talks to VIA keyboards over USB HID (see src/native/via_keyboard.cc).
include(FetchContent)
set(BUILD_SHARED_LIBS OFF)
# On Linux, use the kernel hidraw backend only (needs libudev-dev), not libusb.
set(HIDAPI_WITH_LIBUSB OFF)
FetchContent_Declare(hidapi
        URL https://github.com/libusb/hidapi/archive/refs/tags/hidapi-0.15.0.tar.gz
        URL_HASH SHA256=5d84dec684c27b97b921d2f3b73218cb773cf4ea915caee317ac8fc73cef8136
)
FetchContent_MakeAvailable(hidapi)
target_link_libraries(mobrowser_lib PRIVATE hidapi::hidapi)

# Keep platform-specific dependencies inside the matching block below.
# Platform-only find_package calls, include directories, source files, compile definitions,
# and libraries should not be added outside these blocks.
if (OS_WIN)
    # Add Windows-only dependencies, source files, definitions, and libraries here.
    # find_package(example_windows CONFIG REQUIRED)
    # target_sources(mobrowser_lib PRIVATE src/native/windows/example_windows.cc)
    # target_include_directories(mobrowser_lib PRIVATE ${example_windows_INCLUDE_DIRS})
    # target_compile_definitions(mobrowser_lib PRIVATE USE_EXAMPLE_WINDOWS)
    # target_link_libraries(mobrowser_lib PRIVATE example_windows::example_windows)
elseif (OS_MAC)
    # Add macOS-only dependencies, source files, definitions, frameworks, and libraries here.
    # find_package(example_macos CONFIG REQUIRED)
    # target_sources(mobrowser_lib PRIVATE src/native/mac/example_macos.mm)
    # target_include_directories(mobrowser_lib PRIVATE ${example_macos_INCLUDE_DIRS})
    # target_compile_definitions(mobrowser_lib PRIVATE USE_EXAMPLE_MACOS)
    # target_link_libraries(mobrowser_lib PRIVATE example_macos::example_macos "-framework Foundation")
elseif (OS_LINUX)
    # Add Linux-only dependencies, source files, definitions, and libraries here.
    # find_package(example_linux CONFIG REQUIRED)
    # target_sources(mobrowser_lib PRIVATE src/native/linux/example_linux.cc)
    # target_include_directories(mobrowser_lib PRIVATE ${example_linux_INCLUDE_DIRS})
    # target_compile_definitions(mobrowser_lib PRIVATE USE_EXAMPLE_LINUX)
    # target_link_libraries(mobrowser_lib PRIVATE example_linux::example_linux)
endif ()
