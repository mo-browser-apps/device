// Test stand-in for HIDAPI's public header: only what the native code uses.
// The fake implementation lives in via_test.cc.
#ifndef FAKE_HIDAPI_H_
#define FAKE_HIDAPI_H_

#include <cstddef>

typedef struct hid_device_ hid_device;

struct hid_device_info {
  char* path;
  unsigned short vendor_id;
  unsigned short product_id;
  wchar_t* serial_number;
  wchar_t* manufacturer_string;
  wchar_t* product_string;
  unsigned short usage_page;
  unsigned short usage;
  hid_device_info* next;
};

int hid_init();
hid_device_info* hid_enumerate(unsigned short vendor_id, unsigned short product_id);
void hid_free_enumeration(hid_device_info* devices);
hid_device* hid_open_path(const char* path);
int hid_write(hid_device* device, const unsigned char* data, size_t length);
int hid_read_timeout(hid_device* device, unsigned char* data, size_t length, int milliseconds);
void hid_close(hid_device* device);
void hid_darwin_set_open_exclusive(int open_exclusive);

#endif  // FAKE_HIDAPI_H_
