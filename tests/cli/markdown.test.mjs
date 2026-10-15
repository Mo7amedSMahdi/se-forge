// The dashboard's Markdown (decision 124): what the kit's documents use, every text escaped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, frontMatter, inline, demote } from '../../core/cli/dashboard/markdown.mjs';

test('inline: code, bold, emphasis, web links only, everything escaped', () => {
  assert.equal(inline('a <b>x</b> **bold** `<c>` [web](https://x.io/a?b=1&c=2) [file](../y.md) _em_ *em*'),
    'a &lt;b&gt;x&lt;/b&gt; <b>bold</b> <code>&lt;c&gt;</code> <a href="https://x.io/a?b=1&amp;c=2" target="_blank" rel="noopener">web</a> file <i>em</i> <i>em</i>');
  assert.doesNotMatch(inline('[x](javascript:alert(1))'), /href/);
  assert.equal(inline('snake_case_name and 2*3*4'), 'snake_case_name and 2*3*4', 'no emphasis inside words or numbers');
});

test('blocks: headings shifted, a table, nested lists, quotes, rules, code and a diagram', () => {
  const md = '# Title\n\nSome *text*\ncontinued.\n\n## Part\n| A | B |\n|---|:-:|\n| 1 | `x\\|y` |\n| 2 |\n\n- one\n  - one.a\n- two\n  more of two\n1. first\n2. second\n\n> said\n\n---\n```js\nlet a = "<b>";\n```\n```mermaid\nflowchart LR\n  a-->b\n```\n';
  const seen = [];
  const html = renderMarkdown(md, { shift: 2, diagram: (c) => { seen.push(c); return '<figure>D</figure>'; } });
  assert.match(html, /^<h3>Title<\/h3>\n<p>Some <i>text<\/i> continued\.<\/p>\n<h4>Part<\/h4>/);
  assert.match(html, /<table><thead><tr><th>A<\/th><th>B<\/th><\/tr><\/thead><tbody><tr><td>1<\/td><td><code>x\|y<\/code><\/td><\/tr><tr><td>2<\/td><td><\/td><\/tr><\/tbody><\/table>/);
  assert.match(html, /<ul><li>one<ul><li>one\.a<\/li><\/ul><\/li><li>two more of two<\/li><\/ul>\n<ol><li>first<\/li><li>second<\/li><\/ol>/);
  assert.match(html, /<blockquote><p>said<\/p><\/blockquote>\n<hr>/);
  assert.match(html, /<pre class="src"><code>let a = &quot;&lt;b&gt;&quot;;<\/code><\/pre>\n<figure>D<\/figure>/);
  assert.deepEqual(seen, ['flowchart LR\n  a-->b']);
  assert.match(renderMarkdown('```mermaid\nx\n```'), /<pre class="src"><code>x<\/code><\/pre>/, 'no picture: the diagram\'s text');
  assert.match(renderMarkdown('###### deep', { shift: 3 }), /<h6>deep<\/h6>/, 'at most h6');
});

test('front matter and demote', () => {
  const { meta, body } = frontMatter('---\nstatus: accepted\ndate: "2026-10-10"\n---\n\n# ADR\n');
  assert.deepEqual(meta, { status: 'accepted', date: '2026-10-10' });
  assert.equal(body, '\n# ADR\n');
  assert.equal(frontMatter('# none').body, '# none');
  assert.equal(demote('# A\n```\n# not a heading\n```\n## B', 2), '### A\n```\n# not a heading\n```\n#### B');
});
