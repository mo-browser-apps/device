// Checks the main-process device model, VIA mapping, and Logitech mapping. Run with
// `npm test`.
import assert from 'node:assert/strict';
import { LightEffect, LinkType, type DeviceList, type Settings } from './gen/devices';
import {
  Bus,
  type ConnectedKeyboard,
  type ConnectedMouse,
  type RawLighting,
} from './gen/native/devices';
import { DeviceState, type SavedDevices } from './device-state';
import { logitechMouse } from './logitech';
import { fromVia, toRawLighting, toVia, viaKeyboard, viaModel } from './via';

const K10 = 'keychron-k10-max';
const M650 = 'logitech-signature-m650-l';

function keyboard(overrides: Partial<ConnectedKeyboard> = {}): ConnectedKeyboard {
  return {
    connectionId: 1,
    vendorId: 0x3434,
    productId: 0x0aa0,
    productName: 'Keychron K10 Max',
    bus: Bus.BUS_CABLE,
    protocolVersion: 12,
    hasColor: true,
    hasEffect: true,
    lighting: { effect: 1, hue: 85, saturation: 255, brightness: 128 },
    ...overrides,
  };
}

function mouse(overrides: Partial<ConnectedMouse> = {}): ConnectedMouse {
  return {
    connectionId: 100,
    name: 'Signature M650 L',
    protocol: '4.5',
    battery: 70,
    charging: false,
    dpi: 1000,
    minDpi: 400,
    maxDpi: 4000,
    ...overrides,
  };
}

/** A device state with hooks that record what it did. */
function harness(saved: SavedDevices = { paired: [] }) {
  const writes: { connectionId: number; lighting?: RawLighting; dpi?: number }[] = [];
  const published: DeviceList[] = [];
  const stored: SavedDevices[] = [];
  let finishWrite: (() => void) | undefined;
  let failWrites = false;
  const write = (record: (typeof writes)[number]) => {
    writes.push(record);
    if (failWrites) return Promise.reject(new Error('unplugged'));
    return new Promise<void>((resolve) => (finishWrite = resolve));
  };
  const state = new DeviceState(saved, {
    applyLighting: (connectionId, lighting) => write({ connectionId, lighting }),
    applyDpi: (connectionId, dpi) => write({ connectionId, dpi }),
    changed: (devices) => published.push(devices),
    save: (devices) => stored.push(structuredClone(devices)),
  });
  const ids = (list: DeviceList) => list.devices.map((device) => device.id);
  return {
    state,
    writes,
    published,
    stored,
    finishWrite: () => finishWrite!(),
    failWrites: () => (failWrites = true),
    paired: () => ids(state.list()),
    nearby: () => ids(state.discover()),
    device: (id: string) => state.list().devices.find((device) => device.id === id)!,
  };
}

async function rejects(promise: Promise<unknown>): Promise<void> {
  await assert.rejects(promise);
}

function testConversionBoundaries() {
  assert.deepEqual([0, 1, 50, 99, 100].map((value) => toVia(value, 100)), [0, 3, 128, 252, 255]);
  assert.deepEqual([0, 120, 359, 360].map((value) => toVia(value, 360)), [0, 85, 254, 255]);
  // Out-of-range values clamp rather than wrap around a byte.
  assert.equal(toVia(-5, 100), 0);
  assert.equal(toVia(500, 100), 255);
  assert.deepEqual([0, 3, 128, 255].map((value) => fromVia(value, 100)), [0, 1, 50, 100]);
  // Every editor value survives a round trip through VIA.
  for (let brightness = 0; brightness <= 100; brightness++) {
    assert.equal(fromVia(toVia(brightness, 100), 100), brightness);
  }
}

