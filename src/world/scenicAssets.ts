import type { ComponentType } from 'react';
import type { ScenicRegionId } from './scenicVisibility';

export type ScenicComponent = ComponentType;
export type ScenicAssetLoader = () => Promise<ScenicComponent>;
export type ScenicAssetStatus = 'idle' | 'loading' | 'ready' | 'failed';
export type ScenicAssetFailureKind = 'load' | 'render';
export type ScenicAssetSnapshot = Readonly<{
  id: ScenicRegionId;
  status: ScenicAssetStatus;
  attempt: number;
  component?: ScenicComponent;
  failureKind?: ScenicAssetFailureKind;
  /** Explicit user recovery; never reload the page automatically. */
  recovery?: 'retry' | 'reload';
  error?: Readonly<{ name: string; message: string }>;
}>;
export type ScenicAssetsSnapshot = Readonly<Record<ScenicRegionId, ScenicAssetSnapshot>>;

// Literal import paths let Vite emit independent authored-scenery chunks.
// Defining this registry does not start any imports.
const SCENIC_LOADERS: Readonly<Record<ScenicRegionId, ScenicAssetLoader>> = {
  lookout: () => import('./scenery/Lookout').then((module) => module.MeadowLookout),
  orchard: () => import('./scenery/Orchard').then((module) => module.OrchardCommons),
  observatory: () => import('./scenery/Observatory').then((module) => module.CedarObservatory),
  dawnlight: () =>
    import('./scenery/DawnlightGlasshouse').then((module) => module.DawnlightGlasshouse),
  windward: () => import('./scenery/WindwardMill').then((module) => module.WindwardMill),
  amber: () => import('./scenery/AmberBluff').then((module) => module.AmberBluff),
  woodland: () => import('./scenery/WoodlandHollow').then((module) => module.LanternHollow),
  northstar: () => import('./scenery/NorthstarOutpost').then((module) => module.NorthstarOutpost),
  slate: () => import('./scenery/SlateReach').then((module) => module.SlateReach),
};

function errorSummary(error: unknown) {
  return Object.freeze(
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { name: 'ScenicAssetError', message: 'Unable to display this scenery.' },
  );
}

/** An independent, injectable loading cache with no resident or navigation state. */
export function createScenicAssetCache(
  loaders: Readonly<Record<ScenicRegionId, ScenicAssetLoader>>,
) {
  const ids = Object.keys(loaders) as ScenicRegionId[];
  const entries = new Map<
    ScenicRegionId,
    { attempt: number; consecutiveLoadFailures: number; promise?: Promise<ScenicComponent> }
  >();
  let snapshot: ScenicAssetsSnapshot = Object.freeze(
    Object.fromEntries(
      ids.map((id) => {
        entries.set(id, { attempt: 0, consecutiveLoadFailures: 0 });
        return [id, Object.freeze({ id, status: 'idle', attempt: 0 })];
      }),
    ),
  ) as ScenicAssetsSnapshot;
  const listeners = new Set<() => void>();
  let notificationQueued = false;
  const publish = (id: ScenicRegionId, next: ScenicAssetSnapshot) => {
    snapshot = Object.freeze({ ...snapshot, [id]: Object.freeze(next) });
    // Lazy initialization may request a load during render. Notify after that
    // render, rather than synchronously updating another mounted boundary.
    if (!notificationQueued) {
      notificationQueued = true;
      queueMicrotask(() => {
        notificationQueued = false;
        for (const listener of listeners) listener();
      });
    }
  };
  const failedPromise = (error: unknown) => {
    const promise = Promise.reject<ScenicComponent>(error);
    void promise.catch(() => {});
    return promise;
  };
  const reportFailure = (
    id: ScenicRegionId,
    error: unknown,
    attempt: number,
    failureKind: ScenicAssetFailureKind = 'render',
  ) => {
    const entry = entries.get(id)!;
    if (entry.attempt !== attempt || snapshot[id].status === 'failed') return false;
    entry.consecutiveLoadFailures = failureKind === 'load' ? entry.consecutiveLoadFailures + 1 : 0;
    entry.promise = failedPromise(error);
    publish(id, {
      id,
      status: 'failed',
      attempt,
      error: errorSummary(error),
      failureKind,
      // Some browsers retain a rejected native module URL. One fresh loader
      // attempt is useful; repeated import failures need an honest reload path.
      recovery: entry.consecutiveLoadFailures >= 2 ? 'reload' : 'retry',
    });
    return true;
  };
  const load = (id: ScenicRegionId): Promise<ScenicComponent> => {
    const entry = entries.get(id)!;
    if (entry.promise) return entry.promise;
    const attempt = entry.attempt;
    publish(id, { id, status: 'loading', attempt });
    const promise = Promise.resolve()
      .then(loaders[id])
      .then(
        (component) => {
          if (entry.attempt === attempt && snapshot[id].status === 'loading') {
            entry.consecutiveLoadFailures = 0;
            publish(id, { id, status: 'ready', attempt, component });
          }
          return component;
        },
        (error: unknown) => {
          reportFailure(id, error, attempt, 'load');
          throw error;
        },
      );
    entry.promise = promise;
    // Imperative preloads may be intentionally fire-and-forget; failures remain
    // observable in the snapshot and are still rejected to awaiting callers.
    void promise.catch(() => {});
    return promise;
  };
  const retry = (id: ScenicRegionId) => {
    const entry = entries.get(id)!;
    if (snapshot[id].status === 'failed') {
      entry.attempt++;
      entry.promise = undefined;
      publish(id, { id, status: 'idle', attempt: entry.attempt });
    }
    return load(id);
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load,
    // One failed destination must not prevent independent destinations loading.
    preload: (regions: readonly ScenicRegionId[]) =>
      Promise.allSettled([...new Set(regions)].map(load)).then(() => undefined),
    retry,
    reportFailure,
  };
}

export const scenicAssets = createScenicAssetCache(SCENIC_LOADERS);
export const getScenicAssetSnapshot = scenicAssets.getSnapshot;
export const subscribeScenicAssets = scenicAssets.subscribe;
export const preloadScenicAssets = scenicAssets.preload;
export const retryScenicAsset = scenicAssets.retry;
