# Interface: the game HUD

Agentarium's interface is a head-up display over a fullscreen world, not an application frame. The world fills the viewport edge to edge. Every control is an overlay anchored to a screen edge or corner, drawn on dark glass with thin edge lines. Cyan marks state (the active viewpoint, a working resident, a selected row); amber is reserved for attention. The shell lives in [App.tsx](../src/App.tsx) and `src/hud/`. The layout, shortcut, idle, and roster rules are pure functions in [hud/shell.ts](../src/hud/shell.ts), tested in `hud/shell.test.ts`.

## Layout

| Position      | Element                                                                                                                                                                                                                                                      | Source                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Top left      | Wordmark, the current place, and the task counts (working, need you, done, unknown, here). A count opens the list pane with that filter.                                                                                                                     | `WorldHUD.tsx`                                               |
| Top centre    | Attention banner, `N need you`. Present whenever a resident reports waiting or failure. It never dims, never hides, and survives watch mode. It opens the attention list.                                                                                    | `hud/AttentionBanner.tsx`                                    |
| Top right     | System cluster: connection pill (opens setup), watch mode, daylight/evening, ambient sound, fullscreen, help, settings.                                                                                                                                      | `hud/SystemBar.tsx`                                          |
| Right column  | Roster strip: portrait, name, provider glyph, and status glyph for every listed resident. Rows with attention carry an amber edge. Its header opens the list, activity, and (live) recap panes.                                                              | `hud/Roster.tsx`                                             |
| Right edge    | Slide-in pane: one resident (status, follow, task brief, session actions, simulator controls), the full list with the live filters, the activity log, or recap. Escape or the close button dismisses it. The top and bottom HUD shift left while it is open. | `hud/Drawer.tsx`, `hud/ResidentPane.tsx`, `hud/ListPane.tsx` |
| Bottom left   | Map toggle and the orbit hint.                                                                                                                                                                                                                               | `LandmarkMap.tsx`                                            |
| Bottom centre | Viewpoint hotbar: icon, short label, and the number key for the first ten.                                                                                                                                                                                   | `hud/Hotbar.tsx`                                             |
| Bottom right  | Transport: play/pause, speed, reset, and new task in the simulation; the connection readout when live; slow orbit.                                                                                                                                           | `hud/Transport.tsx`                                          |

Status glyphs and labels are factual. They come from `STATUS_LABEL` and the same rules as the world counts: `rosterGlyph` agrees with `worldCounts`. Paused or stale rows read "Last known: …" and use the unknown glyph; reported attention outranks uncertainty. Decorative animation never changes a label.

## Keyboard

| Keys         | Does                                                                       |
| ------------ | -------------------------------------------------------------------------- |
| `1`–`9`, `0` | Jump to the first ten viewpoints                                           |
| `←` `→`      | Move between viewpoints while the hotbar has focus                         |
| Arrows       | Pan the camera while the world has focus; Shift pans farther               |
| `M`          | Open or close the map                                                      |
| `R`          | Open or close the resident list                                            |
| `N`          | Switch between daylight and evening                                        |
| `W`          | Enter or leave watch mode                                                  |
| Space        | Pause or resume the simulation                                             |
| Esc          | Leave watch mode, stop following, clear the selection, then close the pane |
| `?`          | Open the help dialog, which lists this table                               |

Letters and digits are ignored while an input, select, or textarea has focus, and inside dialogs. Browser chords with Ctrl, Alt, or Cmd pass through. Inside the map, arrows move the scout target and Enter commits it.

## Motion and idle

Panes slide in from the edge, the map rises from its toggle, the attention banner pulses, and working glyphs breathe. After four seconds without pointer, wheel, touch, or key input (`HUD_IDLE_DELAY`), the non-essential overlays fade to 18% opacity; any input restores them, as does hovering or focusing a faded element. Nothing fades while a pane or dialog is open, and the attention banner never fades. `prefers-reduced-motion` and the in-app Reduced motion setting disable every transition and animation.

## Narrow screens

At 600px and below the top row holds the place chip (expands to the counts) and the system cluster (watch, help, settings; daylight, sound, and fullscreen move to Settings). The attention banner takes its own full-width row beneath them, so nothing overlaps it. The roster collapses to a chip with the resident count and an amber attention badge; the chip opens the list. The hotbar scrolls horizontally. The pane is a bottom sheet (62dvh) and hides the bottom HUD while open; opening the map closes the pane so the two never overlap.

## Typography and colour

Manrope, which the app already loads, is the display face for HUD labels: uppercase, 10px, letter-spacing 0.14em. DM Sans remains the body face in panes and dialogs. A system monospace stack renders counts, key hints, and timers. No new font is loaded. Colours are CSS custom properties at the top of [style.css](../src/style.css), drawn from the design tokens: signal cyan, ochre amber, regolith rust, sand, and habitat-shell ink over dark glass. Evening tints the glass slightly blue.

## Watch mode

The eye button or `W` reduces the HUD to the place readout, the attention banner, and a bottom caption with Stop following and Exit controls. The roster, hotbar, transport, map, and any open pane are hidden. Escape leaves watch mode first, before it does anything else.
