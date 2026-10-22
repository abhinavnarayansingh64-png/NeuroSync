# NeuroSync — Signal & Structure Design Direction

## Three stylistic approaches

### Theme Name: Signal & Structure
**Very Brief Intro:** A precise, near-black compute environment where cool cyan signals travel through measured interfaces. It makes the lifecycle of an AI training job legible rather than decorative.

**Probability:** 0.07

### Theme Name: Research Atelier
**Very Brief Intro:** A warm editorial workspace that treats model training as an annotated laboratory notebook. Paper-like surfaces and restrained orange accents make the platform feel reflective and human.

**Probability:** 0.03

### Theme Name: Broadcast Grid
**Very Brief Intro:** A high-contrast operational console inspired by live television production rooms. Sharp status language, ticker-like telemetry, and electric primary colors give every change a sense of immediacy.

**Probability:** 0.08

## Chosen approach: Signal & Structure

### Design Movement
**Technical minimalism** informed by systems diagrams, observability dashboards, and contemporary industrial-interface design.

### Core Principles
1. Make the system state clear before making it expressive.
2. Use motion to reveal causality: selection, queueing, transfer, and training progress.
3. Keep visual density calm through a limited dark foundation and carefully rationed cyan highlights.
4. Treat spatial hierarchy, timing, and typography as part of the product’s technical accuracy.

### Color Philosophy
The foundation is a warm near-black that avoids sterile pure black. Cyan represents active signal and forward motion; subdued gray is neutral infrastructure; green, amber, and red are reserved for meaningful status changes. The intent is operational confidence rather than sci-fi spectacle.

### Layout Paradigm
Use an **anchored workspace**: a stable shell and sidebar frame variable operational content, while the public landing page moves information through a left-to-right causal story. Avoid centered-card monoculture; favor diagrams, split panels, and contextual sticky summaries.

### Signature Elements
1. Pulsing signal lines and compact system diagrams.
2. Tabular telemetry numerals paired with quiet panel borders.
3. Status transitions that gently reframe the job lifecycle without obscuring data.

### Interaction Philosophy
Interactions should acknowledge input immediately and guide attention to the resulting state. Selection uses subtle press and fill feedback; panels and dialogs use short origin-aware or spatially coherent transitions; telemetry changes flow rather than flash.

### Animation
Entrances are viewport-gated and staggered at 30–80 ms. Status, metrics, charts, and logs animate only when information changes. Transitions favor opacity and transforms with a crisp custom ease-out. Continuous animation pauses offscreen and yields to `prefers-reduced-motion`.

### Typography System
Use **Inter** for accessible operational copy and **JetBrains Mono** for telemetry, labels, IDs, values, and system details. Headings are compact and high-contrast; technical labels are uppercase or restrained sentence case with increased tracking.

### Brand Essence
**NeuroSync is the fine-tuning workspace for teams that need AI training to be transparent, trackable, and reliably orchestrated.**

**Personality adjectives:** precise, composed, legible.

### Brand Voice
Headlines are direct and causal; CTAs state the resulting action; microcopy confirms system state without dramatizing it.

Examples: “Route a dataset to available compute.” and “Checkpoint verified. Training continues.”

### Wordmark & Logo
The mark is a compact neural-node circuit: a central square signal crossing four directional traces, paired with a crisp wordmark. It is treated as an active signal device, not a decorative neural illustration.

### Signature Brand Color
**Signal Cyan — #43B2F4**

## Style Decisions

- Apply the Signal & Structure system consistently across public pages, workspace pages, overlays, data visualization, and feedback states.
- Motion is semantic and interruptible, never ornamental or blocking.
- The reduced-motion mode must preserve all content, states, and accessible pathways.
- Utility, auth, and onboarding routes retain an operational grid or signal frame; none fall back to an uncontextualized generic card.
- Primary CTAs name the resulting operation or state, such as “Enter workspace” and “Route to workspace,” rather than generic SaaS invitations.
- Signal Cyan is reserved for active routes, primary actions, selected or verified states, and key telemetry; neutral content remains quiet and structural.
