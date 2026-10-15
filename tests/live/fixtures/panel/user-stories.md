# User stories: Team lunch poll

## Epics
## E1 Polls

### E1-S1 Create a poll
As the organiser, I create a poll with a question, 2 to 8 options and a closing time, and I get the voters' link and my secret organiser link. (D-002, D-003, D-005)
- AC1: a poll with fewer than 2 or more than 8 options is refused with a message.
- AC2: after creating, I see both links and can copy each.

### E1-S2 Vote
As a voter, I open the link, pick one option and vote; I can change my vote while the poll is open. (D-003, D-004)
- AC1: my vote is saved and I see which option I picked.
- AC2: voting again replaces my earlier vote; I never have two votes in one poll.
- AC3: a closed poll does not take votes.

### E1-S3 Close a poll early
As the organiser, with my secret link I close the poll before its closing time. (D-005)
- AC1: after closing, the poll takes no more votes and shows the result.

### E1-S4 See the result
As anyone with the link, I see the result of a closed poll: the votes per option and the winner. (D-005)
- AC1: the results page loads quickly.
- AC2: a tie shows every option that has the most votes.