function testEffectMapping() {
  const known = viaModel(keyboard());
  const unknown = viaModel(keyboard({ vendorId: 0xcb10, productId: 0x1256, productName: '' }));
  assert.deepEqual(known, {
    id: 'keychron-k10-max',
    name: 'Keychron K10 Max',
    link: LinkType.WIRED,
    breathingEffect: 2,
    waveEffect: 5,
  });
  assert.equal(unknown.id, 'via-cb10-1256');
  assert.equal(unknown.name, 'Keyboard');

  const lighting = (effect: LightEffect) => ({ bindings: [], effect, hue: 120, brightness: 50 });
  assert.deepEqual(toRawLighting(lighting(LightEffect.BREATHING), known), {
    effect: 2,
    hue: 85,
    saturation: 255,
    brightness: 128,
  });
  assert.equal(toRawLighting(lighting(LightEffect.WAVE), known).effect, 5);
  // Unknown firmware gets solid color only.
  assert.equal(toRawLighting(lighting(LightEffect.BREATHING), unknown).effect, 1);
  assert.equal(toRawLighting(lighting(LightEffect.WAVE), unknown).effect, 1);

  const shown = (effect: number, overrides: Partial<ConnectedKeyboard> = {}) =>
    viaKeyboard('k', keyboard({ lighting: { effect, hue: 0, saturation: 0, brightness: 255 }, ...overrides }))
      .settings.keyboard!;
  assert.equal(shown(1).effect, LightEffect.STATIC);
  assert.equal(shown(2).effect, LightEffect.BREATHING);
  // Effects the editor cannot show read as Wave; off reads as Steady at zero brightness.
  assert.equal(shown(9).effect, LightEffect.WAVE);
  assert.deepEqual([shown(0).effect, shown(0).brightness], [LightEffect.STATIC, 0]);
  assert.equal(shown(2, { productId: 0x1256 }).effect, LightEffect.WAVE);
}

function testCapabilities() {
  const spec = (overrides: Partial<ConnectedKeyboard>) =>
    viaKeyboard('k', keyboard(overrides)).device;
  const rgb = spec({});
  assert.equal(rgb.live && rgb.connected && !rgb.hasBattery, true);
  assert.equal(rgb.firmware, 'VIA protocol 12');
  assert.deepEqual(rgb.keyboard, {
    keys: [],
    backlight: true,
    color: true,
    effects: [LightEffect.STATIC, LightEffect.BREATHING, LightEffect.WAVE],
  });
  // Single-color backlight without an effect list.
  assert.deepEqual(spec({ hasColor: false, hasEffect: false }).keyboard?.effects, [
    LightEffect.STATIC,
  ]);
  assert.equal(spec({ hasColor: false }).keyboard?.color, false);
  assert.deepEqual(spec({ productId: 0x1256 }).keyboard?.effects, [LightEffect.STATIC]);
  assert.equal(spec({ bus: Bus.BUS_BLUETOOTH }).link, LinkType.BLUETOOTH);
  assert.equal(spec({ productId: 0xd030 }).link, LinkType.RECEIVER);
  // Hue 359 must not round to 360.
  const hue = viaKeyboard('k', keyboard({ lighting: { effect: 1, hue: 255, saturation: 0, brightness: 0 } }));
  assert.equal(hue.settings.keyboard?.hue, 359);
}

function testMouseMapping() {
  const { device, settings } = logitechMouse(M650, mouse());
  assert.equal(device.modelId, M650);
  assert.equal(device.model, 'Signature M650 L');
  assert.equal(device.link, LinkType.RECEIVER);
  assert.equal(device.firmware, 'HID++ 4.5');
  assert.equal(device.live && device.hasBattery && device.battery === 70, true);
  assert.deepEqual(device.mouse, { buttons: [], minDpi: 400, maxDpi: 4000 });
  assert.equal(settings.mouse?.dpi, 1000);
}

function testStartsEmptyAndPairsFromDiscovery() {
  const { state, paired, nearby, stored, published } = harness();
  assert.deepEqual(paired(), []);
  assert.deepEqual(nearby(), []);

  // Connected devices are offered for pairing, not listed.
  state.reconcile({ keyboards: [keyboard()], mice: [mouse()] });
  assert.deepEqual(paired(), []);
  assert.deepEqual(nearby(), [K10, M650]);

  state.pair(M650);
  assert.deepEqual(paired(), [M650]);
  assert.deepEqual(nearby(), [K10]);
  assert.equal(published.at(-1)?.devices[0].battery, 70);
  assert.equal(stored.at(-1)?.paired.length, 1);
  assert.throws(() => state.pair(M650));
  assert.throws(() => state.pair('nobody'));
  assert.throws(() => state.getSettings(K10));

  // An unpaired device that goes away is no longer offered.
  state.reconcile({ keyboards: [], mice: [mouse()] });
  assert.deepEqual(nearby(), []);
}

