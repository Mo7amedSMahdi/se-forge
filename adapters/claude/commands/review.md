---
description: Run the separate review pass on a ticket branch - the reviewers the plan calls for (code-reviewer on sonnet, opus for security-relevant (auth, permissions, tokens, data exposure) or API-client-core changes; figma-ui-reviewer when screens change), each in its own context, each writing its report to .forge/project/reviews/<ticket>/.
argument-hint: "<ticket> <branch to review>"
---
Do a review pass (skill `review-pass`) on $ARGUMENTS.
