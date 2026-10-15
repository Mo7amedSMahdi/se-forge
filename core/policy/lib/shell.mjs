// Minimal POSIX-shell parser for policy checks.
//
// It never expands anything: variables, globs and substitutions stay as written.
// It splits a command line into simple commands, records redirections, here-doc
// bodies and pipes, and parses the bodies of $( ), ` `, <( ), >( ) and ( )
// recursively, so nested commands are checked like top-level ones.

const WORD_END = new Set([' ', '\t', '\n', ';', '&', '|', '<', '>', '(', ')']);

function newCommand(nested) {
  return { argv: [], assigns: [], redirects: [], stdin: [], pipeFrom: false, pipeTo: false, nested };
}

// Index just past a closing double quote that starts at `open`.
function skipDouble(src, open) {
  let i = open + 1;
  while (i < src.length && src[i] !== '"') {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === '$' && src[i + 1] === '(') { i = matchClose(src, i + 1) + 1; continue; }
    if (src[i] === '`') { i = skipBacktick(src, i); continue; }
    i++;
  }
  return i + 1;
}

function skipBacktick(src, open) {
  let i = open + 1;
  while (i < src.length && src[i] !== '`') i += src[i] === '\\' ? 2 : 1;
  return i + 1;
}

// Reads a here-doc delimiter word at i; returns [delimiter, next index].
function readDelimiter(src, i) {
  let out = '';
  while (i < src.length && !WORD_END.has(src[i])) {
    const c = src[i];
    if (c === "'" || c === '"') {
      const end = src.indexOf(c, i + 1);
      const e = end < 0 ? src.length : end;
      out += src.slice(i + 1, e);
      i = e + 1;
    } else if (c === '\\') {
      out += src[i + 1] ?? '';
      i += 2;
    } else {
      out += c;
      i++;
    }
  }
  return [out, i];
}

// Consumes here-doc bodies starting at line start i. Returns [bodies, next index].
function readHeredocBodies(src, i, pending) {
  const bodies = [];
  for (const { delim, strip } of pending) {
    const lines = [];
    while (i < src.length) {
      let end = src.indexOf('\n', i);
      if (end < 0) end = src.length;
      let line = src.slice(i, end);
      i = end + 1;
      if (strip) line = line.replace(/^\t+/, '');
      if (line === delim) break;
      lines.push(line);
    }
    bodies.push(lines.join('\n'));
  }
  return [bodies, Math.min(i, src.length)];
}

// Index of the ')' that closes the '(' at `open`, aware of quotes, comments and here-docs.
export function matchClose(src, open) {
  let depth = 0;
  let i = open;
  let pending = [];
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === "'") { const e = src.indexOf("'", i + 1); i = e < 0 ? src.length : e + 1; continue; }
    if (c === '"') { i = skipDouble(src, i); continue; }
    if (c === '`') { i = skipBacktick(src, i); continue; }
    if (c === '#' && (i === 0 || /[\s;&|(]/.test(src[i - 1]))) {
      const e = src.indexOf('\n', i);
      i = e < 0 ? src.length : e;
      continue;
    }
    if (c === '<' && src[i + 1] === '<' && src[i + 2] !== '<') {
      let j = i + 2;
      let strip = false;
      if (src[j] === '-') { strip = true; j++; }
      while (src[j] === ' ' || src[j] === '\t') j++;
      const [delim, k] = readDelimiter(src, j);
      pending.push({ delim, strip });
      i = k;
      continue;
    }
    if (c === '\n' && pending.length) {
      i = readHeredocBodies(src, i + 1, pending)[1];
      pending = [];
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i;
    i++;
  }
  return src.length;
}

function ansiC(src, i) {
  // $'...' quoting; i points at the opening quote.
  let out = '';
  i++;
  while (i < src.length && src[i] !== "'") {
    if (src[i] === '\\' && i + 1 < src.length) {
      const n = src[i + 1];
      out += n === 'n' ? '\n' : n === 't' ? '\t' : n;
      i += 2;
    } else {
      out += src[i++];
    }
  }
  return [out, i + 1];
}

// Reads one word starting at i. Nested command bodies are parsed into `out`.
function readWord(src, i, out) {
  let text = '';
  let quoted = false;
  let lead = null; // unquoted text before the first quote or expansion
  while (i < src.length && !WORD_END.has(src[i])) {
    const c = src[i];
    if (lead === null && (c === '\\' || c === "'" || c === '"' || c === '$' || c === '`')) lead = text;
    if (c === '\\') {
      if (src[i + 1] !== '\n') text += src[i + 1] ?? '';
      i += 2;
      quoted = true;
    } else if (c === "'") {
      const end = src.indexOf("'", i + 1);
      const e = end < 0 ? src.length : end;
      text += src.slice(i + 1, e);
      i = e + 1;
      quoted = true;
    } else if (c === '$' && src[i + 1] === "'") {
      const [s, j] = ansiC(src, i + 1);
      text += s;
      i = j;
      quoted = true;
    } else if (c === '"') {
      quoted = true;
      i++;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\' && '"\\$`\n'.includes(src[i + 1])) {
          if (src[i + 1] !== '\n') text += src[i + 1];
          i += 2;
        } else if (src[i] === '$' && src[i + 1] === '(') {
          i = substitution(src, i, out, (s) => { text += s; });
        } else if (src[i] === '`') {
          const end = skipBacktick(src, i);
          parseInto(src.slice(i + 1, end - 1).replace(/\\`/g, '`'), out, true);
          text += src.slice(i, end);
          i = end;
        } else {
          text += src[i++];
        }
      }
      i++;
    } else if (c === '$' && src[i + 1] === '(') {
      i = substitution(src, i, out, (s) => { text += s; });
    } else if (c === '$' && src[i + 1] === '{') {
      let depth = 0;
      let j = i + 1;
      for (; j < src.length; j++) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}' && --depth === 0) break;
      }
      text += src.slice(i, j + 1);
      i = j + 1;
    } else if (c === '`') {
      const end = skipBacktick(src, i);
      parseInto(src.slice(i + 1, end - 1).replace(/\\`/g, '`'), out, true);
      text += src.slice(i, end);
      i = end;
    } else {
      text += c;
      i++;
    }
  }
  return [{ text, quoted, lead: lead ?? text }, i];
}

