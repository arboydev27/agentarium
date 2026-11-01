import { useSyncExternalStore } from 'react';
import { MapPin, Navigation, Rocket, Satellite, Telescope } from 'lucide-react';
import { useWorld } from '../state';
import {
  getPlaceResidents,
  PLACE_KIND_LABELS,
  placeById,
  subscribePlaceResidents,
  type Place,
  type PlaceResident,
} from '../world/places';
import { AgentAvatar } from './avatars';
import { VIEW_ICONS } from './Hotbar';
import { rosterGlyph, rosterStatusLabel } from './shell';
import { StatusGlyph } from './Roster';

const MACHINE_ICONS: Record<string, typeof MapPin> = {
  'northstar:rocket': Rocket,
  'courtyard:dish': Satellite,
  'observatory:telescope': Telescope,
};

/** Detail pane for one place: what it is, who is there, what residents do there, and a way to go. */
export function PlacePane({
  place,
  cameraHere,
  onFly,
  onResident,
}: {
  place: Place;
  cameraHere: boolean;
  onFly: () => void;
  onResident: (id: string) => void;
}) {
  const agents = useWorld((s) => s.agents);
  const paused = useWorld((s) => s.mode === 'live' && s.bridgeStatus !== 'connected');
  const residents = useSyncExternalStore(subscribePlaceResidents, getPlaceResidents);
  const here = residents.filter((resident) => resident.here);
  const away = residents.filter((resident) => resident.based && !resident.here);
  const parent = placeById(place.parent);
  const Icon = MACHINE_ICONS[place.id] ?? (place.view ? VIEW_ICONS[place.view] : MapPin) ?? MapPin;
  const row = (resident: PlaceResident) => {
    const agent = agents.find((a) => a.id === resident.id);
    if (!agent) return null;
    const glyph = rosterGlyph(agent, paused);
    const label = rosterStatusLabel(agent, paused);
    return (
      <li key={resident.id}>
        <button
          className={'resident-row ' + glyph}
          title={`${agent.name} — ${resident.activity} (visual activity)`}
          onClick={() => onResident(resident.id)}
        >
          <AgentAvatar agent={agent} />
          <span className="resident-name">
            <strong>{agent.name}</strong>
            <span>{resident.activity}</span>
          </span>
          <span className={'status-tag ' + glyph}>
            <StatusGlyph glyph={glyph} label={label} />
            {label}
          </span>
        </button>
      </li>
    );
  };
  return (
    <div className="place-pane">
      <div className="place-hero">
        <span className="place-icon" aria-hidden="true">
          <Icon size={20} />
        </span>
        <div className="resident-hero-text">
          <h3>{place.name}</h3>
          <span className="resident-provider">
            {PLACE_KIND_LABELS[place.kind]}
            {parent ? ` · ${parent.name}` : ''}
          </span>
        </div>
      </div>
      <p className="place-role">{place.role}</p>
      <button className="follow-button" aria-pressed={cameraHere} onClick={onFly}>
        <Navigation size={14} aria-hidden="true" />
        {cameraHere ? 'Camera is here' : 'Fly here'}
      </button>
      {place.kind !== 'machine' && (
        <section className="place-section" aria-label="Here now">
          <h4>Here now</h4>
          {here.length === 0 ? (
            <p className="muted">
              {place.kind === 'scenic'
                ? 'No resident route leads here.'
                : 'Nobody is here right now.'}
            </p>
          ) : (
            <ol className="resident-list">{here.map(row)}</ol>
          )}
        </section>
      )}
      {away.length > 0 && (
        <section className="place-section" aria-label="Based here, away">
          <h4>Based here, away</h4>
          <ol className="resident-list">{away.map(row)}</ol>
        </section>
      )}
      <section className="place-section" aria-label="What happens here">
        <h4>What happens here</h4>
        <p>{place.does}</p>
        {place.spots.length > 0 && <p className="muted">Rest spots: {place.spots.join(', ')}.</p>}
      </section>
      {place.kind !== 'machine' && (
        <p className="parent-note">
          Who is here follows the characters’ visual activity, not a report from the agents.
        </p>
      )}
    </div>
  );
}
