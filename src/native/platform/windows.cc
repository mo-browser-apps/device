// Windows: HIDAPI's WinAPI backend, and the Razer Chroma SDK.
#include <windows.h>

#include <hidapi.h>

#include "platform.h"

namespace {

// The part of the Chroma SDK's C++ interface this app uses, after RzChromaSDKTypes.h
// in Razer's SDK. The runtime is a plain DLL, so no SDK files are needed to build.
namespace chroma {

using Result = LONG;
constexpr Result kSuccess = 0;

// Describes the app to Razer Synapse, which lists it under Chroma Apps.
struct AppInfo {
  wchar_t title[256];
  wchar_t description[1024];
  struct {
    wchar_t name[256];
    wchar_t contact[256];
  } author;
  // A bit per device kind the app lights: 1 keyboards, 2 mice.
  DWORD supported_devices;
  // 1 is a utility, 2 a game.
  DWORD category;
};

// Keyboard::EFFECT_TYPE and Mouse::EFFECT_TYPE number their effects differently.
constexpr int kKeyboardStatic = 4;
constexpr int kMouseStatic = 6;
constexpr int kAllMouseLeds = 0xFFFF;

struct KeyboardStaticEffect {
  COLORREF color;
};
struct MouseStaticEffect {
  int led;
  COLORREF color;
};

// The SDK applies an effect at once when no effect ID is asked for.
using Init = Result (*)();
using InitSdk = Result (*)(AppInfo* app_info);
using CreateKeyboardEffect = Result (*)(int effect, void* param, GUID* effect_id);
using CreateMouseEffect = Result (*)(int effect, void* param, GUID* effect_id);

}  // namespace chroma

// The runtime's 64-bit DLL, which Synapse installs into the system directory.
constexpr wchar_t kChromaLibrary[] = L"RzChromaSDK64.dll";

struct ChromaSdk {
  HMODULE library = nullptr;
  chroma::CreateKeyboardEffect create_keyboard_effect = nullptr;
  chroma::CreateMouseEffect create_mouse_effect = nullptr;
  bool ready = false;
};

ChromaSdk& Sdk() {
  static ChromaSdk sdk;
  return sdk;
}

template <typename Function>
Function Resolve(HMODULE library, const char* name) {
  return reinterpret_cast<Function>(GetProcAddress(library, name));
}

}  // namespace

bool InitHid() {
  return hid_init() == 0;
}

// Windows opens each top-level collection under its own path, such as
// "\?\hid#vid_046d&pid_c548&mi_02&col02#..." for long reports and "...&col01#..." for
// short ones. HIDAPI lowercases the path.
std::string HidppShortReportPath(const std::string& long_report_path) {
  std::string path = long_report_path;
  const size_t collection = path.find("&col02");
  if (collection == std::string::npos) return {};
  path.replace(collection, 6, "&col01");
  return path;
}

bool InitChromaSdk() {
  ChromaSdk& sdk = Sdk();
  if (sdk.ready) return true;
  if (!sdk.library) {
    // Only the system directory, so a DLL dropped next to the app is never loaded.
    sdk.library = LoadLibraryExW(kChromaLibrary, nullptr, LOAD_LIBRARY_SEARCH_SYSTEM32);
    if (!sdk.library) return false;
    sdk.create_keyboard_effect =
        Resolve<chroma::CreateKeyboardEffect>(sdk.library, "CreateKeyboardEffect");
    sdk.create_mouse_effect = Resolve<chroma::CreateMouseEffect>(sdk.library, "CreateMouseEffect");
  }
  auto init_sdk = Resolve<chroma::InitSdk>(sdk.library, "InitSDK");
  auto init = Resolve<chroma::Init>(sdk.library, "Init");
  if (!sdk.create_keyboard_effect || !sdk.create_mouse_effect || !(init_sdk || init)) {
    return false;
  }

  // Fails while the Chroma SDK service is not running, such as right after login;
  // the caller tries again later.
  chroma::Result result;
  if (init_sdk) {
    // The older Init() works too, but leaves the app unnamed in Synapse.
    chroma::AppInfo app_info = {};
    wcscpy_s(app_info.title, L"M\u014DDevice");
    wcscpy_s(app_info.description, L"Configure your mice and keyboards.");
    wcscpy_s(app_info.author.name, L"TeamDev");
    wcscpy_s(app_info.author.contact, L"https://teamdev.com/mobrowser/");
    app_info.supported_devices = 1 | 2;
    app_info.category = 1;
    result = init_sdk(&app_info);
  } else {
    result = init();
  }
  sdk.ready = result == chroma::kSuccess;
  return sdk.ready;
}

bool SetChromaColor(ChromaDeviceKind kind, uint8_t red, uint8_t green, uint8_t blue) {
  const ChromaSdk& sdk = Sdk();
  if (!sdk.ready) return false;
  const COLORREF color = RGB(red, green, blue);
  if (kind == ChromaDeviceKind::kKeyboard) {
    chroma::KeyboardStaticEffect effect = {color};
    return sdk.create_keyboard_effect(chroma::kKeyboardStatic, &effect, nullptr) ==
           chroma::kSuccess;
  }
  chroma::MouseStaticEffect effect = {chroma::kAllMouseLeds, color};
  return sdk.create_mouse_effect(chroma::kMouseStatic, &effect, nullptr) == chroma::kSuccess;
}
