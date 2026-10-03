import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Eye, Focus, Map, MapPin, Telescope, Trees, X } from 'lucide-react';
import { useWorld } from './state';
import type { WorldView } from './world/layout';
import {
  activateMap,
  getMapSnapshot,
  groupNearbyMapResidents,
  subscribeMapSnapshot,
  worldToMap,
} from './world/mapSnapshot';

const LANDMARKS = [
  { view: 'overview', label: 'Overview', icon: Focus, detail: 'The resident grove' },
  { view: 'lookout', label: 'Lookout', icon: MapPin, detail: 'Northern clearing' },
  { view: 'orchard', label: 'Orchard', icon: Trees, detail: 'Orchard Commons' },
  { view: 'observatory', label: 'Observatory', icon: Telescope, detail: 'Cedar Observatory' },
  { view: 'horizon', label: 'Horizon', icon: Eye, detail: 'Ridge and sky' },
] as const;

function LiveMapLayer({ onFind }: { onFind: (id: string) => void }) {
  const snapshot = useSyncExternalStore(subscribeMapSnapshot, getMapSnapshot, getMapSnapshot);
  const selected = useWorld((state) => state.selected);
  const [expanded, setExpanded] = useState<string | null>(null);
  const camera = snapshot.camera ? worldToMap(snapshot.camera) : null;
  const groups = groupNearbyMapResidents(snapshot.residents);
  const expandedGroup = groups.find((group) => group.key === expanded);
  return (
    <>
      {camera && (
        <span
          className="landmark-camera-marker"
          style={{ left: `${camera.left}%`, top: `${camera.top}%` }}
          title="Current camera focus"
          aria-label="Current camera focus"
        >
          <Focus size={13} aria-hidden="true" />
        </span>
      )}
      {groups.map((group) => {
        const marker = worldToMap(group.point);
        const alone = group.residents.length === 1;
        const isSelected = group.residents.some((resident) => resident.id === selected);
        return (
          <button
            key={group.key}
            className={'landmark-resident-marker' + (isSelected ? ' selected' : '')}
            style={{ left: `${marker.left}%`, top: `${marker.top}%` }}
            aria-label={
              alone
                ? `Find and follow resident ${group.residents[0].name}, seat ${group.residents[0].seat + 1}`
                : `${group.residents.length} nearby visible residents. Show names`
            }
            aria-pressed={alone ? isSelected : undefined}
            aria-expanded={alone ? undefined : expanded === group.key}
            aria-controls={alone ? undefined : `landmark-residents-${group.key}`}
            title={
              alone ? `${group.residents[0].name} — select and follow` : 'Show nearby residents'
            }
            onClick={() =>
              alone
                ? onFind(group.residents[0].id)
                : setExpanded(expanded === group.key ? null : group.key)
            }
          >
            {alone ? group.residents[0].seat + 1 : group.residents.length}
          </button>
        );
      })}
      {expandedGroup && expandedGroup.residents.length > 1 && (
        <div
          id={`landmark-residents-${expandedGroup.key}`}
          className="landmark-resident-picker"
          aria-label="Nearby visible residents"
        >
          {expandedGroup.residents.map((resident) => (
            <button
              key={resident.id}
              className={selected === resident.id ? 'selected' : ''}
              onClick={() => onFind(resident.id)}
            >
              <span>{resident.seat + 1}</span>
              {resident.name}
            </button>
          ))}
        </div>
      )}
      <span className="landmark-map-count">
        {snapshot.camera
          ? `${snapshot.residents.length} resident${snapshot.residents.length === 1 ? '' : 's'} in the world`
          : 'Locating residents…'}
      </span>
    </>
  );
}

export function LandmarkMap({
  view,
  following,
  customized,
  navigate,
  onOpen,
  onClose,
}: {
  view: WorldView;
  following: boolean;
  customized: boolean;
  navigate: (view: WorldView) => void;
  onOpen?: () => void;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open, onClose]);

  useEffect(() => {
    activateMap(open);
    return () => activateMap(false);
  }, [open]);

  const close = () => {
    activateMap(false);
    setOpen(false);
    onClose?.();
    toggle.current?.focus();
  };

  return (
    <section
      ref={container}
      className={'landmark-navigation' + (open ? ' open' : '')}
      aria-label="Landmark navigation"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={toggle}
        className={'landmark-toggle' + (open ? ' active' : '')}
        aria-expanded={open}
        aria-controls="landmark-map"
        onClick={() => {
          if (open) close();
          else {
            onOpen?.();
            activateMap(true);
            setOpen(true);
          }
        }}
        title="Open landmark map"
      >
        <Map size={17} aria-hidden="true" />
        <span>Map</span>
      </button>
      {open && (
        <div id="landmark-map" className="landmark-map" role="region" aria-label="Landmark map">
          <header>
            <div>
              <strong>Explore the world</strong>
              <small>Live positions · illustrated terrain</small>
            </div>
            <button className="landmark-close" aria-label="Close landmark map" onClick={close}>
              <X size={16} aria-hidden="true" />
            </button>
          </header>
          <div
            className="landmark-map-art"
            role="group"
            aria-label="Live position locator. North is up. Markers show only residents occupying the eight visible world seats; illustrated terrain is decorative."
          >
            <svg
              viewBox="0 0 280 170"
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              <path
                className="landmark-ridge"
                d="M0 57 29 36 57 48 91 20 122 43 153 17 190 48 224 29 254 50 280 33V0H0Z"
              />
              <path
                className="landmark-contour"
                d="M-6 73C35 57 66 67 100 54s61-12 87 2 63 9 102-8M-8 94c35-13 70-17 104-7s60-2 92-14 65-7 100 4M-9 118c42-11 79-3 118-9s66-3 91-13 53-4 90 4M-5 143c45-10 74-3 107-5s61-10 94-4 58 8 92-4"
              />
            </svg>
            <span className="landmark-north" aria-hidden="true">
              N ↑
            </span>
            <LiveMapLayer
              onFind={(id) => {
                const world = useWorld.getState();
                world.select(id);
                world.set({ followAgent: id, cinematic: false });
                close();
              }}
            />
          </div>
          <div className="landmark-map-legend">
            <span>
              <i className="landmark-legend-camera" /> Camera focus
            </span>
            <span>
              <i className="landmark-legend-resident" /> Visible resident
            </span>
          </div>
          <div className="landmark-shortcut-label">Viewpoints</div>
          <div className="landmark-viewpoints" role="group" aria-label="Viewpoint shortcuts">
            {LANDMARKS.map(({ view: landmark, label, icon: Icon, detail }) => (
              <button
                key={landmark}
                className={`landmark-pin ${landmark}`}
                aria-label={`${label} view, ${detail}`}
                aria-pressed={!following && !customized && view === landmark}
                title={detail}
                onClick={() => {
                  navigate(landmark);
                  close();
                }}
              >
                <span className="landmark-pin-icon">
                  <Icon size={13} aria-hidden="true" />
                </span>
                <span>{label}</span>
              </button>
            ))}
          </div>
          <p>Viewpoints move the camera. Other chats remain in Residents.</p>
        </div>
      )}
    </section>
  );
}
