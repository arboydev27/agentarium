import { Component, Suspense, lazy, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { scenicAssets } from './scenicAssets';
import type { ScenicRegionId } from './scenicVisibility';
import { ScenicFallback } from './scenery/ScenicFallback';

class ScenicErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onError: (error: unknown) => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Each optional landmark owns its suspense and error lifetime. */
export function ScenicAsset({ id }: { id: ScenicRegionId }) {
  const snapshot = useSyncExternalStore(
    scenicAssets.subscribe,
    () => scenicAssets.getSnapshot()[id],
    () => scenicAssets.getSnapshot()[id],
  );
  // Retry changes the generation, replacing React.lazy's cached rejection.
  // Quality remounts keep the module promise/component in the region cache.
  // Keep this element type for the entire attempt: switching from a committed
  // lazy element to its direct component could remount owned scene resources.
  const Asset = useMemo(
    () =>
      snapshot.component ??
      lazy(() => scenicAssets.load(id).then((component) => ({ default: component }))),
    [id, snapshot.attempt],
  );
  const retry = () => {
    void scenicAssets.retry(id).catch(() => {});
  };
  const failed = <ScenicFallback id={id} state="failed" onRetry={retry} />;
  if (snapshot.status === 'failed') return failed;
  return (
    <ScenicErrorBoundary
      key={`${id}:${snapshot.attempt}`}
      fallback={failed}
      onError={(error) => scenicAssets.reportFailure(id, error, snapshot.attempt)}
    >
      <Suspense fallback={<ScenicFallback id={id} state="loading" />}>
        <Asset />
      </Suspense>
    </ScenicErrorBoundary>
  );
}
