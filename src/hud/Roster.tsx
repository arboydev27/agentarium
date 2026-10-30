import {
  Activity,
  AlertCircle,
  Check,
  CircleHelp,
  Coffee,
  History,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import type { Agent } from '../state';
import { rosterGlyph, rosterStatusLabel, type RosterGlyph } from './shell';
import { AgentAvatar, ProviderIcon } from './avatars';

const GLYPH_ICON: Record<RosterGlyph, typeof Activity> = {
  attention: AlertCircle,
  working: Activity,
  completed: Check,
  idle: Coffee,
  unknown: CircleHelp,
};

export function StatusGlyph({ glyph, label }: { glyph: RosterGlyph; label: string }) {
  const Icon = GLYPH_ICON[glyph];
  return (
    <span className={'status-glyph ' + glyph} title={label}>
      <Icon size={12} aria-hidden="true" />
    </span>
  );
}

export type RosterPane = 'list' | 'activity' | 'recap';

/** Compact party-style strip: portrait, name, provider, status glyph. Selecting opens the pane. */
export function Roster({
  agents,
  selected,
  paused,
  live,
  attention,
  onSelect,
  onOpen,
}: {
  agents: Agent[];
  selected: string | null;
  paused: boolean;
  live: boolean;
  attention: number;
  onSelect: (id: string) => void;
  onOpen: (pane: RosterPane) => void;
}) {
  return (
    <section className="hud-roster hud-fades" aria-label="Residents">
      <div className="hud-roster-head">
        <span className="hud-label">Residents</span>
        <span className="hud-count">{agents.length}</span>
        <span className="hud-roster-tools">
          <button
            className="hud-icon"
            aria-label="Resident list and filters (R)"
            title="Residents and filters (R)"
            onClick={() => onOpen('list')}
          >
            <SlidersHorizontal size={14} aria-hidden="true" />
          </button>
          <button
            className="hud-icon"
            aria-label="Activity log"
            title="Activity log"
            onClick={() => onOpen('activity')}
          >
            <Activity size={14} aria-hidden="true" />
          </button>
          {live && (
            <button
              className="hud-icon"
              aria-label="Recap since you were away"
              title="Recap"
              onClick={() => onOpen('recap')}
            >
              <History size={14} aria-hidden="true" />
            </button>
          )}
        </span>
      </div>
      {agents.length === 0 ? (
        <p className="hud-roster-empty">{live ? 'No residents in this view.' : 'No residents.'}</p>
      ) : (
        <ol className="hud-roster-list">
          {agents.map((agent) => {
            const glyph = rosterGlyph(agent, paused);
            const label = rosterStatusLabel(agent, paused);
            const active = selected === agent.id;
            return (
              <li key={agent.id}>
                <button
                  className={'roster-row ' + glyph + (active ? ' selected' : '')}
                  aria-pressed={active}
                  aria-label={`${agent.name}, ${agent.provider}, ${label}`}
                  title={`${agent.name} · ${label}`}
                  onClick={() => onSelect(agent.id)}
                >
                  <AgentAvatar agent={agent} />
                  <span className="roster-name">
                    <strong>{agent.name}</strong>
                    <ProviderIcon provider={agent.provider} />
                  </span>
                  <StatusGlyph glyph={glyph} label={label} />
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <button
        className="hud-roster-chip"
        aria-label={`${agents.length} residents${attention ? `, ${attention} need attention` : ''}. Open resident list.`}
        onClick={() => onOpen('list')}
      >
        <Users size={14} aria-hidden="true" />
        <span>{agents.length}</span>
        {attention > 0 && (
          <b className="chip-attention" aria-hidden="true">
            {attention}
          </b>
        )}
      </button>
    </section>
  );
}
