import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Crosshair,
  Eye,
  Flower2,
  Focus,
  Lamp,
  Map,
  MapPin,
  Mountain,
  Telescope,
  Tent,
  Trees,
  Waves,
  Wind,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useWorld } from './state';
import type { WorldView } from './world/layout';
import {
  activateMap,
  detailMapBounds,
  getMapSnapshot,
  groupNearbyMapResidents,
  MAP_LANDMARKS,
  mapToWorld,
  pointInMapBounds,
  subscribeMapSnapshot,
  worldToMap,
  type MapBounds,
  type MapPoint,
} from './world/mapSnapshot';
import { CAMERA_PAN_BOUNDS } from './world/cameraPan';
import { landscapeBiomeAt } from './world/biomes';
import { SOUTHWIND_MERE } from './world/scenery/merePlacement';

type TintBiome = Exclude<ReturnType<typeof landscapeBiomeAt>, 'meadow'>;
const BIOME_LABELS = [
  { kind: 'woodland', label: 'Western Woods', point: { x: -65, z: 15 } },
  { kind: 'amber', label: 'Amber Foothills', point: { x: -80, z: 68 } },
] as const;

// Coarse world-coordinate samples give the illustrated map a biome hint.
// Live markers and scout clicks keep using the exact viewport transform.
const BIOME_TINT_PATHS = (() => {
  const columns = 20;
  const rows = 16;
  const cellWidth = (CAMERA_PAN_BOUNDS.maxX - CAMERA_PAN_BOUNDS.minX) / columns;
  const cellDepth = (CAMERA_PAN_BOUNDS.maxZ - CAMERA_PAN_BOUNDS.minZ) / rows;
  const paths: Record<TintBiome, string[]> = { woodland: [], highland: [], amber: [] };
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = CAMERA_PAN_BOUNDS.minX + column * cellWidth;
      const z = CAMERA_PAN_BOUNDS.minZ + row * cellDepth;
      const kind = landscapeBiomeAt(x + cellWidth / 2, z + cellDepth / 2);
      if (kind === 'meadow') continue;
      const origin = worldToMap({ x, z });
      const left = (origin.left * 2.8).toFixed(2);
      const top = (origin.top * 1.7).toFixed(2);
      const width = (280 / columns).toFixed(2);
      const height = (170 / rows).toFixed(2);
      paths[kind].push(`M${left} ${top}h${width}v${height}h-${width}Z`);
    }
  }
  return paths;
})();

const MERE_MAP = worldToMap({ x: SOUTHWIND_MERE.x, z: SOUTHWIND_MERE.z });
const MERE_RADIUS = SOUTHWIND_MERE.waterRadius * 1.5;

const LANDMARKS = [
  { view: 'overview', label: 'Overview', icon: Focus, detail: 'The resident grove' },
  { view: 'lookout', label: 'Lookout', icon: MapPin, detail: 'Northern clearing' },
  { view: 'orchard', label: 'Orchard', icon: Trees, detail: 'Orchard Commons' },
  {
    view: 'northstar',
    label: 'Northstar Outpost',
    icon: Tent,
    detail: 'Northern Highlands outpost',
  },
  { view: 'observatory', label: 'Observatory', icon: Telescope, detail: 'Cedar Observatory' },
  { view: 'hollow', label: 'Lantern Hollow', icon: Lamp, detail: 'Western Woods clearing' },
  { view: 'mere', label: 'Southwind Mere', icon: Waves, detail: 'Dry eastern shore' },
  { view: 'dawnlight', label: 'Dawnlight', icon: Flower2, detail: 'Dawnlight Glasshouse' },
  { view: 'windward', label: 'Windward', icon: Wind, detail: 'Windward Mill' },
  {
    view: 'amber',
    label: 'Amber Bluff',
    icon: Mountain,
    detail: 'Scenic only · no resident route',
  },
  { view: 'horizon', label: 'Horizon', icon: Eye, detail: 'Ridge and sky' },
] as const;