function testRestoresPairedDevicesDisconnected() {
  const first = harness();
  first.state.reconcile({ keyboards: [keyboard()], mice: [mouse()] });
  first.state.pair(K10);
  first.state.pair(M650);

  const restored = harness(first.stored.at(-1));
  assert.deepEqual(restored.paired(), [K10, M650]);
  assert.equal(restored.device(M650).connected, false);
  // The last known battery and settings are shown until the device connects.
  assert.equal(restored.device(M650).battery, 70);
  assert.equal(restored.state.getSettings(M650).mouse?.dpi, 1000);

  // Connecting again reads the hardware rather than restoring saved settings onto it.
  restored.state.reconcile({ keyboards: [], mice: [mouse({ connectionId: 5, dpi: 1600 })] });
  assert.equal(restored.device(M650).connected, true);
  assert.equal(restored.state.getSettings(M650).mouse?.dpi, 1600);
  assert.deepEqual(restored.nearby(), []);

  // Invalid saved data is skipped.
  assert.deepEqual(harness({ paired: [null, { device: { id: 'x' } }, 7] }).paired(), []);
}

function testForget() {
  const { state, paired, nearby } = harness();
  state.reconcile({ keyboards: [keyboard()], mice: [mouse()] });
  state.pair(K10);
  state.pair(M650);

  // A connected device can be added again at once.
  state.forget(K10);
  assert.deepEqual(paired(), [M650]);
  assert.deepEqual(nearby(), [K10]);
  assert.throws(() => state.forget(K10));

  // A disconnected one disappears until it connects again.
  state.reconcile({ keyboards: [keyboard()], mice: [] });
  state.forget(M650);
  assert.deepEqual(paired(), []);
  assert.deepEqual(nearby(), [K10]);
}

function testReconnectAndIdenticalDevices() {
  const { state, paired, nearby, published, device } = harness();
  state.reconcile({ keyboards: [keyboard({ connectionId: 1 }), keyboard({ connectionId: 2 })], mice: [] });
  assert.deepEqual(nearby(), [K10, `${K10}-2`]);
  state.pair(K10);
  state.pair(`${K10}-2`);
  const publishedBefore = published.length;

  // The same snapshot again changes nothing.
  state.reconcile({ keyboards: [keyboard({ connectionId: 1 }), keyboard({ connectionId: 2 })], mice: [] });
  assert.equal(published.length, publishedBefore);

  // The first unplugged unit stays listed as disconnected; plugged back in, it takes the
  // first disconnected unit's place and reads its lighting again.
  state.reconcile({ keyboards: [keyboard({ connectionId: 2 })], mice: [] });
  assert.equal(device(K10).connected, false);
  const lighting = { effect: 1, hue: 0, saturation: 255, brightness: 0 };
  state.reconcile({ keyboards: [keyboard({ connectionId: 2 }), keyboard({ connectionId: 3, lighting })], mice: [] });
  assert.deepEqual(paired(), [K10, `${K10}-2`]);
  assert.equal(device(K10).connected, true);
  assert.equal(state.getSettings(K10).keyboard?.brightness, 0);

  // A third unit is numbered without reusing a taken ID.
  state.reconcile({
    keyboards: [keyboard({ connectionId: 2 }), keyboard({ connectionId: 3 }), keyboard({ connectionId: 4 })],
    mice: [],
  });
  assert.deepEqual(nearby(), [`${K10}-3`]);
}

function testMouseBatteryUpdates() {
  const { state, published, device } = harness();
  state.reconcile({ keyboards: [], mice: [mouse()] });
  state.pair(M650);
  const publishedBefore = published.length;

  state.reconcile({ keyboards: [], mice: [mouse({ battery: 65, dpi: 400 })] });
  assert.equal(device(M650).battery, 65);
  assert.equal(published.length, publishedBefore + 1);
  // DPI in a later snapshot does not replace the settings the app holds.
  assert.equal(state.getSettings(M650).mouse?.dpi, 1000);

  state.reconcile({ keyboards: [], mice: [mouse({ battery: 65 })] });
  assert.equal(published.length, publishedBefore + 1);
}

