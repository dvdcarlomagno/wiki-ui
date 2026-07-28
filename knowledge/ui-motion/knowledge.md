# UI motion

## Patterns in this app

- Composer ambient aura uses a client-only p5 sketch (`composer-aura.tsx`) with a 2D noise flow field.
- Aura only mounts on the empty-state centered composer (`compact === false`); chat-mode bottom composer has no aura.
- Canvas is absolutely inset so it does not change composer layout width.
- Particles spawn on the composer perimeter, drift outward with turbulence, and fade ~40–60px away.
- Query busy state replaces the "Query" label with three waving dots (CSS keyframes `query-dot-wave`).
- Both effects respect `prefers-reduced-motion: reduce`.

## Constraints

- p5 is dynamically imported so it never runs on the server.
- Aura host is `pointer-events-none` so it never blocks composer input.
- Chat layout needs reserved padding around the composer so the halo is not clipped by `overflow-hidden`.
