#!/usr/bin/env node
// A stand-in glab for the follow-ups trial: ticket #9 (a feature) and #11 (itself a follow-up), both in
// review; every call is logged to $FAKE_LOG, and an issue create answers with a new issue's URL.
const fs = require('fs');
const a = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(a) + '\n');
const out = (v) => process.stdout.write(typeof v === 'string' ? v + '\n' : JSON.stringify(v));
const issues = {
  9: { title: 'Login rework', labels: ['type::Feature', 'status::In Progress'] },
  11: { title: '[Follow-up] chore(infra): the status check also refuses blank lines', labels: ['type::Task', 'status::In Progress', 'source::ai'] },
};
const view = (id) => ({ iid: id, title: issues[id].title, state: 'opened', labels: issues[id].labels, assignees: [], web_url: `https://gitlab.example.com/g/p/-/issues/${id}`, description: `Ticket ${id}.`, created_at: '2026-10-13T08:00:00Z', updated_at: '2026-10-14T08:00:00Z', author: { username: 'owner' } });
const id = Number(a[2]);
if (a[0] === 'issue' && a[1] === 'list') out(Object.keys(issues).map((k) => view(Number(k))));
else if (a[0] === 'issue' && a[1] === 'view' && issues[id]) out(view(id));
else if (a[0] === 'issue' && a[1] === 'create') out(`https://gitlab.example.com/g/p/-/issues/${100 + fs.readFileSync(process.env.FAKE_LOG, 'utf8').split('\n').filter((l) => l.startsWith('["issue","create"')).length}`);
else if (a[0] === 'label' && a[1] === 'list') out([]);
else if (a[0] === '--version') out('glab 1.121.0 (fake)');
else out('');
