# Project Desk

This is a standalone desktop plugin for a person's attention, acceptance, project milestones and reported issues.

- Keep the UI focused on human outcomes. Agent subtasks belong in details.
- Never infer acceptance from code completion or an idle chat. Accepted milestones and resolved issues require evidence.
- Read only the project the user selected through the host integration. Opening a chat is navigation, never permission to send a message or execute work there.
- The plugin stores private projections in its data directory; never check project data, transcripts, absolute machine paths, credentials, or generated delivery logs into Git.
- Keep the public repository generic. Samples must be fictional and complete enough to exercise empty, blocked, accepted, and error states.
- Use semantic HTML, light/dark tokens, host theme notifications, system fallback, keyboard access and reduced motion. No external fonts or UI assets at runtime.
- Run `npm run check` and `npm run check:docs` for source changes. Verify changed UI in a real browser at desktop and mobile widths, light and dark; distinguish fixture browser evidence from real host acceptance.
- Runtime code changes, release packages, installation and host acceptance are separate facts. Do not restart the desktop app without explicit user approval.
