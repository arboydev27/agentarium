import { PROVIDERS } from './shared/protocol.mjs';

export type SessionPreferences = { version: 1; pinned: string[]; hidden: string[] };
export const PREFERENCES_KEY = 'agentarium.sessions.v1';
export const emptyPreferences = (): SessionPreferences => ({ version: 1, pinned: [], hidden: [] });

export function validSessionKey(key: unknown): key is string {
  if (typeof key !== 'string' || key.length > 1500) return false;
  try {
    const parts = JSON.parse(key);
    return (
      Array.isArray(parts) &&
      parts.length === 2 &&
      PROVIDERS.includes(parts[0]) &&
      typeof parts[1] === 'string' &&
      parts[1].length > 0 &&
      parts[1].length <= 200 &&
      JSON.stringify(parts) === key
    );
  } catch {
    return false;
  }
}

export function parsePreferences(raw: string | null): SessionPreferences {
  if (!raw) return emptyPreferences();
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !Array.isArray(value.pinned) || !Array.isArray(value.hidden))
    throw new Error('Unsupported session preferences');
  const hidden = [...new Set<string>(value.hidden.filter(validSessionKey))];
  const pinned = [...new Set<string>(value.pinned.filter(validSessionKey))]
    .filter((key) => !hidden.includes(key))
    .slice(0, 8);
  return { version: 1, pinned, hidden };
}

export function loadPreferences(): { preferences: SessionPreferences; error: string | null } {
  if (typeof window === 'undefined') return { preferences: emptyPreferences(), error: null };
  try {
    return {
      preferences: parsePreferences(window.localStorage.getItem(PREFERENCES_KEY)),
      error: null,
    };
  } catch {
    return {
      preferences: emptyPreferences(),
      error: 'Saved session choices could not be loaded. Changes will still work in this tab.',
    };
  }
}

export function savePreferences(preferences: SessionPreferences): string | null {
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    return null;
  } catch {
    return 'Session choices apply in this tab, but could not be saved. Browser storage may be unavailable or full.';
  }
}
