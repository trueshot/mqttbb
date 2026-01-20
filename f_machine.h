#pragma once

#include <cstdint>

enum F_Stage {
  ZERO,  // Not initialized, or failed to completely initialize
  SHARE_CONFIG,  // On the receiving end; only time to switch channels
  WIFI_CONNECT,  // Ignore broadcast while trying to connect
  MAIN,
  REBOOT,
};

class F_Machine {
  public:
    F_Stage stage;
    F_Machine();
    // Right at the top of setup()
    void BeginTheBeguine();
    // Fatal, like ESP-Now just not working
    void InitFailed();
    // No valid config; could be completely empty
    void NoConfig();
    // Channel to use, to await broadcast
    uint8_t NextWifiChannel();
    void AttemptingWifiConnect();
    void AccessPointNotFound();
    void WifiConnect(bool success);
    void PollEvent();
    void ButtonHoldEvent();
    void RebootShortly();
    void Loop();
    const char *Descriptor();
  private:
    bool config;
    bool wifi;
    bool clockSync;
    bool haveTemplate;
};

extern F_Machine f_machine;
