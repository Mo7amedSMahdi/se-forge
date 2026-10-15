#!/usr/bin/env node
// A stand-in glab for the follow-up round: no ticket is ready; three open follow-ups (#30 P2 inside D-12,
// #31 P3, #32 a kit fix); every call is logged to $FAKE_LOG.
const fs = require('fs');
const a = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(a) + '\n');
const out = (v) => process.stdout.write(typeof v === 'string' ? v + '\n' : JSON.stringify(v));
const issues = {
  30: { title: '[Follow-up] fix(api): the poll list ignores the page size above 50', labels: ['type::Task', 'status::Todo', 'source::ai', 'area::api'] },
  31: { title: '[Follow-up] test(ui): rename two test helpers', labels: ['type::Task', 'status::Todo', 'source::ai', 'area::ui'] },
  32: { title: '[Follow-up] chore(kit): path rules miss wrong-case paths', labels: ['type::Task', 'status::Todo', 'source::ai', 'area::infra'] },
};
const view = (id) => ({ iid: id, title: issues[id].title, state: 'opened', labels: issues[id].labels, assignees: [], web_url: `https://gitlab.example.com/g/p/-/issues/${id}`, description: `Ticket ${id}.`, created_at: '2026-10-14T08:00:00Z', updated_at: '2026-10-14T09:00:00Z', author: { username: 'owner' } });
const id = Number(a[2]);
if (a[0] === 'issue' && a[1] === 'list') {
  const label = a.includes('--label') ? a[a.indexOf('--label') + 1] : null;
  out(Object.keys(issues).map(Number).filter((k) => !label || issues[k].labels.includes(label)).map(view));
} else if (a[0] === 'issue' && a[1] === 'view' && issues[id]) out(view(id));
else if (a[0] === 'label' && a[1] === 'list') out([{ name: 'status::Todo' }]);
else if (a[0] === '--version') out('glab 1.121.0 (fake)');
else out('');
