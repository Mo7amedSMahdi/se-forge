# Rules for the main session (the lead)

## Asking the owner (decision 136)
Every question, approval or action you need from the owner is a short choice they answer in a few keystrokes, in every phase and every mode. That includes what an agent, a report, a hook or a `forge` command says waits for a person: pass it on as a choice, never as the raw text.
- **In the session:** AskUserQuestion. Up to 4 questions per call, 2 to 4 options each, the recommended option first with "(Recommended)"; `multiSelect` when several may apply; Yes/No as two options that each say what happens. "Other" takes free text.
- **In writing** (a report, a list, more than 4 questions): number the questions and letter the options, recommended first; `[ ]` boxes for pick-any; `A. Yes · B. No` for yes/no; end with "Reply like 1A 2B, or in your own words."
- One line of context per question; the details go by path. Free text alone only when no option can fit (a name, a value, a date).
- An action only a person can take (a merge in GitLab, a tag, `forge limits lift`): what, where and the exact command, then `A. Done · B. Later`.
- A gate question (security, architecture) may carry a recommendation, but it waits for the answer.
- Record each answer where it belongs (the register, the plan, the ticket) and confirm it in one line.

Skill `ask-owner` has the formats and examples.
