---
name: figma-to-widget
description: Build one Flutter widget from its design - a Figma node, or a provided screen and its design system - with Material 3 widgets and the app's theme (colours, type and spacing from the design tokens), every state the design shows, directional layout for right-to-left, and a widget test with golden pictures. Use when a mobile plan item builds or changes a visible widget.
---

# From a design to a widget

The design is the source of truth for the look (skill `figma-align`, decision 49). Build with what the app already has; add nothing the design does not show.

## Steps
1. **Read the design.**
   - **Figma:** load `figma:figma-design-to-code`, then `get_screenshot` of the node and `get_design_context` once for its values. Its code output is web code: take the values, not the code.
   - **Provided screens:** the screen file and region from `.forge/project/bootstrap/design-map.md`, and the values in `design-system.md`.

   List the states the design shows (default, pressed, focused, disabled, loading, empty, error, selected) and the variants.
2. **Map to what exists.**
   - **Building blocks:** the Material 3 widget that does the job (`FilledButton`, `Card`, `ListTile`, `NavigationBar`…) and the app's own widgets in the feature folders or `lib/widgets/`.
   - **Values:** colours from the theme's `ColorScheme`, type from its `TextTheme`, and spacing, radii and anything else the tokens define from a `ThemeExtension`. A value the theme lacks is added to the app's `ThemeData` (in `lib/app.dart`, or a `lib/theme.dart` of its own once it grows), once, from the tokens; never a hex colour or a raw size in a widget.
3. **Write the widget** in its feature folder (or `lib/widgets/` when two features share it):
   - variants as typed constructor parameters;
   - text from the ARB files in every language;
   - directional layout only (`EdgeInsetsDirectional`, `AlignmentDirectional`, `start`/`end`; skill `rtl-i18n-check`);
   - a `Semantics` label or tooltip where the widget has no visible text (an icon button), and a tap target of at least 48 × 48.
4. **Test it** (skill `write-flutter-tests`):
   - every state and variant the design shows, found by the text and labels a person sees;
   - a golden picture per language, made in the dev container.
   A shape the design does not show is a plan question or a "Built without a design" item, not a guess.
5. **Compare** the golden pictures with the design, in both directions when the app ships Arabic. List each difference you leave, with its reason, for the UI reviewer.

## Done when
- the widget uses Material 3 widgets, the app's widgets and the theme only, with every state and variant the design shows;
- its strings are in every ARB file, and its layout is directional only;
- its tests and golden pictures pass, and remaining differences from the design are listed with their reason.
