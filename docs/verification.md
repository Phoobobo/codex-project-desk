# Verification

Candidate version: **0.2.0**, verified on 2026-10-21. Automated checks ran on Node.js 24.6.0.

## Automated coverage

`npm run check` runs TypeScript checking, a self-contained build, and 19 behavior tests:

- Private project selection, catalog-only reads and cross-project isolation.
- Evidence requirements for accepted milestones and resolved issues.
- Revisions, conflicting writers, older observations, reopening and corrupt stores.
- Model-only sync tools, app-visible reads and global/chat UI entrypoint metadata.
- A bundled stdio process running without a repository or node_modules.
- Live reader update, invalid release failure, recovery and explicit rollback.
- One visible-page refresh loop, hidden pause, backoff and teardown.
- Human-focused default content, issue filters, owner links, copyable fallbacks, project-switch races, preserved detail focus and theme priority.

`npm run check:docs` checks local documentation links and formatting. The bundled skill passes the Skill Creator validator.

## Real browser with fictional data

A task-owned Microsoft Edge session loaded the local preview. Desktop viewport: **1440 × 1000**. Mobile viewport: **390 × 844**. All data is fictional Aurora Notes / Field Atlas data. The bridge records navigation and sync requests without opening real chats or sending messages.

| Check | Result |
| --- | --- |
| Default focus hides agent suggestions | Passed |
| Six outcome milestones, two accepted and one blocked | Passed |
| Direct blocker detail: cause, impact, next step, owner | Passed |
| Owner navigation emits the expected synthetic chat deep link | Passed in fixture; real host pending |
| Escape closes the modal and restores the blocker focus | Passed |
| Resolved issue filter shows the verified issue only | Passed |
| Filter keyboard focus survives re-render | Passed after correction |
| Mobile document width equals viewport width | 390px; no horizontal overflow |
| Automatic OS light/dark, host preference, manual override | Passed |
| Reduced-motion preference | Passed |
| Read failure preserves content; successful read clears error | Passed |
| Switching projects removes prior-project content | Passed |
| Page runtime errors | None observed |

Screenshots: [focus, light](images/focus-desktop-light.png), [panorama, light](images/project-desktop-light.png), [panorama, dark](images/project-desktop-dark.png), [blocker detail](images/blocker-desktop-light.png), [mobile focus](images/focus-mobile-light.png), [mobile panorama](images/project-mobile-dark.png), [mobile issues](images/issues-mobile-light.png).

The automated axe WCAG 2 A/AA checks reported **zero violations**, with contrast checks marked incomplete for nested card content. Manual token contrast review found a 4.36:1 light muted-state pair; the muted token was darkened to address it. The final reviewed small-text token pairs are at least 4.5:1. This is scoped evidence, not a claim of comprehensive accessibility certification.

Initial test-harness namespace and cross-realm error assertions were corrected. Headless reload/media waits also exposed that a hidden page correctly pauses reads and media rendering; activating the task's tab resumed them. The UI's hidden-page pause was preserved. The browser found a real filter focus loss, which was fixed and regression-tested.

## Publication checks

Source, documentation, public fixture screenshots, generated bundles and reachable Git history are checked for private project terms, machine paths, credentials and inherited repository history. The new public repository starts with fresh history. Dependency bundling preserves package-relative paths so a shared dependency install does not embed its original checkout path. Runtime output and private state are excluded.

## Remaining host acceptance

This evidence does not establish that a particular installed Codex instance has loaded version 0.2.0. Installing the new plugin, live project catalog sync, real chat evidence extraction, current-conversation request delivery and real owner-chat navigation still require acceptance in the target host. No host restart or replacement of an existing installation was performed by this verification.
