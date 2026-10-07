# SWM interface system

These source-owned components provide the shared interaction language for Secretariat Workflow Manager. They use Tailwind utilities and existing `--swm-*` design tokens only; components must not add page-specific stylesheets.

## Composition

- `Button` and `IconButton`: every direct action, including loading and destructive states.
- `Card`: application surfaces, with optional header, content and footer regions.
- `ContextualCommandBar`: one local primary action, responsive secondary actions and a mobile-safe overflow menu.
- `FormControls`: labelled fields and consistent input, textarea and native select controls.
- `Tabs`: accessible tab lists, tabs and count indicators. Pages retain responsibility for keyboard navigation and state.
- `Alert`: inline information, success, warning and failure feedback.
- `OperationStatus`: concise save and synchronization feedback beside the affected action.
- `feedback`: the shared neutral, information, progress, success, warning and danger tone map used by alerts and toasts.
- `SectionHeader`: repeated card-section heading and action layout.
- `Skeleton`: loading placeholders used by route-level loading states.
- `Badge`: status and classification labels.

## Rules

1. Use the closest shared component before styling a raw interactive element.
2. Keep one primary action per local action group.
3. Use `text-sm` for controls and `text-xs` for supporting information.
4. Use `Button` loading states instead of rebuilding spinner-and-label logic.
5. Use `Alert` for feedback that belongs to the current surface; reserve toasts for background events.
6. Extend variants in the primitive rather than duplicating a new colour, radius or focus treatment in a page.
7. Use `OperationStatus` beside the affected action for loading, saving, synchronization and unsaved state.
8. Success confirms a completed action, warning communicates a recoverable risk, and danger is reserved for failed or blocked actions.
9. Maintain 40–44 px touch targets for primary mobile controls.
