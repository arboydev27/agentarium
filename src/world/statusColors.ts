import type { Status } from '../state';

/** One colour per session state, shared by labels, laptop screens and habitat status lamps. */
export const STATUS_COLORS: Record<Status, string> = {
  idle: '#98aaa0',
  working: '#73ad69',
  tool: '#75a6c4',
  waiting: '#e9ae54',
  completed: '#82b76a',
  failed: '#d66c65',
  disconnected: '#9f9ca7',
  unknown: '#8a9784',
};
