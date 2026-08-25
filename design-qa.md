# Design QA

## Scope

- Remove the selected-DIV success toast and the floating DIV metadata panel.
- Redesign the Audit source cards as a compact, theme-aware source rail.
- Prevent the full-screen data loader from trapping the application after F5.

## Source visual truth

- `/workspace/scratch/b2cc3a4694a9/upload/c8617c5a-8282-4c4e-af4f-58919fffc8c1.png`
  - 728 × 228 px.
  - Toast that must no longer be displayed.
- `/workspace/scratch/b2cc3a4694a9/upload/8cacf090-410a-4a2b-a45e-3b25515835f9.png`
  - 604 × 260 px.
  - Floating DIV metadata panel that must no longer be displayed.
- `/workspace/scratch/b2cc3a4694a9/upload/1ce3cab8-43ef-423b-9dbd-1f36bfdc9f72.png`
  - 527 × 713 px.
  - Current Audit source rail and its file/status/date content hierarchy.
- `/workspace/scratch/b2cc3a4694a9/upload/2e04fde5-8a76-4784-88d1-95f4a847a767.png`
  - 840 × 398 px.
  - Blocking F5 loader state.

All source images were opened at original resolution. The Audit screenshot is a
problem-state reference, while the user's requested target is a denser redesign
that retains the same content and business states.

## Implementation evidence

- Intended route/state: `/audit` with MR.03, MR.07 and roster data present.
- Intended desktop viewport: 1280 × 800 CSS px, device scale factor 1.
- Browser-rendered implementation screenshot: unavailable.
- Local preview startup on port 4173 was denied by the workspace network policy
  before the server process could start.

## Browser verification

- Local preview command attempted with the required host and port.
- Preview startup was blocked before execution, so the cloud browser could not
  open the current implementation.
- F5, file-card interactions, compact DIV controls and browser console errors
  could not be verified in a rendered browser.

## Findings

- [P1] Rendered comparison is blocked.
  - Location: Audit source rail, compact DIV inspector and initial F5 state.
  - Evidence: all source screenshots are available, but no browser-rendered
    implementation capture can be produced in this workspace.
  - Impact: responsive fit, final text truncation, theme contrast and the exact
    loader-release timing cannot be visually signed off.
  - Fix: run the current branch in an environment that permits port 4173,
    capture `/audit` at 1280 × 800 with source data loaded, then repeat after F5.

## Required fidelity surfaces

- Fonts and typography: existing application font stack retained; card labels
  use a compact 0.46–0.75 rem hierarchy with single-line truncation. Rendered
  fidelity not verified.
- Spacing and layout rhythm: source rail uses 8 px card gaps, 32 px headers,
  58 px content rows and a 300 px desktop width. Rendered fidelity not verified.
- Colors and visual tokens: all card surfaces derive from `--primary`, `--card`,
  `--border` and semantic emerald status colors. Rendered contrast not verified.
- Image quality and asset fidelity: no raster assets were required; existing
  Lucide icons are retained for source type and completion status.
- Copy and content: MR.03, MR.07, roster state, file name, date range and common
  date range remain present; success toast and DIV metadata copy are removed.

## Automated checks

- Targeted ESLint: passed.
- Production build: passed.
- `git diff --check`: passed.

## Comparison history

- Pass 1: source images opened at original resolution; implementation capture
  blocked because the local preview server could not be started.

final result: blocked
