import { LightEffect, LinkType, type Device, type Settings } from './gen/devices';

interface DummyDevice {
  device: Device;
  settings: Settings;
}

interface MouseSeed {
  id: string;
  model: string;
  link: LinkType;
  firmware: string;
  battery: number;
  charging: boolean;
  buttons: [control: string, action: string][];
  minDpi: number;
  maxDpi: number;
  dpi: number;
}

const REMAPPABLE_KEYS = [
  'esc',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '0',
  'minus',
  'equal',
  'backspace',
  'tab',
  'q',
  'w',
  'e',
  'r',
  't',
  'y',
  'u',
  'i',
  'o',
  'p',
  'bracketleft',
  'bracketright',
  'backslash',
  'capslock',
  'a',
  's',
  'd',
  'f',
  'g',
  'h',
  'j',
  'k',
  'l',
  'semicolon',
  'quote',
  'enter',
  'shiftleft',
  'z',
  'x',
  'c',
  'v',
  'b',
  'n',
  'm',
  'comma',
  'period',
  'slash',
  'shiftright',
  'ctrlleft',
  'metaleft',
  'altleft',
  'space',
  'altright',
  'menu',
  'ctrlright',
];

function mouse(seed: MouseSeed): DummyDevice {
  const bindings = seed.buttons.map(([control, action]) => ({ control, action }));
  return {
    device: {
      id: seed.id,
      modelId: seed.id,
      model: seed.model,
      link: seed.link,
      firmware: seed.firmware,
      connected: true,
      hasBattery: true,
      battery: seed.battery,
      charging: seed.charging,
      live: false,
      mouse: {
        buttons: bindings.map(({ control }) => control),
        minDpi: seed.minDpi,
        maxDpi: seed.maxDpi,
      },
    },
    settings: {
      deviceId: seed.id,
      mouse: {
        bindings,
        dpi: seed.dpi,
        scrollSpeed: 3,
        naturalScroll: false,
      },
    },
  };
}

/** Creates the original simulated devices with fresh, session-only settings. */
export function dummyDevices(): DummyDevice[] {
  return [
    mouse({
      id: 'performance-mouse',
      model: 'Performance Mouse',
      link: LinkType.RECEIVER,
      firmware: '3.2.1',
      battery: 82,
      charging: true,
      buttons: [
        ['wheel', 'middle-click'],
        ['back', 'back'],
        ['forward', 'forward'],
        ['gesture', 'show-desktop'],
      ],
      minDpi: 400,
      maxDpi: 8000,
      dpi: 1600,
    }),
    mouse({
      id: 'travel-mouse',
      model: 'Travel Mouse',
      link: LinkType.BLUETOOTH,
      firmware: '1.4.0',
      battery: 15,
      charging: false,
      buttons: [['wheel', 'middle-click']],
      minDpi: 800,
      maxDpi: 3200,
      dpi: 1200,
    }),
    {
      device: {
        id: 'compact-keyboard',
        modelId: 'compact-keyboard',
        model: 'Compact Keyboard',
        link: LinkType.WIRED,
        firmware: '2.0.5',
        connected: true,
        hasBattery: false,
        battery: 0,
        charging: false,
        live: false,
        keyboard: {
          keys: REMAPPABLE_KEYS,
          backlight: true,
          color: true,
          effects: [LightEffect.STATIC, LightEffect.BREATHING, LightEffect.WAVE],
        },
      },
      settings: {
        deviceId: 'compact-keyboard',
        keyboard: {
          bindings: REMAPPABLE_KEYS.map((control) => ({ control, action: 'default' })),
          effect: LightEffect.STATIC,
          hue: 35,
          brightness: 70,
        },
      },
    },
  ];
}
