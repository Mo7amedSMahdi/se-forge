#!/usr/bin/env node
// A stand-in glab for the release trial: #9 still open In Testing, #11 already closed by the merge into main
// (its "Closes #11" line), still labelled In Testing; every call is logged to $FAKE_LOG.
const fs = require('fs');
const a = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(a) + '\n');
const out = (v) => process.stdout.write(typeof v === 'string' ? v + '\n' : JSON.stringify(v));
const issues = {
  9: { title: 'Login rework', state: 'opened', labels: ['type::Feature', 'status::In Testing'] },
  11: { title: 'Poll list paging', state: 'closed', labels: ['type::Feature', 'status::In Testing'] },
};
const view = (id) => ({ iid: id, title: issues[id].title, state: issues[id].state, labels: issues[id].labels, assignees: [], web_url: `https://gitlab.example.com/g/p/-/issues/${id}`, description: `Ticket ${id}.`, created_at: '2026-10-13T08:00:00Z', updated_at: '2026-10-14T08:00:00Z', author: { username: 'owner' } });
const id = Number(a[2]);
if (a[0] === 'issue' && a[1] === 'list') out(Object.keys(issues).map(Number).filter((k) => a.includes('--all') || issues[k].state === 'opened').map(view));
else if (a[0] === 'issue' && a[1] === 'view' && issues[id]) out(view(id));
else if (a[0] === 'label' && a[1] === 'list') out([{ name: 'status::In Testing' }]);
else if (a[0] === '--version') out('glab 1.121.0 (fake)');
else out('');
