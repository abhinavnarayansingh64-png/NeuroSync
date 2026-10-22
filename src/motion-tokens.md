# NeuroSync Motion Token Table (Signal & Structure)

| Token | Value | Usage |
|---|---|---|
| motion-fast | 120–160 ms | Press, icon response, focus ring, small value acknowledgment |
| motion-ui | 180–240 ms | Hover, dropdown, tooltip, selection, inline status |
| motion-structural | 260–420 ms | Drawer, modal, accordion, route content, grouped reveal |
| motion-explanatory | 600–1200 ms | Hero choreography, diagram signal, chart draw-in |
| ease-out | cubic-bezier(0.23, 1, 0.32, 1) | Entering and settling |
| ease-in-out | cubic-bezier(0.77, 0, 0.175, 1) | Branching, morphing, diagram travel |
| stagger | 32–72 ms | Small noncritical groups only |
| hover-lift | 2–4 px | Clickable cards where elevation communicates affordance |
| press-scale | 0.97 | Buttons and selectable controls on active press |

Rules: transform + opacity only; never animate from scale(0) — start near 0.96 with small offset; interruptible and reversible; prefers-reduced-motion variants everywhere; no animation gate on navigation/validation/monitoring; animation state never persisted to localStorage.
