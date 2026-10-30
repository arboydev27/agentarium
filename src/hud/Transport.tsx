import { Orbit, Pause, Play, Plus, Radio, RotateCcw } from 'lucide-react';
import { useWorld } from '../state';

/** Small transport controls: play, speed, reset, new task in the simulation; a readout when live. */
export function Transport({
  notify,
  spawn,
}: {
  notify: (message: string) => void;
  spawn: () => void;
}) {
  const mode = useWorld((s) => s.mode);
  const playing = useWorld((s) => s.playing);
  const speed = useWorld((s) => s.speed);
  const bridgeStatus = useWorld((s) => s.bridgeStatus);
  const receivedEvents = useWorld((s) => s.receivedEvents);
  const historyEnabled = useWorld((s) => s.discoveryProviders.some((p) => p.enabled));
  const cinematic = useWorld((s) => s.cinematic);
  const set = useWorld((s) => s.set);
  return (
    <div
      className="hud-transport hud-fades"
      role="group"
      aria-label={mode === 'demo' ? 'Simulation controls' : 'Live connection'}
    >
      {mode === 'demo' ? (
        <>
          <button
            className="transport-play"
            aria-label={playing ? 'Pause simulation' : 'Play simulation'}
            title="Pause / play (Space)"
            onClick={() => set({ playing: !playing })}
          >
            {playing ? (
              <Pause size={15} fill="currentColor" aria-hidden="true" />
            ) : (
              <Play size={15} fill="currentColor" aria-hidden="true" />
            )}
          </button>
          <span className="transport-readout">
            <span className="hud-label">{playing ? 'Simulation' : 'Paused'}</span>
          </span>
          <button
            className="transport-speed"
            aria-label={`Simulation speed ${speed} times. Change speed`}
            title="Simulation speed"
            onClick={() => set({ speed: speed === 1 ? 2 : speed === 2 ? 0.5 : 1 })}
          >
            {speed}×
          </button>
          <button
            className="hud-icon"
            aria-label="Reset simulation"
            title="Reset simulation"
            onClick={() => {
              useWorld.getState().reset();
              notify('A fresh start for the colony.');
            }}
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
          <button className="transport-spawn" onClick={spawn}>
            <Plus size={14} aria-hidden="true" />
            <span>New task</span>
          </button>
        </>
      ) : (
        <span className="transport-readout live" role="status">
          <Radio size={14} aria-hidden="true" />
          <span>
            {bridgeStatus === 'connected'
              ? receivedEvents > 0
                ? `${receivedEvents} events · Listening`
                : historyEnabled
                  ? 'Watching local sessions · 5s'
                  : 'Connected · Awaiting events'
              : 'Waiting for a connection'}
          </span>
        </span>
      )}
      <span className="hud-divider" aria-hidden="true" />
      <button
        className={'transport-orbit' + (cinematic ? ' active' : '')}
        aria-pressed={cinematic}
        title="Slowly orbit the camera"
        onClick={() => set({ cinematic: !cinematic, followAgent: null })}
      >
        <Orbit size={14} aria-hidden="true" />
        <span>{cinematic ? 'Stop orbit' : 'Slow orbit'}</span>
      </button>
    </div>
  );
}
