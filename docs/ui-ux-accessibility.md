# UI, UX, and accessibility

- Preserve the forest, jade, brass, paper, card, ink, line, muted, and danger tokens in `app/globals.css`; follow `DESIGN.md` rather than creating a separate admin theme.
- Start layouts at 375px and progressively enhance at 768px, 1024px, and 1440px. Avoid horizontal scrolling and preserve readable line lengths.
- Interactive targets must be at least 44×44 CSS pixels. Text and meaningful controls must meet WCAG AA contrast (4.5:1 for normal text).
- Every control needs a visible label or accessible name, visible `:focus-visible` treatment, keyboard operation, and a logical focus order.
- Use semantic headings in order. Do not communicate status by color alone; pair color with text or an icon and announce asynchronous results with `role="status"`, `role="alert"`, or `aria-live`.
- Use the shared native-dialog modal. It must trap focus, support Escape when dismissal is safe, receive sensible initial focus, and restore focus to its trigger.
- Honor `prefers-reduced-motion`. Motion must not be necessary to understand state.
- Every data view needs deliberate loading, empty, success, and error states. Disable duplicate submissions while a request is pending.
- Destructive actions require a separate confirmation and plain-language consequences.
- Verify keyboard-only use, screen-reader names, focus restoration, contrast, and the four target viewport widths before release.
