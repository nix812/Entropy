// 6.6.1 copy sweep tool (docs/POLISH.md section 5). Finds the player-facing strings in src/*.js, exports them for review,
// checks a rewrite (numbers, placeholders, banned words, shape) and writes approved text back by position, so nothing is
// retyped by hand.
//
// setup (once per session; the repo has no node_modules): npm i --prefix tools acorn acorn-walk
//
// usage:
//   node tools/strings.js export [--area NAME] [--json FILE] [--md FILE]
//        every candidate string: id, file, line, area (the enclosing table or function and key), tier guess, text.
//        --area filters by a substring of the area (e.g. "PLANS.basic", "TOWERS", "ENEMIES").
//   node tools/strings.js check FILE.json
//        FILE is a list of { id, new } (or the export with a "new" field filled in). Reports, per changed string:
//        numbers or ${...} placeholders that differ from the old text, banned words, exclamation marks in rules or
//        coaching, and HTML tags that differ. Exit 1 if any string fails.
//   node tools/strings.js diff BEFORE.json [--md FILE]
//        for hand edits (nested templates are easier to edit in place): pairs each string of an earlier export with
//        today's text in the same area and runs the same checks. --md writes a before/after review table.
//   node tools/strings.js apply FILE.json [--force]
//        runs check, then writes each "new" text into its source at the recorded position. Refuses if the source text
//        there no longer matches "old" (re-export after other edits). Each file must still parse afterwards.
//
// A string's id is stable while its text, file and area stay the same: <file>:<area>:<8 hex of the text>.
// "new" is written as the inside of the same quote type: for '...' strings escape ' yourself; for `...` templates keep
// the ${...} parts exactly (check enforces it).
const fs = require('fs'), path = require('path');
const req = m => { try { return require(m); } catch (e) { return require(path.join(__dirname, 'node_modules', m)); } };
const acorn = req('acorn'), walk = req('acorn-walk');
const ROOT = path.join(__dirname, '..'), FILES = ['data.js', 'sim.js', 'audio.js', 'ui.js'];
const BANNED = ['delve', 'realm', 'harness', 'unleash', 'seamless', 'journey', 'elevate', 'tapestry', 'embark', 'testament',
  'dive into', 'at its core', 'whether you', 'get ready to', 'in the world of', "it's not just"];

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, '0'); }
const visible = s => s.replace(/<[^>]*>/g, ' ').replace(/\$\{[^}]*\}/g, ' ').replace(/&[a-z]+;/g, ' ');
// a string a player reads: letters, and either a space or a capital first letter; not a selector, colour, id, CSS or regex
function playerText(raw) {
  const v = visible(raw).trim();
  if (!/[A-Za-z]{2,}/.test(v)) return false;
  if (/^[#.\[]|^data-|^rgba?\(|^\d+px|px;|^[a-z]+(-[a-z]+)*:|^--|^https?:|\.(png|mp3|woff2?|js|html)$/.test(raw.trim())) return false;
  if (/^[a-z0-9_.$-]+$/.test(v) && !/\s/.test(v)) return false; // ids, keys, class names
  if (/^[a-z0-9_ -]+$/.test(v) && v.split(/\s+/).every(w => /^[a-z]+[0-9]*$|^[a-z]+(-[a-z]+)+$/.test(w)) && /\b(btn|on|off|sw|hs|panel|card|small|danger|chip|tip|good|bad|dim|hidden|flex|grid)\b/.test(v)) return false; // class lists
  if (!/\s/.test(v) && !/^[A-Z]/.test(v) && !/[.!?:]$/.test(v)) return false;
  return true;
}
const NOKEY = new Set(['id', 'col', 'el', 'kind', 'type', 'key', 'ico', 'svg', 'cls', 'act', 'at', 'ls', 'mod', 'boss', 'storm', 'genre', 'flav', 'unlockT', 'tree', 'need', 'sel']);
function keyOf(node, anc) {
  for (let i = anc.length - 2; i >= 0; i--) { const a = anc[i];
    if (a.type === 'Property' && a.value === anc[i + 1]) return a.key.name || a.key.value;
    if (a.type === 'Property') return a.key.name || a.key.value; }
  return '';
}
function areaOf(anc) {
  const parts = [];
  for (let i = 0; i < anc.length - 1; i++) { const a = anc[i];
    if (a.type === 'VariableDeclarator' && a.id.name) parts.push(a.id.name);
    else if (a.type === 'FunctionDeclaration' && a.id) parts.push(a.id.name + '()');
    else if (a.type === 'Property' && (a.key.name || a.key.value) && parts.length && parts.length < 4 && anc[i - 1] && anc[i - 1].type === 'ObjectExpression' && i < anc.length - 3) parts.push(a.key.name || a.key.value); }
  return parts.slice(-3).join('.');
}
function tierOf(file, area, key, text) {
  if (/PLANS|Coach|introCard|onboarding|openTut|CHECK|teach|GUIDE|LESSON/i.test(area) || /^(t|b)$/.test(key) && file === 'ui.js') return 'coaching';
  if (/PIRATE_LINES|titles|BOSS_POWER|quip|say/i.test(area + ' ' + key) || /^(blurb|pitch|tip)$/.test(key)) return 'flavour';
  if (/^(desc|d|up|down|beat|counter)$/.test(key) || /PERKS|ANOM|SPECS|GENES|TAL|LAWS|BOONS/i.test(area)) return 'rules';
  if (/toast|Hooks\.toast|rlog|feed/i.test(area) || /^[A-Z0-9 ×·:'-]+$/.test(visible(text).trim())) return 'label';
  return 'ui';
}
function exportAll(filter) {
  const out = [];
  for (const f of FILES) {
    const src = fs.readFileSync(path.join(ROOT, 'src', f), 'utf8');
    const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', locations: true, allowHashBang: true });
    walk.fullAncestor(ast, (node, _st, anc) => {
      let raw, start, end, kind;
      if (node.type === 'Literal' && typeof node.value === 'string') { raw = src.slice(node.start + 1, node.end - 1); start = node.start + 1; end = node.end - 1; kind = src[node.start]; }
      else if (node.type === 'TemplateLiteral') { if (anc[anc.length - 2] && anc[anc.length - 2].type === 'TaggedTemplateExpression') return; raw = src.slice(node.start + 1, node.end - 1); start = node.start + 1; end = node.end - 1; kind = '`'; }
      else return;
      const parent = anc[anc.length - 2];
      if (parent && (parent.type === 'ImportDeclaration' || parent.type === 'MemberExpression' && parent.property === node)) return;
      if (parent && parent.type === 'Property' && parent.key === node) return;
      if (parent && parent.type === 'CallExpression' && parent.callee.type === 'MemberExpression' && /^(querySelector|querySelectorAll|getElementById|closest|matches|play|addEventListener|setProperty|getItem|setItem|removeItem|createElement|setAttribute|getAttribute|toggle|add|remove|contains|ev|allow|rlog|split|join|replace|test|startsWith|endsWith|includes|indexOf)$/.test(parent.callee.property.name || '')) return;
      if (parent && parent.type === 'CallExpression' && parent.callee.type === 'Identifier' && /^(\$|\$\$|act|sel|svgIcon|ev|rlog|req|require|el)$/.test(parent.callee.name)) return;
      if (parent && parent.type === 'BinaryExpression' && /^(===|!==|==|!=|in)$/.test(parent.operator)) return;
      if (parent && parent.type === 'SwitchCase') return;
      if (kind === '`' && node.expressions.length && !/[A-Za-z]{3,}/.test(node.quasis.map(q => q.value.raw).join(' ').replace(/<[^>]*>/g, ' ').replace(/class="[^"]*"|data-[a-z-]+="[^"]*"|style="[^"]*"/g, ''))) return;
      const key = keyOf(node, anc); if (NOKEY.has(key)) return;
      if (!playerText(raw)) return;
      const area = areaOf(anc) + (key ? '.' + key : '');
      if (filter && !area.includes(filter)) return;
      out.push({ id: `${f}:${area}:${hash(raw)}`, file: f, line: node.loc.start.line, area, tier: tierOf(f, area, key, raw), q: kind, start, end, old: raw });
    });
  }
  // ids must be unique: the same text twice in one area gets a counter
  const seen = {}; for (const s of out) { const n = seen[s.id] = (seen[s.id] || 0) + 1; if (n > 1) s.id += '#' + n; }
  return out;
}
const nums = s => (visible(s).match(/[+−-]?\d+(?:[.,]\d+)?%?|[×x]\d+(?:\.\d+)?/g) || []).map(n => n.replace('−', '-').replace(/^x/, '×')).sort();
// a placeholder's code skeleton: its names and number literals. Strings inside it are separate rows (checked on their own),
// so rewording 'a' : 'b' inside ${...} is fine; changing what it computes is not.
function holeList(s) { const out = []; for (let i = s.indexOf('${'); i >= 0; i = s.indexOf('${', i + 2)) { let d = 0, j = i + 2; for (; j < s.length; j++) { const c = s[j]; if (c === '{') d++; else if (c === '}') { if (!d) break; d--; } } out.push(s.slice(i + 2, j)); i = j - 1; } return out; }
function skeleton(code) { try { const ids = []; walk.full(acorn.parseExpressionAt(code, 0, { ecmaVersion: 'latest' }), n => { if (n.type === 'Identifier') ids.push(n.name); else if (n.type === 'Literal' && typeof n.value !== 'string') ids.push(String(n.value)); }); return ids.join(','); } catch (e) { return code; } }
const outer = s => { let r = '', d = 0; for (let i = 0; i < s.length; i++) { if (s[i] === '$' && s[i + 1] === '{' && !d) { d = 1; i++; continue; } if (d) { if (s[i] === '{') d++; else if (s[i] === '}') d--; continue; } r += s[i]; } return r; };
const holes = s => holeList(outer(s) === s ? s : s).map(skeleton).sort();
const tags = s => (s.match(/<\/?[a-z][^>]*>/g) || []).sort();
function checkOne(s) {
  const p = [], o = s.old, n = s.new;
  if (JSON.stringify(holes(o)) !== JSON.stringify(holes(n))) p.push(`placeholders differ: ${holes(o).join(' ')} -> ${holes(n).join(' ')}`);
  if (JSON.stringify(tags(o)) !== JSON.stringify(tags(n))) p.push('HTML tags differ');
  if (s.tier !== 'flavour') { const a = nums(o), b = nums(n), miss = a.filter(x => !b.includes(x)), extra = b.filter(x => !a.includes(x));
    if (miss.length) p.push(`numbers dropped: ${miss.join(' ')}`); if (extra.length && !s.numsOk) p.push(`numbers added: ${extra.join(' ')} (set numsOk if checked against the rules)`); }
  const low = visible(n).toLowerCase(); for (const w of BANNED) if (low.includes(w)) p.push(`banned: "${w}"`);
  if (/(rules|coaching)/.test(s.tier) && /!/.test(visible(n))) p.push('exclamation mark in ' + s.tier + ' text');
  if (/—.*—/.test(n)) p.push('em-dash chain');
  if (s.q === "'" && /(^|[^\\])'/.test(n)) p.push("unescaped ' inside a '...' string");
  if (s.q === '"' && /(^|[^\\])"/.test(n)) p.push('unescaped " inside a "..." string');
  if (s.q === '`' && /(^|[^\\])`/.test(outer(n))) p.push('unescaped ` inside a template');
  return p;
}
function load(file) {
  const rows = JSON.parse(fs.readFileSync(file, 'utf8')), all = exportAll(), byId = Object.fromEntries(all.map(s => [s.id, s]));
  return rows.filter(r => r.new != null && r.new !== r.old).map(r => { const s = byId[r.id]; if (!s) return { id: r.id, missing: 1 }; return Object.assign({}, s, { new: r.new, numsOk: r.numsOk }); });
}
const [cmd, ...args] = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
if (cmd === 'export') {
  const rows = exportAll(opt('--area'));
  if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(rows.map(({ start, end, ...r }) => r), null, 1));
  if (opt('--md')) fs.writeFileSync(opt('--md'), '| id | line | tier | text |\n| --- | --- | --- | --- |\n' + rows.map(r => `| ${r.id} | ${r.line} | ${r.tier} | ${r.old.replace(/\|/g, '\\|')} |`).join('\n') + '\n');
  if (!opt('--json') && !opt('--md')) for (const r of rows) console.log(`${r.file}:${r.line}\t${r.tier}\t${r.area}\t${r.old}`);
  console.error(`${rows.length} strings, ${rows.reduce((a, r) => a + visible(r.old).split(/\s+/).filter(Boolean).length, 0)} words`);
} else if (cmd === 'check' || cmd === 'apply') {
  const rows = load(args[0]); let bad = 0;
  for (const s of rows) { if (s.missing) { bad++; console.log(`FAIL ${s.id}: not found (re-export: the source changed)`); continue; }
    const p = checkOne(s); if (p.length) { bad++; console.log(`FAIL ${s.id} (${s.file}:${s.line})\n     ${p.join('\n     ')}`); } }
  console.log(`${rows.length} changed strings, ${bad} with problems`);
  if (cmd === 'check' || bad && !args.includes('--force')) process.exit(bad ? 1 : 0);
  const byFile = {}; for (const s of rows) (byFile[s.file] || (byFile[s.file] = [])).push(s);
  for (const f in byFile) { const p = path.join(ROOT, 'src', f); let src = fs.readFileSync(p, 'utf8');
    for (const s of byFile[f].sort((a, b) => b.start - a.start)) { if (src.slice(s.start, s.end) !== s.old) { console.log(`FAIL ${s.id}: source moved, nothing written to ${f}`); process.exit(1); } src = src.slice(0, s.start) + s.new + src.slice(s.end); }
    acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' }); fs.writeFileSync(p, src); console.log(`wrote ${byFile[f].length} strings to src/${f}`); }
} else if (cmd === 'diff') {
  // for hand edits: pair each string in BEFORE.json (an earlier export) with today's text in the same area, in order, and
  // run the same checks on every changed pair. An area whose string count changed is listed for a manual read.
  const before = JSON.parse(fs.readFileSync(args[0], 'utf8')), now = exportAll(), grp = a => { const g = {}; for (const r of a) (g[r.area] || (g[r.area] = [])).push(r); return g; };
  const B = grp(before), N = grp(now); let bad = 0, changed = 0; const md = [];
  for (const area of new Set([...Object.keys(B), ...Object.keys(N)])) { const b = B[area] || [], n = N[area] || [];
    if (b.length !== n.length) { console.log(`READ ${area}: ${b.length} strings before, ${n.length} now`); for (const r of n) if (!b.some(x => x.old === r.old)) md.push(`| ${r.file}:${r.line} | ${r.tier} | (new) | ${r.old.replace(/\|/g, '\\|')} |`); continue; }
    b.forEach((o, i) => { const r = n[i]; if (o.old === r.old) return; changed++; const p = checkOne(Object.assign({}, r, { old: o.old, new: r.old }));
      md.push(`| ${r.file}:${r.line} | ${r.tier} | ${o.old.replace(/\|/g, '\\|')} | ${r.old.replace(/\|/g, '\\|')} |`);
      if (p.length) { bad++; console.log(`FAIL ${r.file}:${r.line} ${area}\n     ${p.join('\n     ')}`); } }); }
  if (opt('--md')) fs.writeFileSync(opt('--md'), '| where | tier | before | after |\n| --- | --- | --- | --- |\n' + md.join('\n') + '\n');
  console.log(`${changed} changed strings, ${bad} with problems`); process.exit(bad ? 1 : 0);
} else { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 26).join('\n')); }
