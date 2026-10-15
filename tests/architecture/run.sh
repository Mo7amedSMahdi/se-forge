#!/usr/bin/env bash
# Checks the architecture examples (decisions 66, 76) with `forge docs check`: every ```mermaid block in
# the sample docs and in the skills renders with mermaid-cli (C4 diagrams included), and every decision
# record has MADR 4.0.0's required parts. Needs Docker. Usage: tests/architecture/run.sh
set -uo pipefail
kit="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$kit" || exit 2
node core/cli/forge.mjs docs check tests/architecture/docs core/skills/adr-writer/examples core/skills/c4-diagrams core/skills/architecture-design
