import { Command, Radio, Sparkles } from 'lucide-react';
import type { Agent } from '../state';

export function ProviderIcon({ provider }: { provider: string }) {
  return (
    <span className={'provider-icon ' + provider.toLowerCase()} aria-hidden="true">
      {provider === 'Codex' ? (
        <Command size={12} />
      ) : provider === 'Claude' ? (
        <span>✳</span>
      ) : provider === 'Gemini' ? (
        <Sparkles size={12} />
      ) : (
        <Radio size={12} />
      )}
    </span>
  );
}

export function AgentAvatar({ agent, size = 'row' }: { agent: Agent; size?: 'row' | 'hero' }) {
  return (
    <span
      className={'agent-avatar ' + size}
      style={{ '--agent-color': agent.color } as React.CSSProperties}
      aria-hidden="true"
    >
      <span className="avatar-face">
        <i />
        <i />
      </span>
    </span>
  );
}
