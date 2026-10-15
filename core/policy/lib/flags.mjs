// Generic option parsing for CLI argument lists, enough to read git-, gh- and npm-style flags.
//   spec.shortValue: short letters that take a value ("o" for -o <v> or -ov)
//   spec.longValue:  long options that take a value when given without "=" ("--message")
// Returns { short: Map<letter, value|true>, long: Map<name, value|true>, positional: [] }.
// Everything after "--" is positional; `afterDashDash` tells whether "--" was present.
export function parseFlags(args, spec = {}) {
  const shortValue = new Set(spec.shortValue || '');
  const longValue = new Set(spec.longValue || []);
  const short = new Map();
  const long = new Map();
  const positional = [];
  let afterDashDash = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (afterDashDash) { positional.push(a); continue; }
    if (a === '--') { afterDashDash = true; continue; }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) long.set(a.slice(0, eq), a.slice(eq + 1));
      else if (longValue.has(a)) { long.set(a, args[i + 1] ?? ''); i++; }
      else long.set(a, true);
      continue;
    }
    if (a.startsWith('-') && a.length > 1 && !/^-\d+$/.test(a)) {
      for (let j = 1; j < a.length; j++) {
        const l = a[j];
        if (shortValue.has(l)) {
          const rest = a.slice(j + 1);
          if (rest) short.set(l, rest);
          else { short.set(l, args[i + 1] ?? ''); i++; }
          break;
        }
        short.set(l, true);
      }
      continue;
    }
    positional.push(a);
  }
  return { short, long, positional, afterDashDash };
}

export const has = (f, shortLetters, longNames = []) =>
  [...shortLetters].some((l) => f.short.has(l)) || longNames.some((n) => f.long.has(n));
