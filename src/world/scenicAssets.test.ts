import { describe, expect, it, vi } from 'vitest';
import type { ScenicRegionId } from './scenicVisibility';
import {
  createScenicAssetCache,
  getScenicAssetSnapshot,
  type ScenicAssetLoader,
  type ScenicComponent,
} from './scenicAssets';

const IDS: readonly ScenicRegionId[] = [
  'lookout',
  'orchard',
  'observatory',
  'dawnlight',
  'windward',
  'amber',
  'woodland',
  'northstar',
  'slate',
];
const Ready: ScenicComponent = () => null;
const deferred = () => {
  let resolve!: (component: ScenicComponent) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<ScenicComponent>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const fixture = (overrides: Partial<Record<ScenicRegionId, ScenicAssetLoader>> = {}) => {
  const loaders = Object.fromEntries(
    IDS.map((id) => [id, vi.fn(overrides[id] ?? (() => Promise.resolve(Ready)))]),
  ) as Record<ScenicRegionId, ReturnType<typeof vi.fn<ScenicAssetLoader>>>;
  return { loaders, cache: createScenicAssetCache(loaders) };
};

describe('independent scenic asset loading', () => {
  it('keeps registry import and cache creation inert', () => {
    expect(Object.values(getScenicAssetSnapshot()).every((asset) => asset.status === 'idle')).toBe(
      true,
    );
    const { cache, loaders } = fixture();
    expect(Object.values(cache.getSnapshot()).every((asset) => asset.status === 'idle')).toBe(true);
    for (const loader of Object.values(loaders)) expect(loader).not.toHaveBeenCalled();
  });

  it('deduplicates a pending load and preserves a preloaded component across remounts', async () => {
    const pending = deferred();
    const { cache, loaders } = fixture({ orchard: () => pending.promise });
    const first = cache.load('orchard');
    expect(cache.load('orchard')).toBe(first);
    const preload = cache.preload(['orchard', 'orchard']);
    expect(cache.getSnapshot().orchard.status).toBe('loading');
    pending.resolve(Ready);
    await preload;
    expect(await first).toBe(Ready);
    expect(cache.getSnapshot().orchard.component).toBe(Ready);
    expect(cache.load('orchard')).toBe(first);
    expect(await cache.retry('orchard')).toBe(Ready);
    expect(loaders.orchard).toHaveBeenCalledOnce();
    expect(cache.getSnapshot().orchard.attempt).toBe(0);
    for (const id of IDS.filter((id) => id !== 'orchard'))
      expect(loaders[id]).not.toHaveBeenCalled();
  });

  it('starts requested preloads independently and isolates one rejected chunk', async () => {
    const orchard = deferred();
    const amber = deferred();
    const { cache, loaders } = fixture({
      orchard: () => orchard.promise,
      amber: () => amber.promise,
    });
    const preload = cache.preload(['orchard', 'amber', 'orchard']);
    await Promise.resolve();
    expect(loaders.orchard).toHaveBeenCalledOnce();
    expect(loaders.amber).toHaveBeenCalledOnce();
    orchard.reject(new Error('Orchard chunk unavailable'));
    amber.resolve(Ready);
    await preload;
    expect(cache.getSnapshot().orchard).toMatchObject({ status: 'failed', attempt: 0 });
    expect(cache.getSnapshot().orchard.error).toEqual({
      name: 'Error',
      message: 'Orchard chunk unavailable',
    });
    expect(cache.getSnapshot().amber.status).toBe('ready');
    expect(cache.getSnapshot().lookout.status).toBe('idle');
    await expect(cache.load('orchard')).rejects.toThrow('Orchard chunk unavailable');
    expect(loaders.orchard).toHaveBeenCalledOnce();
  });

  it('retries only the exact failed region with a fresh promise and generation', async () => {
    let calls = 0;
    const { cache, loaders } = fixture({
      orchard: () => {
        calls++;
        return calls === 1 ? Promise.reject(new Error('first attempt')) : Promise.resolve(Ready);
      },
    });
    await cache.preload(['orchard', 'amber']);
    const failed = cache.load('orchard');
    await expect(failed).rejects.toThrow('first attempt');
    const retry = cache.retry('orchard');
    expect(retry).not.toBe(failed);
    expect(cache.retry('orchard')).toBe(retry);
    expect(cache.getSnapshot().orchard).toMatchObject({ status: 'loading', attempt: 1 });
    expect(cache.getSnapshot().orchard.error).toBeUndefined();
    await retry;
    expect(cache.getSnapshot().orchard).toMatchObject({ status: 'ready', attempt: 1 });
    expect(loaders.orchard).toHaveBeenCalledTimes(2);
    expect(loaders.amber).toHaveBeenCalledOnce();
  });

  it('records render failures independently and does not reload until explicitly retried', async () => {
    const { cache, loaders } = fixture();
    await cache.preload(['orchard', 'amber']);
    expect(cache.reportFailure('orchard', new TypeError('render failed'), 0)).toBe(true);
    expect(cache.getSnapshot().orchard.component).toBeUndefined();
    expect(cache.getSnapshot().orchard.error).toEqual({
      name: 'TypeError',
      message: 'render failed',
    });
    expect(cache.reportFailure('orchard', new Error('later duplicate'), 0)).toBe(false);
    expect(cache.getSnapshot().orchard.error?.message).toBe('render failed');
    expect(cache.getSnapshot().amber.status).toBe('ready');
    await expect(cache.load('orchard')).rejects.toThrow('render failed');
    expect(loaders.orchard).toHaveBeenCalledOnce();
    await cache.retry('orchard');
    expect(loaders.orchard).toHaveBeenCalledTimes(2);
    expect(cache.getSnapshot().orchard.error).toBeUndefined();
  });

  it.each(['resolve', 'reject'] as const)(
    'ignores stale %s completions and stale render errors after retry',
    async (finish) => {
      const old = deferred();
      const current = deferred();
      let calls = 0;
      const { cache } = fixture({ orchard: () => (++calls === 1 ? old.promise : current.promise) });
      const oldLoad = cache.load('orchard');
      await Promise.resolve();
      cache.reportFailure('orchard', new Error('cancelled attempt'), 0);
      const retry = cache.retry('orchard');
      if (finish === 'resolve') old.resolve(() => null);
      else old.reject(new Error('late import failure'));
      await oldLoad.catch(() => {});
      expect(cache.getSnapshot().orchard).toMatchObject({ status: 'loading', attempt: 1 });
      expect(cache.reportFailure('orchard', new Error('late render failure'), 0)).toBe(false);
      current.resolve(Ready);
      await retry;
      expect(cache.getSnapshot().orchard).toMatchObject({
        status: 'ready',
        attempt: 1,
        component: Ready,
      });
    },
  );

  it('keeps failed retries failed without a loop and safely summarizes unknown errors', async () => {
    const { cache, loaders } = fixture({
      slate: () => {
        throw 'failed';
      },
    });
    await cache.preload(['slate']);
    await expect(cache.retry('slate')).rejects.toBe('failed');
    await expect(cache.load('slate')).rejects.toBe('failed');
    expect(loaders.slate).toHaveBeenCalledTimes(2);
    expect(cache.getSnapshot().slate).toMatchObject({ status: 'failed', attempt: 1 });
    expect(cache.getSnapshot().slate.error).toEqual({
      name: 'ScenicAssetError',
      message: 'Unable to display this scenery.',
    });
  });

  it('offers explicit reload only after consecutive import failures', async () => {
    const { cache } = fixture({
      slate: () => Promise.reject(new TypeError('cached module rejection')),
    });
    await cache.preload(['slate']);
    expect(cache.getSnapshot().slate).toMatchObject({ failureKind: 'load', recovery: 'retry' });
    await expect(cache.retry('slate')).rejects.toThrow('cached module rejection');
    expect(cache.getSnapshot().slate).toMatchObject({ failureKind: 'load', recovery: 'reload' });
    expect(cache.getSnapshot().amber.status).toBe('idle');
  });

  it('does not recommend reload for repeated render failures or stale import failures', async () => {
    const { cache } = fixture();
    await cache.load('orchard');
    cache.reportFailure('orchard', new Error('render failure'), 0);
    expect(cache.getSnapshot().orchard).toMatchObject({ failureKind: 'render', recovery: 'retry' });
    await cache.retry('orchard');
    cache.reportFailure('orchard', new Error('render failure'), 1);
    expect(cache.getSnapshot().orchard).toMatchObject({ failureKind: 'render', recovery: 'retry' });
    expect(cache.reportFailure('orchard', new Error('old chunk failure'), 0, 'load')).toBe(false);
    expect(cache.getSnapshot().orchard.recovery).toBe('retry');
  });

  it('resets import recovery history after a successful retry', async () => {
    let calls = 0;
    const { cache } = fixture({
      slate: () => {
        calls++;
        return calls === 1
          ? Promise.reject(new Error('first chunk failure'))
          : Promise.resolve(Ready);
      },
    });
    await cache.preload(['slate']);
    await cache.retry('slate');
    expect(cache.getSnapshot().slate.failureKind).toBeUndefined();
    expect(cache.getSnapshot().slate.recovery).toBeUndefined();
    cache.reportFailure('slate', new Error('new import failure'), 1, 'load');
    expect(cache.getSnapshot().slate.recovery).toBe('retry');
  });

  it('provides stable frozen snapshots and unsubscribes notifications', async () => {
    const pending = deferred();
    const { cache } = fixture({ orchard: () => pending.promise });
    const initial = cache.getSnapshot();
    expect(cache.getSnapshot()).toBe(initial);
    const listener = vi.fn();
    const unsubscribe = cache.subscribe(listener);
    const loading = cache.load('orchard');
    expect(cache.getSnapshot()).not.toBe(initial);
    expect(cache.getSnapshot().amber).toBe(initial.amber);
    expect(Object.isFrozen(cache.getSnapshot())).toBe(true);
    expect(Object.isFrozen(cache.getSnapshot().orchard)).toBe(true);
    await Promise.resolve();
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
    pending.resolve(Ready);
    await loading;
    expect(listener).toHaveBeenCalledOnce();
    const ready = cache.getSnapshot();
    expect(cache.getSnapshot()).toBe(ready);
  });
});
