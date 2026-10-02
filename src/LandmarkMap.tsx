import { useEffect, useRef, useState } from 'react';
import { Eye, Focus, Map, MapPin, Trees, X } from 'lucide-react';
import type { WorldView } from './world/layout';

const LANDMARKS = [
  { view: 'overview', label: 'Overview', icon: Focus, detail: 'The resident grove' },
  { view: 'lookout', label: 'Lookout', icon: MapPin, detail: 'Northern clearing' },
  { view: 'orchard', label: 'Orchard', icon: Trees, detail: 'Orchard Commons' },
  { view: 'horizon', label: 'Horizon', icon: Eye, detail: 'Ridge and sky' },
] as const;

export function LandmarkMap({
  view,
  following,
  navigate,
  onOpen,
  onClose,
}: {
  view: WorldView;
  following: boolean;
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

  const close = () => {
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
              <small>Choose a viewpoint</small>
            </div>
            <button className="landmark-close" aria-label="Close landmark map" onClick={close}>
              <X size={16} aria-hidden="true" />
            </button>
          </header>
          <div className="landmark-map-art">
            <svg viewBox="0 0 280 170" aria-hidden="true" focusable="false">
              <path
                className="landmark-ridge"
                d="M0 57 29 36 57 48 91 20 122 43 153 17 190 48 224 29 254 50 280 33V0H0Z"
              />
              <path
                className="landmark-contour"
                d="M-6 73C35 57 66 67 100 54s61-12 87 2 63 9 102-8M-8 94c35-13 70-17 104-7s60-2 92-14 65-7 100 4M-9 118c42-11 79-3 118-9s66-3 91-13 53-4 90 4M-5 143c45-10 74-3 107-5s61-10 94-4 58 8 92-4"
              />
              <path
                className="landmark-grove"
                d="M29 120c13-9 26-11 43-6l21 12 19-7 31 10 4 20-28 17-66-2-27-20Z"
              />
              <circle className="landmark-clearing" cx="206" cy="86" r="17" />
              <circle className="landmark-orchard" cx="228" cy="38" r="7" />
              <circle className="landmark-orchard" cx="243" cy="45" r="6" />
              <circle className="landmark-orchard" cx="216" cy="51" r="6" />
            </svg>
            <span className="landmark-north" aria-hidden="true">
              N ↑
            </span>
            {LANDMARKS.map(({ view: landmark, label, icon: Icon, detail }) => (
              <button
                key={landmark}
                className={`landmark-pin ${landmark}`}
                aria-label={`${label} view, ${detail}`}
                aria-pressed={!following && view === landmark}
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
          <p>Viewpoints change the camera. Residents stay at their current places.</p>
        </div>
      )}
    </section>
  );
}
