---
description: How faithful is this branch to its design? The figma-ui-reviewer agent (sonnet) compares it with the Figma nodes, following figma-align.
argument-hint: "<ticket> [node ids]"
---
Spawn the `figma-ui-reviewer` agent for $ARGUMENTS under the rules of the `figma-align` skill (`figma:figma-design-to-code` loaded first, a `get_screenshot` per node). Its findings go to `.forge/project/reviews/<ticket>/figma.md`.
