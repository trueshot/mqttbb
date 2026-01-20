#include "f_machine.h"
F_Machine f_machine;

#include <esp_task_wdt.h>

#include <M5AtomS3.h>
#include "geth/derblinkenlights.h"
DerBlinkenLights der;

BlinkenPair
  bp_INIT_FAILED{ CRGB::Red, CRGB::Black },
  bp_NO_CONFIG{ CRGB::Orange, CRGB::Black },
  bp_id_labels{ CRGB::DodgerBlue, CRGB::Black },
  bp_BAD_PASSWORD{ CRGB::Orange, CRGB::Goldenrod },
  bp_try_wifi{ CRGB::Orange, CRGB::White },
  bp_AP_NOT_FOUND{ CRGB::Orange, CRGB::Violet },
  bp_MAIN{ CRGB::Green, CRGB::Green },
  bp_WIFI_LOST{ CRGB::Orange, CRGB::Green },
  bp_poll{ CRGB::AliceBlue, CRGB::Aqua },
  bp_click_label{ CRGB::DodgerBlue, CRGB::Green },
  bp_REBOOT{ CRGB::Goldenrod, CRGB::Red };

int global_timezone = 0;

bool syncNTPTime(void) {
    const char *ntpServer = "time.cloudflare.com";
    configTime(global_timezone * 3600, 0, ntpServer);

    struct tm timeInfo;
    const uint32_t waitForTimeMillis = 15 * 1000;
    unsigned long start = millis();
    if (getLocalTime(&timeInfo, waitForTimeMillis)) {  // getLocalTime() has its own tight loop with delay()
      log_i("got NTP time after %dms", millis() - start);
      return true;
    }
    log_w("no NTP time after %dms", waitForTimeMillis);
    return false;
}

F_Machine::F_Machine() {
  stage = ZERO;
}

void F_Machine::BeginTheBeguine() {
  const bool ledEnable = true;
  AtomS3.begin(ledEnable);
  // setBrightness clips to [0:100], and scales to [0:40] internally;
  // but the default brightness is much brighter than "100%".
  // AtomS3.dis.setBrightness(100);
  // One time when restarting (via code) after setting the brightness
  // to 10%, it did not switch back to default. But currently, we
  // never change the brightness. So leave it at "max".

  xTaskCreateUniversal(
      [](void *pvParameters) {
        for (;;) {
          esp_task_wdt_reset();
          der.update();
        }
      }, "DerBlinken",
      CONFIG_ESP_MINIMAL_SHARED_STACK_SIZE, nullptr,
      uxTaskPriorityGet(nullptr), nullptr, ARDUINO_RUNNING_CORE);
}

void F_Machine::InitFailed() {
  der.setSteady(bp_INIT_FAILED);
}

void F_Machine::NoConfig() {
  stage = SHARE_CONFIG;
  der.setSteady(bp_NO_CONFIG);
  der.setEvent(bp_id_labels);
}

uint8_t F_Machine::NextWifiChannel() {
  static constexpr uint8_t channelSequence[] = {
    6, 1, 11, 3, 8, 5, 10, 2, 7, 4, 9,
  };
  static size_t seq = sizeof(channelSequence);
  if (++seq >= sizeof(channelSequence)) {
    seq = 0;
  }
  return channelSequence[seq];
}

void F_Machine::AttemptingWifiConnect() {
  stage = WIFI_CONNECT;
  der.setSteady(bp_BAD_PASSWORD);
  der.setEvent(bp_try_wifi);
}

void F_Machine::AccessPointNotFound() {
  stage = SHARE_CONFIG;
  der.setSteady(bp_AP_NOT_FOUND);
  log_w("access point not found");
}

void F_Machine::WifiConnect(bool success) {
  wifi = success;
  if (wifi) {
    if (!clockSync && syncNTPTime()) {
      clockSync = true;
    }
    der.setSteady(bp_MAIN);
    stage = MAIN;
  } else {
    stage = SHARE_CONFIG;
  }
  log_i("clockSync: %d stage: %d", clockSync, stage);
}

void F_Machine::GotTemplate() {
  haveTemplate = true;
  der.setSteady(bp_MAIN);
  stage = MAIN;
}

void F_Machine::PollEvent() {
  static int pollCount = 3;
  der.setEvent(bp_poll);
  if (--pollCount > 0) {
    return;
  }

  stage = MAIN;
  log_i("%d", stage);
}

void F_Machine::ButtonHoldEvent() {
  der.setEvent(bp_click_label);
}

void F_Machine::RebootShortly() {
  der.setSteady(bp_REBOOT);
  stage = REBOOT;
  log_i("%d", stage);
}

void F_Machine::Loop() {
  delay(55);
}

const char *F_Machine::Descriptor() {
  switch(stage) {
  }
  return "Connected";
}
