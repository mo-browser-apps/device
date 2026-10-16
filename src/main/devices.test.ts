// Checks the main-process device model and VIA mapping. Run with `npm test`.
import assert from 'node:assert/strict';
import { LightEffect, LinkType, type DeviceList, type Settings } from './gen/devices';
import { Bus, type ConnectedKeyboard, type RawLighting } from './gen/native/devices';
import { DeviceState, type SavedDevices } from './device-state';
import { fromVia, toRawLighting, toVia, viaKeyboard, viaModel } from './via';

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

/** A device state with hooks that record what it did. */
function harness(saved: SavedDevices = { settings: {} }) {
  const writes: { connectionId: number; lighting: RawLighting }[] = [];
  const published: DeviceList[] = [];
  const stored: SavedDevices[] = [];
  let finishWrite: (() => void) | undefined;
  let failWrites = false;
  const state = new DeviceState(saved, {
    applyLighting(connectionId, lighting) {
      writes.push({ connectionId, lighting });
      if (failWrites) return Promise.reject(new Error('unplugged'));
      return new Promise((resolve) => (finishWrite = resolve));
    },
    changed: (devices) => published.push(devices),
    save: (devices) => stored.push(structuredClone(devices)),
  });
  return {
    state,
    writes,
    published,
    stored,
    finishWrite: () => finishWrite!(),
    failWrites: () => (failWrites = true),
    ids: () => state.list().devices.map((device) => device.id),
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

function testReconnectAndIdenticalKeyboards() {
  const { state, published, ids } = harness();
  state.reconcile({ keyboards: [keyboard({ connectionId: 1 }), keyboard({ connectionId: 2 })] });
  assert.deepEqual(ids().slice(2), ['keychron-k10-max', 'keychron-k10-max-2']);
  assert.equal(published.length, 1);

  // The same snapshot again changes nothing.
  state.reconcile({ keyboards: [keyboard({ connectionId: 1 }), keyboard({ connectionId: 2 })] });
  assert.equal(published.length, 1);

  // The first unplugged unit stays listed as disconnected.
  state.reconcile({ keyboards: [keyboard({ connectionId: 2 })] });
  assert.equal(state.list().devices[2].connected, false);

  // Plugged back in, it takes the first disconnected unit's place and reads its lighting again.
  const lighting = { effect: 1, hue: 0, saturation: 255, brightness: 0 };
  state.reconcile({ keyboards: [keyboard({ connectionId: 2 }), keyboard({ connectionId: 3, lighting })] });
  assert.deepEqual(ids().slice(2), ['keychron-k10-max', 'keychron-k10-max-2']);
  assert.equal(state.list().devices[2].connected, true);
  assert.equal(state.getSettings('keychron-k10-max').keyboard?.brightness, 0);

  // A third unit is numbered.
  state.reconcile({
    keyboards: [keyboard({ connectionId: 2 }), keyboard({ connectionId: 3 }), keyboard({ connectionId: 4 })],
  });
  assert.equal(ids()[4], 'keychron-k10-max-3');
}

function testPairForgetAndRestore() {
  const first = harness();
  // The first launch saves the demo pairing.
  assert.deepEqual(first.stored.at(-1)?.pairedIds, ['performance-mouse', 'travel-mouse']);
  first.state.pair('performance-mouse-secondary');
  first.state.forget('travel-mouse');
  assert.deepEqual(first.ids(), ['performance-mouse', 'performance-mouse-secondary']);
  assert.equal(first.state.discover().devices[0].connected, false);
  assert.equal(first.published.length, 2);
  assert.throws(() => first.state.pair('travel-mouse-unknown'));
  assert.throws(() => first.state.forget('travel-mouse'));

  // Real keyboards cannot be forgotten.
  first.state.reconcile({ keyboards: [keyboard({ bus: Bus.BUS_BLUETOOTH })] });
  assert.throws(() => first.state.forget('keychron-k10-max'));

  const restored = harness(first.stored.at(-1));
  assert.deepEqual(restored.ids(), ['performance-mouse', 'performance-mouse-secondary']);
  assert.deepEqual(restored.state.discover().devices.map((device) => device.id), ['travel-mouse']);
}

async function testSettings() {
  const { state, stored } = harness();
  const mouse = (dpi: number): Settings => ({
    deviceId: 'travel-mouse',
    mouse: { bindings: [{ control: 'wheel', action: 'copy' }], dpi, scrollSpeed: 5, naturalScroll: true },
  });
  await state.applySettings(mouse(2000));
  assert.equal(state.getSettings('travel-mouse').mouse?.dpi, 2000);

  // Restored on the next launch, but invalid saved settings are skipped.
  const saved = stored.at(-1)!;
  assert.equal(harness(saved).state.getSettings('travel-mouse').mouse?.dpi, 2000);
  saved.settings['travel-mouse'] = { deviceId: 'travel-mouse', mouse: { dpi: 99999 } };
  assert.equal(harness(saved).state.getSettings('travel-mouse').mouse?.dpi, 1200);

  // Mismatched variants and unsupported values are rejected without changing anything.
  await rejects(state.applySettings({ deviceId: 'travel-mouse', keyboard: { bindings: [], effect: 0, hue: 0, brightness: 0 } }));
  await rejects(state.applySettings({ deviceId: 'travel-mouse' }));
  await rejects(state.applySettings(mouse(100)));
  await rejects(state.applySettings({ ...mouse(2000), mouse: { ...mouse(2000).mouse!, scrollSpeed: 6 } }));
  await rejects(state.applySettings({ ...mouse(2000), mouse: { ...mouse(2000).mouse!, bindings: [{ control: 'back', action: 'copy' }] } }));
  await rejects(state.applySettings({ ...mouse(2000), deviceId: 'nobody' }));
  assert.equal(state.getSettings('travel-mouse').mouse?.dpi, 2000);
}

async function testKeyboardWrites() {
  const { state, writes, stored, finishWrite, failWrites } = harness();
  state.reconcile({ keyboards: [keyboard({ connectionId: 7, productId: 0x1256 })] });
  const id = 'via-3434-1256';
  const storedBefore = stored.length;
  const lighting = (effect: LightEffect, brightness = 40): Settings => ({
    deviceId: id,
    keyboard: { bindings: [], effect, hue: 0, brightness },
  });

  const write = state.applySettings(lighting(LightEffect.STATIC));
  assert.deepEqual(writes.at(-1), {
    connectionId: 7,
    lighting: { effect: 1, hue: 0, saturation: 255, brightness: 102 },
  });
  finishWrite();
  await write;
  assert.equal(state.getSettings(id).keyboard?.brightness, 40);
  // Real hardware keeps its own state, so its settings are never saved.
  assert.equal(stored.length, storedBefore);

  // Unsupported values never reach the keyboard.
  await rejects(state.applySettings(lighting(LightEffect.BREATHING)));
  await rejects(state.applySettings(lighting(LightEffect.STATIC, 101)));
  assert.equal(writes.length, 1);

  // A write that completes after the keyboard reconnected is ignored.
  const stale = state.applySettings(lighting(LightEffect.STATIC, 90));
  state.reconcile({ keyboards: [] });
  state.reconcile({ keyboards: [keyboard({ connectionId: 8, productId: 0x1256 })] });
  finishWrite();
  await stale;
  assert.equal(state.getSettings(id).keyboard?.brightness, 50);

  // While unplugged, writes fail without reaching native code.
  state.reconcile({ keyboards: [] });
  await rejects(state.applySettings(lighting(LightEffect.STATIC)));
  assert.equal(writes.length, 2);

  state.reconcile({ keyboards: [keyboard({ connectionId: 9, productId: 0x1256 })] });
  failWrites();
  await rejects(state.applySettings(lighting(LightEffect.STATIC)));
}

testConversionBoundaries();
testEffectMapping();
testCapabilities();
testReconnectAndIdenticalKeyboards();
testPairForgetAndRestore();
await testSettings();
await testKeyboardWrites();
console.log('devices.test: ok');
