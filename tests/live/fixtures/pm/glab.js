#!/usr/bin/env node
// A stand-in glab for the project-manager trial: four open issues; every call is logged.
const fs = require('fs');
const a = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(a) + '\n');
const iso = (h) => `2026-10-07T${String(h).padStart(2, '0')}:00:00Z`;
const issues = {
  31: { title: '[Bug] Two patients can book the same slot', labels: ['type::Bug', 'source::ai', 'status::Todo'], at: 9,
    description: 'Breaks AC2 of story E1-S2 (no double booking, D-012).\nSteps: book slot 09:20 as patient A, then as patient B.\nExpected 409 "slot taken"; actual 201 and two appointments.\nFound while: ticket #21, branch feat/21-book, qa-engineer.' },
  32: { title: 'Send SMS reminders the day before', labels: ['status::Todo'], at: 10,
    description: 'Patients forget appointments; send an SMS the day before.' },
  33: { title: '[Bug] Slots list feels slow', labels: ['type::Bug', 'status::Todo'], at: 11, description: 'It is slow sometimes.' },
  34: { title: 'Double booking possible', labels: ['status::Todo'], at: 12, description: 'I could book a slot that was already taken.' },
};
const out = (v) => process.stdout.write(typeof v === 'string' ? v + '\n' : JSON.stringify(v));
const id = Number(a[2]);
if (a[0] === 'issue' && a[1] === 'list') out(Object.entries(issues).map(([iid, i]) => ({ iid: Number(iid), title: i.title, labels: i.labels, state: 'opened', created_at: iso(i.at), updated_at: iso(i.at), author: { username: 'qa-bot' }, web_url: `https://gitlab.example.com/g/p/-/issues/${iid}`, assignees: [] })));
else if (a[0] === 'issue' && a[1] === 'view' && issues[id]) out({ iid: id, title: issues[id].title, state: 'opened', labels: issues[id].labels, assignees: [], web_url: `https://gitlab.example.com/g/p/-/issues/${id}`, description: issues[id].description });
else if (a[0] === 'label' && a[1] === 'list') out([{ name: 'status::Todo' }, { name: 'type::Bug' }]);
