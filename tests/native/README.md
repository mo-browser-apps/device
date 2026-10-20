    # Native discovery tests

Build the app once with `npm run dev:build`, then run these commands from the project
root. On Windows, use an x64 Visual Studio Developer PowerShell so the compiler can
find the Windows SDK and standard library.

```sh
cmake -S . -B build/cmake-build-release -DMODEVICE_BUILD_TESTS=ON
cmake --build build/cmake-build-release --target chroma_discovery_test
ctest --test-dir build/cmake-build-release --output-on-failure
```

The test compiles the production Chroma scanner with simulated HID and SDK functions.
It does not access hardware. It covers an idle Mamba receiver alongside a wired mouse,
a separate active wireless mouse, radio reconnection, USB unplug/replug, SDK reset,
invalid replies, Synapse response interference, and HID failures.

The presence query uses the Mamba 2018 serial-read packet and receiver wait time
documented by [OpenRazer's driver](https://github.com/openrazer/openrazer/tree/master/driver).
Only a matching, checksum-validated device-timeout reply establishes absence.
Host errors or unrelated replies do not.
