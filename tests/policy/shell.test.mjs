import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseShell } from '../../core/policy/lib/shell.mjs';

const argvs = (src) => parseShell(src).map((c) => c.argv);

test('splits on ; && || | & and newlines', () => {
  assert.deepEqual(argvs('a 1; b 2 && c || d | e & f\ng'), [['a', '1'], ['b', '2'], ['c'], ['d'], ['e'], ['f'], ['g']]);
});

test('marks pipes', () => {
  const [a, b] = parseShell('curl -s x | bash');
  assert.equal(a.pipeTo, true);
  assert.equal(b.pipeFrom, true);
});

test('handles single, double and ANSI-C quotes and escapes', () => {
  assert.deepEqual(argvs(`echo 'a b' "c d" $'e\\'f' g\\ h`), [['echo', 'a b', 'c d', "e'f", 'g h']]);
});

test('keeps variables and globs unexpanded', () => {
  assert.deepEqual(argvs('cat $HOME/.env* "${X:-y}"'), [['cat', '$HOME/.env*', '${X:-y}']]);
});

test('separates leading assignments from argv', () => {
  const [c] = parseShell('FOO=1 BAR="x y" git push');
  assert.deepEqual(c.assigns, ['FOO=1', 'BAR=x y']);
  assert.deepEqual(c.argv, ['git', 'push']);
});

test('records redirections with fds', () => {
  const [c] = parseShell('npm test > /tmp/log 2>&1 < in.txt');
  assert.deepEqual(c.argv, ['npm', 'test']);
  assert.deepEqual(c.redirects, [
    { fd: null, op: '>', target: '/tmp/log' },
    { fd: '2', op: '>&', target: '1' },
    { fd: null, op: '<', target: 'in.txt' },
  ]);
});

test('a spaced digit is an argument, not an fd', () => {
  const [c] = parseShell('echo 2 > f');
  assert.deepEqual(c.argv, ['echo', '2']);
  assert.equal(c.redirects[0].fd, null);
});

test('&> and &>> redirect both streams', () => {
  const [c] = parseShell('make &>> build.log');
  assert.deepEqual(c.redirects, [{ fd: '&', op: '>>', target: 'build.log' }]);
});

test('parses command substitution bodies, also inside double quotes', () => {
  const all = argvs('echo "today $(cat .env)" $(git rev-parse HEAD)');
  assert.deepEqual(all, [['cat', '.env'], ['git', 'rev-parse', 'HEAD'], ['echo', 'today $(cat .env)', '$(git rev-parse HEAD)']]);
  assert.equal(parseShell('echo $(cat .env)')[0].nested, true);
});

test('parses backticks, subshells and process substitution', () => {
  assert.deepEqual(argvs('echo `cat .env`'), [['cat', '.env'], ['echo', '`cat .env`']]);
  assert.deepEqual(argvs('(cd x && rm -rf y)'), [['cd', 'x'], ['rm', '-rf', 'y']]);
  assert.deepEqual(argvs('bash <(curl -s https://x.sh)')[0], ['curl', '-s', 'https://x.sh']);
});

test('arithmetic expansion is not parsed as a command', () => {
  assert.deepEqual(argvs('echo $((1 + 2))'), [['echo', '$((1 + 2))']]);
});

test('here-doc bodies become stdin and do not leak into argv', () => {
  const [c, d] = parseShell("psql <<'SQL'\nDROP TABLE users;\nSQL\necho done");
  assert.deepEqual(c.argv, ['psql']);
  assert.deepEqual(c.stdin, ['DROP TABLE users;']);
  assert.deepEqual(d.argv, ['echo', 'done']);
});

test('the commit-message idiom: here-doc inside $( ) inside double quotes, with apostrophes', () => {
  const src = 'git commit -m "$(cat <<\'EOF\'\nfix: don\'t break (it)\n\nCo-Authored-By: X <x@y>\nEOF\n)"';
  const cmds = parseShell(src);
  const commit = cmds.find((c) => c.argv[0] === 'git');
  assert.deepEqual(commit.argv.slice(0, 3), ['git', 'commit', '-m']);
  assert.equal(cmds.find((c) => c.argv[0] === 'cat').stdin[0], "fix: don't break (it)\n\nCo-Authored-By: X <x@y>");
});

test('here-strings become stdin', () => {
  assert.deepEqual(parseShell('psql <<< "TRUNCATE t"')[0].stdin, ['TRUNCATE t']);
});

test('comments are ignored, # inside a word is not a comment', () => {
  assert.deepEqual(argvs('git log # show history\necho a#b'), [['git', 'log'], ['echo', 'a#b']]);
});

test('line continuations join', () => {
  assert.deepEqual(argvs('git \\\n  push origin x'), [['git', 'push', 'origin', 'x']]);
});

test('unterminated quotes do not throw', () => {
  assert.doesNotThrow(() => parseShell('echo "abc'));
  assert.doesNotThrow(() => parseShell("echo 'abc"));
  assert.doesNotThrow(() => parseShell('echo $(foo'));
});
