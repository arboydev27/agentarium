import {
  CircleHelp,
  Eye,
  Maximize,
  Minimize,
  Moon,
  Settings2,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';

export type SystemDialog = 'connections' | 'help' | 'settings';

/** Corner cluster: connection state and the small system toggles. */
export function SystemBar({
  mode,
  bridgeStatus,
  night,
  sound,
  fullscreen,
  onOpen,
  onWatch,
  onNight,
  onSound,
  onFullscreen,
}: {
  mode: 'demo' | 'live';
  bridgeStatus: 'offline' | 'connecting' | 'connected';
  night: boolean;
  sound: boolean;
  fullscreen: boolean;
  onOpen: (dialog: SystemDialog) => void;
  onWatch: () => void;
  onNight: () => void;
  onSound: () => void;
  onFullscreen: () => void;
}) {
  const connected = mode === 'live' && bridgeStatus === 'connected';
  return (
    <div className="hud-system hud-fades" role="group" aria-label="System">
      <button
        className={'hud-pill' + (connected ? ' connected' : '')}
        onClick={() => onOpen('connections')}
        title="Connection and agents"
      >
        <i className="hud-pill-dot" aria-hidden="true" />
        {mode === 'demo'
          ? 'Simulation'
          : bridgeStatus === 'connected'
            ? 'Bridge live'
            : bridgeStatus === 'connecting'
              ? 'Connecting…'
              : 'Offline'}
      </button>
      <button
        className="hud-icon"
        aria-label="Enter watch mode (W)"
        title="Watch mode (W)"
        onClick={onWatch}
      >
        <Eye size={16} aria-hidden="true" />
      </button>
      <button
        className="hud-icon phone-hidden"
        aria-label={night ? 'Switch to daylight (N)' : 'Switch to evening (N)'}
        title={night ? 'Daylight (N)' : 'Evening (N)'}
        onClick={onNight}
      >
        {night ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
      </button>
      <button
        className={'hud-icon phone-hidden' + (sound ? ' active' : '')}
        aria-label={sound ? 'Mute ambient sound' : 'Play ambient sound'}
        aria-pressed={sound}
        title="Ambient sound"
        onClick={onSound}
      >
        {sound ? (
          <Volume2 size={16} aria-hidden="true" />
        ) : (
          <VolumeX size={16} aria-hidden="true" />
        )}
      </button>
      <button
        className="hud-icon phone-hidden"
        aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        title="Fullscreen"
        onClick={onFullscreen}
      >
        {fullscreen ? (
          <Minimize size={15} aria-hidden="true" />
        ) : (
          <Maximize size={15} aria-hidden="true" />
        )}
      </button>
      <button
        className="hud-icon"
        aria-label="Help and controls (?)"
        title="Help (?)"
        onClick={() => onOpen('help')}
      >
        <CircleHelp size={16} aria-hidden="true" />
      </button>
      <button
        className="hud-icon"
        aria-label="Settings"
        title="Settings"
        onClick={() => onOpen('settings')}
      >
        <Settings2 size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
