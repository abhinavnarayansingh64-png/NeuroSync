# Technology stack verification

The NeuroSync technology-stack visual was checked against the current project dependencies and implementation boundaries.

| Area | Current implementation |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS, OGL visual layer |
| Backend | Node.js, Express, TypeScript, tRPC |
| Data and platform | MySQL/TiDB, Drizzle ORM, Manus OAuth, Stripe, S3 storage |
| Desktop and orchestration | Electron native receiver client, provider-neutral GPU boundary, clearly labelled simulated execution |

The visual and repository documentation should describe the current stack above. Real native GPU telemetry is collected by the Electron client through operating-system APIs and NVIDIA tooling when available. Browser rendering is a visual layer and is not an authoritative source for desktop GPU identity or VRAM.
