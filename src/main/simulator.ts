import { native } from './gen/native';

const TICK_MS = 30_000;

export function startSimulator(): void {
  setInterval(() => {
    void native.simulator.Tick({}).catch((error: unknown) => {
      console.warn('Simulator tick failed.', error);
    });
  }, TICK_MS);
}
