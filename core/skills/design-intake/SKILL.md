---
name: design-intake
description: Take in the screens a client provides (a Figma file, a PDF, or image files) so they can be built in their exact style - a design system of tokens and components, a map from each story to its screen, and the states the screens do not show - for the owner's single review. Used by /bootstrap when the register's design source is provided screens.
---

# Design intake: provided screens

The screens are the source of truth for the look (decision 49). Agents never invent styles; anything the screens do not show is listed, not designed.

## Steps
1. **Collect.** A Figma file: record its file key and root node in `project.design` and `project.figma`. A PDF or images: copy them into `.forge/project/bootstrap/screens/`, one file per screen, named `<nn>-<screen>-<state>.<ext>`; split a PDF by page and note page numbers.
2. **Inventory.** Open every screen (Figma: `get_metadata` and `get_screenshot`, after loading `figma:figma-design-to-code`; files: the Read tool reads images and PDFs). For each one, record its name, the states it shows (default, empty, loading, error, success, disabled), the role it is for and the stories it serves.
3. **Design system** in `.forge/project/bootstrap/design-system.md`:
   - colours (with their role: primary, surface, text, border, success, warning, error);
   - type scale: font family, sizes, weights, line heights;
   - spacing scale, radii, shadows, breakpoints;
   - components and their variants: buttons, inputs, selects, tables, cards, dialogs, navigation.

   From Figma, take the exact values from the file's styles and variables. From a PDF or images, **measure** them: colours exactly with `forge design sample <screen>` (the palette) and `--at "x,y"` (one element's colour); sizes and spacing by eye from the pixels. Give each value with its source screen, marked "sampled" (exact) or "measured". A measured value close to a standard scale step (e.g. 15 px vs 16 px) takes the scale step, and says so.
   End with the CSS custom properties the frontend will use.
4. **Map.** `.forge/project/bootstrap/design-map.md`: for each story, its screen(s) and region, or "no screen". Add a "Not in the screens" list: states, roles and screens the stories need but the design does not show. These are built in the same style and listed for the owner (skill `figma-align`).
5. **RTL and languages.** If the register asks for Arabic and English, note which screens show each direction, and the mirroring rules the screens imply.
6. Hand over to the leader for the single review: the paths, the number of screens, the tokens marked measured, and the "Not in the screens" count.

## Done when
- every provided screen is in the inventory and mapped to stories, or marked as not used;
- the design system lists every colour, type style, spacing step and component the screens use, with exact or measured sources;
- the "Not in the screens" list is complete, and nothing was designed beyond the screens.
