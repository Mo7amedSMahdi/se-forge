---
name: rtl-i18n-check
description: Check a UI change for languages and right-to-left - no hard-coded strings, the same keys in every language file, logical CSS only, dates and numbers through Intl, the layout correct in Arabic (RTL) and English - with the commands that find each problem. Use before a UI branch is done, and in UI reviews.
---

# Languages and right-to-left check

## Checks (run from the frontend's root; each should print nothing)
1. **Physical directions in classes or CSS** (use `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, `text-end`, `rounded-s-`, `border-s-`):
   `grep -rnE "\b(ml|mr|pl|pr|left|right)-([0-9]|\[)|text-(left|right)\b|rounded-[lr]-|border-[lr]-|(margin|padding)-(left|right)" src --include='*.tsx' --include='*.css' | grep -v "\.test\." | grep -v "src/components/ui/"`
2. **Text in JSX that is not translated**: `grep -rnE ">[^<>{}]*[A-Za-z؀-ۿ]{3,}[^<>{}]*<" src --include='*.tsx' | grep -v "\.test\." | grep -v "src/components/ui/"`. Each hit should be a `t('…')` call.
3. **Keys missing in a language file**:
   `node -e "const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'?f(v,p+k+'.'):[p+k]);const [a,b]=['ar','en'].map(l=>new Set(f(require('./src/i18n/'+l+'.json'))));for(const k of a)if(!b.has(k))console.log('en missing',k);for(const k of b)if(!a.has(k))console.log('ar missing',k)"`
4. **Dates, numbers and currency** go through `Intl` with the active language (`new Intl.DateTimeFormat(i18n.language, …)`), never string building. Time zones come from the register.
5. **Icons and images that point a direction** (arrows, chevrons) flip in RTL (`rtl:-scale-x-100`); logos and media do not.
6. **Look at it in both directions**: a component or Playwright test that switches to Arabic and checks `dir="rtl"`, plus the page's screenshot in both languages for the UI reviewer.

## In a Flutter app (run from its root; each should print nothing)
1. **Physical directions**: `grep -rnE "EdgeInsets\.(only\([^)]*\b(left|right):|fromLTRB)|Alignment\.(center|top|bottom)(Left|Right)|TextAlign\.(left|right)|Positioned\.fromRect" lib --include='*.dart' | grep -v "lib/api/" | grep -v "lib/l10n/"`. Use `EdgeInsetsDirectional`, `AlignmentDirectional`, `TextAlign.start`/`end` and `PositionedDirectional`.
2. **Text that is not translated**: `grep -rnE "(Text\(|labelText: |hintText: |tooltip: |semanticsLabel: )'[^']*[A-Za-z؀-ۿ]{3,}" lib --include='*.dart' | grep -v "lib/l10n/"`. Each hit should come from `AppLocalizations`. A language's own name in a language menu is the exception.
3. **Keys missing in an ARB file**: the test that compares them fails (`stack-flutter`, `test/l10n_test.dart`). `flutter gen-l10n` also lists untranslated messages.
4. **Dates and numbers** through `intl` (`DateFormat`, `NumberFormat`) in the active locale (`Localizations.localeOf(context)`).
5. **Icons that point a direction** use the Material icons that mirror (`Icons.arrow_back`, `Icons.chevron_right`) or `matchTextDirection: true` on an image; logos do not flip.
6. **Look at it in both directions**: a widget test in Arabic checks `Directionality.of(…)`, and the golden pictures exist in both languages.

## Done when
- checks 1 to 3 print nothing (or only lines justified in the report);
- dates and numbers use `Intl`, and direction-carrying icons flip;
- the change was seen and tested in Arabic (RTL) and English.
