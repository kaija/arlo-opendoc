# Design source

Imported from the Claude Design project **UI Mockups with Arlo Design System**
(`9c39e159-5b66-4e15-8832-57c99956d568`), which is where the canvas is edited. These files
are the record of what was implemented, not a build input — nothing in `apps/desktop`
imports them.

| File | What it is |
| --- | --- |
| `Arlo Mockups.dc.html` | The eight artboards. The authoritative visual spec. |
| `Arlo Sidebar.dc.html` | Sidebar component, in-draft variant (with `(M)` / `(N)` markers). |
| `Arlo Sidebar Live.dc.html` | Sidebar component, Live variant (no draft, so no markers). |
| `_ds/arlo-ds/` | The Arlo AI design system's tokens and base stylesheet. |

The `.dc.html` files will not render standalone: they depend on the canvas runtime
(`support.js`, `x-dc`, `x-import`) and on `_ds_bundle.js`, none of which are vendored here.
Read them as source. The only thing the implementation needed out of the compiled bundle was
the icon path data, which is ported into
[`Icon.tsx`](../apps/desktop/src/components/Icon.tsx).

The design system's token files are vendored twice on purpose: verbatim here as the imported
record, and under
[`apps/desktop/src/styles/ds/`](../apps/desktop/src/styles/ds/) as the subset the app
actually compiles. The two are byte-identical; if the design system moves, update both.

The written brief the canvas was generated from is
[`docs/ui-mockup-prompt.md`](../docs/ui-mockup-prompt.md). Where the brief and the canvas
disagree, the canvas won — see "Where the implementation departs from the mockup" in
[`apps/desktop/README.md`](../apps/desktop/README.md).
