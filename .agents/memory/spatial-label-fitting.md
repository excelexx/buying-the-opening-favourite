---
name: Spatial label fitting
description: Readability constraints when fitting the animated timeline to narrow screens.
---

Fit screen-space labels as well as world-space meshes. Labels keep a fixed pixel size even when a perspective camera moves away, so a mesh-only fit can still clip names, prices and popups.

**Why:** Portrait timeline checks exposed clipped endpoints and overlapping marker labels despite wider camera framing.

**How to apply:** Reserve actual pixel margins for annotations, separate marker labels vertically, reduce date-label density on narrow screens, and use orthographic projection for a predictable portrait overview.
