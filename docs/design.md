# Design rationale

The primary user needs to see what requires their acceptance, what they reported, where the project is blocked and what has genuinely been achieved. Agent implementation subtasks are not useful default-screen content.

| Form | Strength | Limitation | Decision |
| --- | --- | --- | --- |
| Water level / percentage | Compact aggregate progress | Hides where progress stops; suggests false precision | Avoid as the main visualization |
| Calendar timeline | Shows dates and overlapping work | Depends on reliable scheduling data | Keep outside this version |
| Milestone route | Shows outcomes, completed points and local blockers | Needs concise, outcome-based milestones | Main project view |

This is a product-specific design choice, not a claim that one visual style is universally most advanced. Milestone order is presentation order, not an inferred dependency graph.

[Linear's milestone documentation](https://linear.app/docs/project-milestones) describes milestones as distinct parts of a project's lifecycle; [its timeline documentation](https://linear.app/docs/timeline) focuses on temporal project planning. The route borrows the former's outcome focus without inventing schedules. [Nielsen Norman Group's progressive disclosure guidance](https://www.nngroup.com/articles/progressive-disclosure/) supports keeping the primary view simple and revealing detail when requested.

## Information hierarchy

The default page presents up to four waiting acceptance/decision cards, with additional items behind an explicit expansion. The first card carries strong contrast. The adjacent panel contains only the user's unresolved issues. A compact achievement strip shows accepted milestones, with a path to the panorama.

The panorama marks accepted, active, blocked, review-ready, planned and unknown states with both words and symbols. A blocker can be opened directly to see cause, impact, next step and the responsible chat. The issue view defaults to user reports and exposes clear lifecycle filters; resolved means there is verification evidence.

## Themes and interaction

The palette uses forest green for progress and amber for attention, with semantic light/dark tokens. Automatic theme follows host context first, then the operating system; an explicit choice overrides both for the current view. Motion is limited to brief hover feedback and disabled under reduced-motion preferences.

At narrow widths, the milestone route becomes vertical and cards use one column. Native controls and a modal dialog provide keyboard behavior, visible focus and Escape dismissal. No external font or runtime asset service is required. Unchanged reads preserve expanded details and focus. Read time is distinct from the evidence sync time.
