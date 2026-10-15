#!/usr/bin/env node
// A stand-in glab for the merge trial: one open merge request (!12) from feat/7-status into dev at
// $FAKE_SHA, for ticket #7 (In Testing); every call is logged to $FAKE_LOG, merges included (nothing is merged anywhere).
const fs = require('fs');
const a = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(a) + '\n');
const out = (v) => process.stdout.write(typeof v === 'string' ? v + '\n' : JSON.stringify(v));
if (a[0] === 'mr' && a[1] === 'list') out([{ iid: 12, title: 'feat: status (#7)', source_branch: 'feat/7-status', target_branch: 'dev', draft: false, sha: process.env.FAKE_SHA, state: 'opened' }]);
else if (a[0] === 'mr' && a[1] === 'view') out({ iid: 12, title: 'feat: status (#7)', source_branch: 'feat/7-status', target_branch: 'dev', draft: false, sha: process.env.FAKE_SHA, state: 'opened', web_url: 'https://gitlab.example.com/g/p/-/merge_requests/12' });
else if (a[0] === 'mr' && (a[1] === 'merge' || a[1] === 'accept')) out('Merged !12');
else if (a[0] === 'issue' && a[1] === 'view') out({ iid: 7, title: 'Status file', state: 'opened', labels: ['type::Feature', 'status::In Testing'], assignees: [], web_url: 'https://gitlab.example.com/g/p/-/issues/7', description: 'Ticket 7.' });
else if (a[0] === '--version') out('glab 1.121.0 (fake)');
else out([]);
