// Stop (the lead's session; lanes stop through SubagentStop): plans, reviews and handovers reach the team
// only through `forge save`. When the project's folder in the team repo has changes not saved yet, the lead
// is sent back once to save them: never twice in a row (stop_hook_active), and not again for the same set
// of unsaved files, so an interactive session is not reminded at the end of every answer.
import crypto from 'node:crypto';
import { git, readState, writeState } from './context.mjs';

export function saveReminder(input, ctx) {
  if (input.stop_hook_active || ctx.agentId) return null;
  const folder = ctx.projectDir();
  if (!folder) return null;
  const st = git(folder, ['status', '--porcelain', '--untracked-files=all', '--', '.']);
  if (!st.ok || !st.out) return null;
  const files = st.out.split('\n').filter(Boolean).map((l) => l.slice(3));
  const hash = crypto.createHash('sha256').update(st.out).digest('hex');
  if (readState(ctx, 'save-reminder.json', {}).hash === hash) return null;
  writeState(ctx, 'save-reminder.json', { hash, at: new Date().toISOString() });
  const names = files.map((f) => f.replace(/^.*?\/(?=(plans|reviews|bootstrap|architecture|handoffs|pm|contracts|specs)\/)/, ''));
  return {
    decision: 'block',
    reason: `${files.length} file(s) in the team repo are not saved yet (${names.slice(0, 5).join(', ')}${files.length > 5 ? ', …' : ''}). Plans, reviews and handovers reach your teammates only through \`forge save\`: run \`forge save -m "<what changed>"\`, then finish. If they are not ready to share, say so and finish.`,
  };
}