// $( ... ) or $(( ... )) at i; parses the body (not arithmetic) and returns the next index.
function substitution(src, i, out, append) {
  const end = matchClose(src, i + 1);
  if (src[i + 2] !== '(') parseInto(src.slice(i + 2, end), out, true);
  append(src.slice(i, end + 1));
  return end + 1;
}

const ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*\+?=/;

function parseInto(src, out, nested) {
  let cmd = newCommand(nested);
  let pending = [];
  let pipeNext = false;

  const finish = (sep) => {
    const pipe = sep === '|' || sep === '|&';
    if (cmd.argv.length || cmd.assigns.length || cmd.redirects.length || cmd.stdin.length) {
      cmd.pipeFrom = pipeNext;
      cmd.pipeTo = pipe;
      out.push(cmd);
    }
    pipeNext = pipe;
    cmd = newCommand(nested);
  };

  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '\\' && src[i + 1] === '\n') { i += 2; continue; }
    if (c === '#') {
      const e = src.indexOf('\n', i);
      i = e < 0 ? src.length : e;
      continue;
    }
    if (c === '\n') {
      finish(';');
      i++;
      if (pending.length) {
        const [bodies, j] = readHeredocBodies(src, i, pending);
        for (const p of pending) p.cmd.stdin.push(bodies.shift());
        pending = [];
        i = j;
      }
      continue;
    }
    if (c === '&' && src[i + 1] === '>') {
      const append = src[i + 2] === '>';
      i += append ? 3 : 2;
      while (src[i] === ' ' || src[i] === '\t') i++;
      const [w, j] = readWord(src, i, out);
      cmd.redirects.push({ fd: '&', op: append ? '>>' : '>', target: w.text });
      i = j;
      continue;
    }
    if (c === ';' || c === '&' || c === '|') {
      const two = src.slice(i, i + 2);
      const op = ['&&', '||', '|&', ';;'].includes(two) ? two : c;
      finish(op);
      i += op.length;
      continue;
    }
    if (c === '(') {
      const end = matchClose(src, i);
      finish(';');
      parseInto(src.slice(i + 1, end), out, nested);
      i = end + 1;
      continue;
    }
    if (c === ')') { finish(';'); i++; continue; }
    if (c === '<' || c === '>') {
      if (src[i + 1] === '(') {
        const end = matchClose(src, i + 1);
        parseInto(src.slice(i + 2, end), out, true);
        cmd.argv.push(src.slice(i, end + 1));
        i = end + 1;
        continue;
      }
      let fd = null;
      const last = cmd.argv[cmd.argv.length - 1];
      if (last !== undefined && /^\d+$/.test(last) && cmd._lastBare && src[i - 1] !== ' ' && src[i - 1] !== '\t') {
        fd = cmd.argv.pop();
      }
      let op = c;
      for (const cand of ['<<<', '<<-', '<<', '>>', '>&', '<&', '>|', '<>']) {
        if (src.startsWith(cand, i)) { op = cand; break; }
      }
      i += op.length;
      while (src[i] === ' ' || src[i] === '\t') i++;
      if (op === '<<' || op === '<<-') {
        const [delim, j] = readDelimiter(src, i);
        pending.push({ delim, strip: op === '<<-', cmd });
        i = j;
        continue;
      }
      const [w, j] = readWord(src, i, out);
      i = j;
      if (op === '<<<') cmd.stdin.push(w.text);
      else cmd.redirects.push({ fd, op, target: w.text });
      continue;
    }
    const [w, j] = readWord(src, i, out);
    i = j;
    if (!cmd.argv.length && ASSIGN.test(w.lead)) {
      cmd.assigns.push(w.text);
    } else {
      cmd.argv.push(w.text);
      cmd._lastBare = !w.quoted;
    }
  }
  finish(';');
  if (pending.length) for (const p of pending) p.cmd.stdin.push('');
}

// Returns every simple command in `src`, top-level and nested, in source order
// (nested ones come before the command that contains them).
export function parseShell(src) {
  const out = [];
  parseInto(String(src ?? ''), out, false);
  for (const c of out) delete c._lastBare;
  return out;
}
