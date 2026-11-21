---
name: Spatial label fitting
description: Readability constraints when fitting the animated timeline to narrow screens.
---

Fit screen-space labels as well as world-space meshes. Labels keep a fixed pixel size even when a perspective camera moves away, so a mesh-only fit can still clip names, prices and popups.

**Why:** Portrait timeline checks exposed clipped endpoints and overlapping marker labels despite wider camera framing.

**How to apply:** Reserve actual pixel margins for annotations, separate marker labels vertically, reduce date-label density on narrow screens, and use orthographic projection for a predictable portrait overview.

Initialize a newly active camera at the selected chapter before easing subsequent movement.

**Why:** Deep-linked chapters can sit far from the world origin. Easing the initial look target from the origin temporarily shifts the entire timeline offscreen, making otherwise correct framing appear clipped.

**How to apply:** Snap position and look target on initial camera activation, including projection changes; retain smoothing for later movement.
