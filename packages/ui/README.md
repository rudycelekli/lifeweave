# LifeWeave UI

Render validated SurfaceFrames into a native DOM element or `<lifeweave-surface>`. Five typed block shapes cover text, measurements, checklists, timelines and trends. A host can customize renderers for those known types. Data and model output cannot register code. All text uses `textContent`; no generated HTML, scripts or arbitrary fetch instructions are supported.

Import `renderSurface` and `@lifeweave/ui/styles.css`, or call `defineLifeweaveElement()` and assign the element's `.frame`. Host-owned `onAction` callbacks receive copied payloads. External action buttons are disabled in the default renderer because no executor is configured. Local proposal review remains available.

The optional `@lifeweave/ui/react` adapter exports `LifeweaveSurface({frame,onAction})` and requires React 18+. It reuses the same renderer. Native DOM rendering is browser tested; React package acceptance is a separate verification receipt.
