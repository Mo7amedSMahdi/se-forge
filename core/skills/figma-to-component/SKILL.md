---
name: figma-to-component
description: Build one React component from its design - a Figma node, or a provided screen and its design system - reusing the project's shadcn/ui components and design tokens, with every state the design shows, logical properties for right-to-left, and a test. Use when a plan item builds or changes a visible component.
---

# From a design to a component

The design is the source of truth for the look (skill `figma-align`, decision 49). Build with what the project already has; add nothing the design does not show.

## Steps
1. **Read the design.**
   - **Figma:** load `figma:figma-design-to-code`, then `get_screenshot` of the node and `get_design_context` once for its values.
   - **Provided screens:** the screen file and region from `.forge/project/bootstrap/design-map.md`, and the values in `design-system.md`.

   List the states the design shows (default, hover, focus, disabled, loading, empty, error, selected) and the variants.
2. **Map to what exists.**
   - **Building blocks:** the closest components in `src/components/ui/` (shadcn) and in the feature folders. A new shadcn component comes from `npx shadcn add <name>`, never copied by hand.
   - **Values:** colours, spacing, radii and type from the design tokens (CSS variables and Tailwind classes), never raw hex or pixel values the tokens cover.
3. **Write the component** in its feature folder (or `src/components/` when two features share it):
   - variants as typed props;
   - text through `t('…')` in both language files;
   - logical classes only (`ms-`, `ps-`, `text-start`; skill `rtl-i18n-check`);
   - accessible names, roles, and a visible focus state.
4. **Test it** (skill `write-unit-tests`): every state and variant the design shows, queried by role and label. A shape the design does not show is a plan question or a "Built without a design" item, not a guess.
5. **Compare** your rendering with the design in both directions when the project ships Arabic. List each difference you leave, with its reason, for the UI reviewer.

## Done when
- the component uses the project's components and tokens only, with every state and variant the design shows;
- its strings exist in every language, and it uses logical properties only;
- its tests pass, and remaining differences from the design are listed with their reason.
