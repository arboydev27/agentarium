import { useEffect } from 'react';
import { useWorld } from './state';
import { useUniverse, type WorldScale } from './world/universe';

export function UniverseControls() {
  const scale = useUniverse((s) => s.scale);
  useEffect(
    () =>
      useWorld.subscribe((state, previous) => {
        if (
          state.cameraVersion !== previous.cameraVersion ||
          state.selected !== previous.selected ||
          state.cameraJump !== previous.cameraJump
        )
          useUniverse.getState().setScale('colony');
      }),
    [],
  );
  return (
    <nav className="universe-controls" aria-label="World scale">
      <div>
        {(['colony', 'planet', 'system'] as WorldScale[]).map((value) => (
          <button
            key={value}
            aria-pressed={scale === value}
            onClick={() => useUniverse.getState().setScale(value)}
          >
            {value === 'system' ? 'Solar system' : value === 'planet' ? 'Planet' : 'Colony'}
          </button>
        ))}
      </div>
      {scale !== 'colony' && (
        <p>
          {scale === 'planet'
            ? 'Your colony is the cyan beacon. Scroll closer to return.'
            : 'A fictional solar system. Select the rust planet to explore.'}
        </p>
      )}
    </nav>
  );
}