async function testSettingsValidation() {
  const { state, writes } = harness();
  state.reconcile({ keyboards: [keyboard({ productId: 0x1256 })], mice: [mouse()] });
  state.pair(M650);
  const dpi = (value: number): Settings => ({
    deviceId: M650,
    mouse: { bindings: [], dpi: value, scrollSpeed: 3, naturalScroll: false },
  });
  const lighting = (effect: LightEffect, brightness = 40): Settings => ({
    deviceId: 'via-3434-1256',
    keyboard: { bindings: [], effect, hue: 0, brightness },
  });

  // Mismatched variants and unsupported values never reach the hardware.
  await rejects(state.applySettings({ deviceId: M650, keyboard: lighting(LightEffect.STATIC).keyboard }));
  await rejects(state.applySettings({ deviceId: M650 }));
  await rejects(state.applySettings(dpi(100)));
  await rejects(state.applySettings(dpi(5000)));
  await rejects(state.applySettings({ ...dpi(800), mouse: { ...dpi(800).mouse!, bindings: [{ control: 'back', action: 'copy' }] } }));
  await rejects(state.applySettings({ ...dpi(800), deviceId: 'nobody' }));
  // An unknown keyboard offers solid color only.
  await rejects(state.applySettings(lighting(LightEffect.BREATHING)));
  await rejects(state.applySettings(lighting(LightEffect.STATIC, 101)));
  assert.equal(writes.length, 0);
}

async function testWrites() {
  const { state, writes, stored, finishWrite, failWrites } = harness();
  state.reconcile({ keyboards: [keyboard({ connectionId: 7, productId: 0x1256 })], mice: [mouse()] });
  state.pair(M650);
  state.pair('via-3434-1256');
  const dpi = (value: number): Settings => ({
    deviceId: M650,
    mouse: { bindings: [], dpi: value, scrollSpeed: 3, naturalScroll: false },
  });
  const lighting = (brightness: number): Settings => ({
    deviceId: 'via-3434-1256',
    keyboard: { bindings: [], effect: LightEffect.STATIC, hue: 0, brightness },
  });

  let write = state.applySettings(lighting(40));
  assert.deepEqual(writes.at(-1), {
    connectionId: 7,
    lighting: { effect: 1, hue: 0, saturation: 255, brightness: 102 },
  });
  finishWrite();
  await write;
  assert.equal(state.getSettings('via-3434-1256').keyboard?.brightness, 40);

  const storedBefore = stored.length;
  write = state.applySettings(dpi(1600));
  assert.deepEqual(writes.at(-1), { connectionId: 100, dpi: 1600 });
  finishWrite();
  await write;
  assert.equal(state.getSettings(M650).mouse?.dpi, 1600);
  // Writes are not saved one by one; the latest settings are kept once the device leaves.
  assert.equal(stored.length, storedBefore);

  // A write that completes after the mouse woke up again is ignored.
  const stale = state.applySettings(dpi(800));
  state.reconcile({ keyboards: [keyboard({ connectionId: 7, productId: 0x1256 })], mice: [] });
  assert.equal(stored.length, storedBefore + 1);
  const saved = stored.at(-1)!.paired as { settings: Settings }[];
  assert.equal(saved.find(({ settings }) => settings.deviceId === M650)?.settings.mouse?.dpi, 1600);
  state.reconcile({ keyboards: [keyboard({ connectionId: 7, productId: 0x1256 })], mice: [mouse({ connectionId: 101 })] });
  finishWrite();
  await stale;
  assert.equal(state.getSettings(M650).mouse?.dpi, 1000);

  // While disconnected, writes fail without reaching native code.
  state.reconcile({ keyboards: [], mice: [] });
  const writesBefore = writes.length;
  await rejects(state.applySettings(dpi(800)));
  assert.equal(writes.length, writesBefore);

  state.reconcile({ keyboards: [], mice: [mouse({ connectionId: 102 })] });
  failWrites();
  await rejects(state.applySettings(dpi(800)));
}

testConversionBoundaries();
testEffectMapping();
testCapabilities();
testMouseMapping();
testStartsEmptyAndPairsFromDiscovery();
testRestoresPairedDevicesDisconnected();
testForget();
testReconnectAndIdenticalDevices();
testMouseBatteryUpdates();
await testSettingsValidation();
await testWrites();
console.log('devices.test: ok');