function LiveMapLayer({
  onFind,
  snapshot,
  viewport,
  zoomed,
}: {
  onFind: (id: string) => void;
  snapshot: ReturnType<typeof getMapSnapshot>;
  viewport: MapBounds;
  zoomed: boolean;
}) {
  const selected = useWorld((state) => state.selected);
  const [expanded, setExpanded] = useState<string | null>(null);
  const camera =
    snapshot.camera && pointInMapBounds(snapshot.camera, viewport)
      ? worldToMap(snapshot.camera, viewport)
      : null;
  const inFrame = snapshot.residents.filter((resident) => pointInMapBounds(resident, viewport));
  const groups = groupNearbyMapResidents(inFrame, viewport);
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
        const marker = worldToMap(group.point, viewport);
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
          ? zoomed
            ? `${inFrame.length} of ${snapshot.residents.length} world residents on map`
            : `${snapshot.residents.length} resident${snapshot.residents.length === 1 ? '' : 's'} in the world`
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
  onScout,
  onOpen,
  onClose,
}: {
  view: WorldView;
  following: boolean;
  customized: boolean;
  navigate: (view: WorldView) => void;
  onScout: (point: MapPoint) => void;
  onOpen?: () => void;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const snapshot = useSyncExternalStore(subscribeMapSnapshot, getMapSnapshot, getMapSnapshot);
  const [scout, setScout] = useState<MapPoint | null>(null);
  const [scoutSelected, setScoutSelected] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [detailCenter, setDetailCenter] = useState<MapPoint>({ x: 0, z: -5 });
  const viewport = zoomed ? detailMapBounds(detailCenter) : CAMERA_PAN_BOUNDS;
  const scoutInitialized = useRef(false);

  useEffect(() => {
    if (!open || !snapshot.camera || scoutInitialized.current) return;
    scoutInitialized.current = true;
    setScout(snapshot.camera);
    if (zoomed) setDetailCenter(snapshot.camera);
  }, [open, snapshot, zoomed]);

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
    setScout(null);
    setScoutSelected(false);
    scoutInitialized.current = false;
    onClose?.();
    toggle.current?.focus();
  };
  const commitScout = () => {
    if (!scout) return;
    onScout(scout);
    close();
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
            if (zoomed) setDetailCenter(snapshot.camera ?? { x: 0, z: -5 });
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
              <small>
                {zoomed ? '2× detail · live positions' : 'Travel area · live positions'}
              </small>
            </div>
            <div className="landmark-header-actions">
              <button
                className="landmark-zoom"
                aria-label={
                  zoomed ? 'Show travel area map' : 'Zoom map 2× around camera or selected point'
                }
                aria-pressed={zoomed}
                title={zoomed ? 'Show travel area map' : 'Zoom to camera or selected point'}
                onClick={() => {
                  if (!zoomed)
                    setDetailCenter(
                      scoutSelected && scout ? scout : (snapshot.camera ?? { x: 0, z: -5 }),
                    );
                  setZoomed(!zoomed);
                }}
              >
                {zoomed ? (
                  <ZoomOut size={14} aria-hidden="true" />
                ) : (
                  <ZoomIn size={14} aria-hidden="true" />
                )}
                <span>{zoomed ? 'Full' : 'Detail'}</span>
              </button>
              <button className="landmark-close" aria-label="Close landmark map" onClick={close}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </header>
          <div
            className={'landmark-map-art' + (zoomed ? ' detail' : '')}
            role="group"
            aria-label={`${zoomed ? 'Two-times detail' : 'Travel area with schematic biome regions'} locator and camera scout. North is up. Named place pins use world coordinates; resident markers show only the eight visible world seats.`}
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
              {!zoomed &&
                (['woodland', 'highland', 'amber'] as const).map((kind) => (
                  <path
                    key={kind}
                    className={`landmark-biome-tint ${kind}`}
                    d={BIOME_TINT_PATHS[kind].join('')}
                  />
                ))}
              <path
                className="landmark-contour"
                d="M-6 73C35 57 66 67 100 54s61-12 87 2 63 9 102-8M-8 94c35-13 70-17 104-7s60-2 92-14 65-7 100 4M-9 118c42-11 79-3 118-9s66-3 91-13 53-4 90 4M-5 143c45-10 74-3 107-5s61-10 94-4 58 8 92-4"
              />
              {!zoomed && (
                <ellipse
                  className="landmark-mere"
                  cx={(MERE_MAP.left / 100) * 280}
                  cy={(MERE_MAP.top / 100) * 170}
                  rx={(MERE_RADIUS / (CAMERA_PAN_BOUNDS.maxX - CAMERA_PAN_BOUNDS.minX)) * 280}
                  ry={(MERE_RADIUS / (CAMERA_PAN_BOUNDS.maxZ - CAMERA_PAN_BOUNDS.minZ)) * 170}
                />
              )}
            </svg>
            {!zoomed &&
              BIOME_LABELS.filter(
                ({ kind, point }) => landscapeBiomeAt(point.x, point.z) === kind,
              ).map(({ kind, label, point }) => {
                const position = worldToMap(point, viewport);
                return (
                  <span
                    key={kind}
                    className={`landmark-biome-label ${kind}`}
                    style={{ left: `${position.left}%`, top: `${position.top}%` }}
                  >
                    {label}
                  </span>
                );
              })}
            <span className="landmark-north" aria-hidden="true">
              N ↑
            </span>
            <button
              className="landmark-scout-surface"
              aria-label={`Choose camera location on ${zoomed ? 'detail' : 'travel area'} map. Click a location, or use arrow keys then Enter to move the camera.`}
              onClick={(event) => {
                if (event.detail === 0) return;
                const rect = event.currentTarget.getBoundingClientRect();
                setScout(
                  mapToWorld(
                    {
                      left: ((event.clientX - rect.left) / rect.width) * 100,
                      top: ((event.clientY - rect.top) / rect.height) * 100,
                    },
                    viewport,
                  ),
                );
                setScoutSelected(true);
              }}
              onKeyDown={(event) => {
                if (event.key.startsWith('Arrow')) {
                  event.preventDefault();
                  const point = scout ?? snapshot.camera ?? { x: 0, z: -5 };
                  const distance = event.shiftKey ? 8 : 3;
                  const next = {
                    x: Math.max(
                      CAMERA_PAN_BOUNDS.minX,
                      Math.min(
                        CAMERA_PAN_BOUNDS.maxX,
                        point.x +
                          (event.key === 'ArrowRight'
                            ? distance
                            : event.key === 'ArrowLeft'
                              ? -distance
                              : 0),
                      ),
                    ),
                    z: Math.max(
                      CAMERA_PAN_BOUNDS.minZ,
                      Math.min(
                        CAMERA_PAN_BOUNDS.maxZ,
                        point.z +
                          (event.key === 'ArrowDown'
                            ? distance
                            : event.key === 'ArrowUp'
                              ? -distance
                              : 0),
                      ),
                    ),
                  };
                  setScout(next);
                  if (zoomed && !pointInMapBounds(next, viewport)) setDetailCenter(next);
                  setScoutSelected(true);
                } else if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  if (scoutSelected) commitScout();
                  else {
                    const next = scout ?? snapshot.camera ?? { x: 0, z: -5 };
                    setScout(next);
                    if (zoomed && !pointInMapBounds(next, viewport)) setDetailCenter(next);
                    setScoutSelected(true);
                  }
                }
              }}
            />
            {MAP_LANDMARKS.filter((landmark) => pointInMapBounds(landmark.point, viewport)).map(
              (landmark) => {
                const position = worldToMap(landmark.point, viewport);
                return (
                  <button
                    key={landmark.id}
                    className={
                      'landmark-place-marker' +
                      (landmark.view ? ' viewpoint' : ' trail-rest') +
                      (landmark.scenicOnly ? ' scenic-only' : '')
                    }
                    style={{ left: `${position.left}%`, top: `${position.top}%` }}
                    data-label={`${landmark.label}${landmark.scenicOnly ? ' · scenic only' : ''}`}
                    data-label-position={position.top < 22 ? 'below' : 'above'}
                    data-label-align={
                      position.left < 30 ? 'start' : position.left > 70 ? 'end' : 'center'
                    }
                    aria-label={`${landmark.label}: ${landmark.scenicOnly ? 'scenic only, no resident route; ' : ''}${landmark.view ? 'open viewpoint' : 'move camera to trail rest'}`}
                    aria-pressed={
                      landmark.view
                        ? !following && !customized && view === landmark.view
                        : undefined
                    }
                    title={`${landmark.label} — ${landmark.scenicOnly ? 'scenic only, no resident route; ' : ''}${landmark.view ? 'open viewpoint' : 'move camera here'}`}
                    onClick={() => {
                      if (landmark.view) navigate(landmark.view);
                      else onScout(landmark.point);
                      close();
                    }}
                  >
                    {landmark.shortLabel}
                  </button>
                );
              },
            )}
            {scoutSelected && scout && pointInMapBounds(scout, viewport) && (
              <span
                className="landmark-scout-marker"
                style={{
                  left: `${worldToMap(scout, viewport).left}%`,
                  top: `${worldToMap(scout, viewport).top}%`,
                }}
                aria-hidden="true"
              >
                <Crosshair size={18} />
              </span>
            )}
            <LiveMapLayer
              snapshot={snapshot}
              viewport={viewport}
              zoomed={zoomed}
              onFind={(id) => {
                const world = useWorld.getState();
                world.select(id);
                world.set({ followAgent: id, cinematic: false });
                close();
              }}
            />
          </div>
          <div className="landmark-scout-actions">
            <span>Choose a camera point. Scenic terrain may not be walkable.</span>
            <button disabled={!scoutSelected} onClick={commitScout}>
              Move camera here
            </button>
          </div>
          <div className="landmark-map-legend">
            <span>
              <i className="landmark-legend-camera" /> Camera focus
            </span>
            <span>
              <i className="landmark-legend-resident" /> Visible resident
            </span>
            <span>
              <i className="landmark-legend-place" /> Named place
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
                <span className="landmark-pin-text">
                  {label}
                  {landmark === 'amber' && <small>Scenic only · no resident route</small>}
                </span>
              </button>
            ))}
          </div>
          <p>
            Detail zooms around the camera or selected point. Named pins open a viewpoint or move
            the camera to a trail rest. Scenic terrain may not be walkable. Other chats remain in
            Residents.
          </p>
        </div>
      )}
    </section>
  );
}
