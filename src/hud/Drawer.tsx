import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export type PaneKind = 'resident' | 'list' | 'activity' | 'recap';

/** Edge pane that slides in from the right (a bottom sheet on phones). */
export function Drawer({
  kind,
  title,
  tabs,
  onTab,
  onClose,
  children,
}: {
  kind: PaneKind;
  title: string;
  tabs: { kind: PaneKind; label: string }[];
  onTab: (kind: PaneKind) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [kind]);
  return (
    <aside className={'hud-drawer ' + kind} role="region" aria-label={title}>
      <header className="hud-drawer-head">
        <h2 ref={heading} tabIndex={-1} className="hud-label">
          {title}
        </h2>
        {tabs.length > 0 && (
          <nav className="hud-drawer-tabs" aria-label="Pane">
            {tabs.map((tab) => (
              <button
                key={tab.kind}
                className={kind === tab.kind ? 'active' : ''}
                aria-pressed={kind === tab.kind}
                onClick={() => onTab(tab.kind)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}
        <button className="hud-icon" aria-label="Close pane (Esc)" title="Close" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div ref={body} className="hud-drawer-body">
        {children}
      </div>
    </aside>
  );
}
