---
name: figma-align
description: The rules for working from the project's Figma file (its file and root node are in the project facts) - which Figma skill to load first, which MCP calls to make and in what order, how exactly the build must match a frame, and what to do when a screen or state has no frame. Use before any Figma MCP call, and whenever you decide whether a piece of UI may be built.
---

# Working from Figma

The Figma file decides how the UI looks: where a frame exists, the build matches it exactly. Where none exists, the piece is still built, in the look the app already has, in the place and for the role it belongs to (below).

## Calls, cheapest first
1. Before the first Figma MCP call, load the skill `figma:figma-design-to-code`; `get_design_context` never runs without it. An agent that writes to Figma (the `designer`) loads `figma:figma-use` instead.
2. Look before you fetch: `get_screenshot(node)` first, then `get_metadata` on a narrow node, and `get_design_context` last, for the one frame you are building. Never for a whole page or section.
3. Note each node id you used in the plan. A URL writes it `12-345`; the API wants `12:345`.

## Which frame
- In a bootstrapped project, `.forge/project/bootstrap/design-map.md` maps stories to node ids: start there.
- Nodes the ticket names come next. Without either, take `get_metadata` one level below the root node and match a frame's name to the ticket's screen.
- When the file draws states as separate frames (default, empty, loading, error, success, disabled), take a screenshot of each.

## What must match
- Every measure and colour the frame shows (layout, spacing, corner radii, type, colour) comes from the project's theme tokens; a hex value or pixel size is allowed only where no token exists.
- Text exactly as the frame has it, in every locale bundle the project ships. A locale with no frame of its own gets a faithful translation, and the plan says so.
- In an app that supports right-to-left, layout uses logical (start/end) properties.
- Dates and numbers are never mirrored.
- Icons come from the project's icon set, as the frame shows them.

## A screen or state with no frame
The owner's rule: a missing design is never a reason to skip or wait. Build it
- **in the app's existing look**: the UI primitives, tokens, spacing, type, icons, dialogs, tables and states of the closest designed screen;
- **in its place**: the feature folder and route of the role that uses it, with routes declared where the project declares them;
- **for its role**: behind the authorization layer and the route guard, and never visible to a role the stories do not give it.

To do that, find the closest designed screen for the same role (`get_metadata` one level, `get_screenshot`) and the component that builds it, and reuse its components and tokens: no new colours, fonts or one-off styles. The story says which role does it; when it does not, that is a plan question, with the most restrictive role that needs it as the default. Then add the piece to the plan's "Built without a design" list (the element, the designed screen it copies, the role) so the designer can draw it later; the list informs, it does not block. Only product questions wait for the owner (what it does, who may do it, which data), never a missing picture. In a bootstrapped project the lead may also hand the gap to the `designer` agent; the build goes on meanwhile.

## The frame and the story disagree
Build what both agree on. The disagreement becomes a plan question and an Issues-board Task through the `tracker` skill: title `[Story conflict] …`, `--source ai`, status Todo, Pending column, nobody assigned.

## Done when
- every UI element of the ticket is mapped to a Figma node, or listed under "Built without a design" with the nearest designed screen and the role;
- copy is in every locale bundle, and only design tokens are used;
- frame-versus-story conflicts are plan questions with a tracker Task.
