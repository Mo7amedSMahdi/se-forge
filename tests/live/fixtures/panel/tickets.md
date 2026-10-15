# Tickets (drafts)

### T-01 Poll data model and the create and get operations
- **Story:** E1-S1, E1-S4.
- **Areas:** db, api
- **Acceptance criteria:** E1-S1 AC1; a created poll can be read back with getPoll.
- **Contract:** createPoll, getPoll.
- **Estimate:** 3-5 h.

### T-02 Vote page
- **Story:** E1-S2.
- **Areas:** ui
- **Acceptance criteria:** E1-S2 AC1, AC2, AC3.
- **Contract:** castVote, getPoll.
- **Depends on:** T-03.
- **Estimate:** 3-5 h.

### T-03 Vote operation
- **Story:** E1-S2.
- **Areas:** db, api
- **Acceptance criteria:** E1-S2 AC2, AC3.
- **Contract:** castVote.
- **Estimate:** 2-4 h.

### T-04 Create page, results page, close early
- **Story:** E1-S1, E1-S3, E1-S4.
- **Areas:** ui
- **Acceptance criteria:** E1-S1 AC2, E1-S3 AC1, E1-S4 AC1, AC2.
- **Contract:** createPoll, getPoll.
- **Estimate:** 4-7 h.
