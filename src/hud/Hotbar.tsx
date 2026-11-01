import { useEffect, useRef } from 'react';
import {
  Eye,
  FlaskConical,
  Flower2,
  Focus,
  Lamp,
  Laptop,
  MapPin,
  Mountain,
  Rocket,
  Satellite,
  Telescope,
  Tent,
  Users,
  Waves,
  Wind,
} from 'lucide-react';
import { WORLD_VIEWS, WORLD_VIEW_LABELS, type WorldView } from '../world/layout';
import { HOTBAR_LABELS, hotbarKey } from './shell';

/** One icon per viewpoint, shared with the place cards. */
export const VIEW_ICONS: Record<WorldView, typeof Focus> = {
  overview: Focus,
  café: Users,
  garden: FlaskConical,
  studio: Laptop,
  courtyard: Satellite,
  lookout: MapPin,
  orchard: Tent,
  northstar: Rocket,
  observatory: Telescope,
  hollow: Lamp,
  mere: Waves,
  dawnlight: Flower2,
  windward: Wind,
  amber: Mountain,
  horizon: Eye,
};

/**
 * Bottom hotbar of viewpoints. Number keys and clicks jump; arrows move focus inside the
 * bar; Enter on a focused slot flies there and opens its place card.
 */
export function Hotbar({
  camera,
  active,
  onChange,
  onInspect,
}: {
  camera: WorldView;
  active: boolean;
  onChange: (view: WorldView) => void;
  onInspect: (view: WorldView) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    ref.current
      ?.querySelector<HTMLButtonElement>('button.active')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [camera, active]);
  return (
    <div
      ref={ref}
      className="hud-hotbar hud-fades"
      role="group"
      tabIndex={0}
      aria-label="Viewpoints. Press 1 to 9 or 0 to jump. Use Left and Right Arrow to move between views; Enter opens a view's place card."
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          const view = (event.target as HTMLElement).closest('button')?.dataset.view;
          if (!view) return;
          event.preventDefault();
          onInspect(view as WorldView);
          return;
        }
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const buttons = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>('button'),
        );
        const current = buttons.indexOf(event.target as HTMLButtonElement);
        const next =
          current < 0
            ? event.key === 'ArrowRight'
              ? 0
              : buttons.length - 1
            : Math.max(
                0,
                Math.min(buttons.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)),
              );
        buttons[next]?.focus({ preventScroll: true });
        buttons[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }}
    >
      {WORLD_VIEWS.map((view, index) => {
        const Icon = VIEW_ICONS[view];
        const key = hotbarKey(index);
        const current = active && camera === view;
        return (
          <button
            key={view}
            data-view={view}
            className={current ? 'active' : ''}
            aria-pressed={current}
            aria-label={`${WORLD_VIEW_LABELS[view]} view${key ? `, key ${key}` : ''}`}
            aria-keyshortcuts={key ?? undefined}
            title={WORLD_VIEW_LABELS[view]}
            onClick={() => onChange(view)}
          >
            {key && <kbd aria-hidden="true">{key}</kbd>}
            <Icon size={16} aria-hidden="true" />
            <span>{HOTBAR_LABELS[view]}</span>
          </button>
        );
      })}
    </div>
  );
}
