---
description: Show the tracker board (To Do first) and propose the next unblocked ticket, with the mode to run it in (/ticket, or /pipeline for a large feature).
---
Look at the board with `forge tracker list board | head -60` (or have `tracker-clerk`, haiku, do it), leave out tickets that have a plan in `.forge/project/plans/` already, and propose the top candidates, each in one line with the reason and the way to run it: `/ticket <id>` (the default) or `/pipeline <id>` for a large feature that needs parallel lanes. Ask with AskUserQuestion (skill `ask-owner`): the top candidate first, one or two others, each with its way to run it. Do not start work until the owner picks, unless the pipeline is already running unattended.
