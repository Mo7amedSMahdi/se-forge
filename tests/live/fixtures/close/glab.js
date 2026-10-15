#!/usr/bin/env node
// A stand-in glab for the start-up trial: #9 and #12 in In Testing, #24 (team-repo work, reviewed) In Progress;
// every call is logged to $FAKE_LOG.
const fs = require('fs');
const a = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(a) + '\n');
const out = (v) => process.stdout.write(typeof v === 'string' ? v + '\n' : JSON.stringify(v));
const issues = {
  9: { title: 'Login rework', labels: ['type::Feature', 'status::In Testing', 'ai::ready'] },
  12: { title: 'Poll list paging', labels: ['type::Feature', 'status::In Testing', 'ai::ready'] },
  24: { title: '[Follow-up] chore(process): the team-repo scan fails closed', labels: ['type::Task', 'status::In Progress', 'ai::ready', 'source::ai'] },
};
const view = (id) => ({ iid: id, title: issues[id].title, state: 'opened', labels: issues[id].labels, assignees: [], web_url: `https://gitlab.example.com/g/p/-/issues/${id}`, description: `Ticket ${id}.`, created_at: '2026-10-13T08:00:00Z', updated_at: '2026-10-14T08:00:00Z', author: { username: 'owner' } });
const id = Number(a[2]);
if (a[0] === 'issue' && a[1] === 'list') {
  const label = a[a.indexOf('--label') + 1];
  out(Object.keys(issues).map(Number).filter((k) => !a.includes('--label') || issues[k].labels.includes(label)).map(view));
} else if (a[0] === 'issue' && a[1] === 'view' && issues[id]) out(view(id));
else if (a[0] === 'label' && a[1] === 'list') out([{ name: 'status::In Testing' }, { name: 'status::In Progress' }]);
else if (a[0] === '--version') out('glab 1.121.0 (fake)');
else out('');
