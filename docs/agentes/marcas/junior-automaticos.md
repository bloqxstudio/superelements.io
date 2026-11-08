# Júnior Automáticos model

Scope: `src/features/junior/**`, `src/features/space/juniorTemplate.ts`, `brands/junior-automaticos/**` and `public/brands/junior-automaticos/**`.

- A real client: automatic-transmission workshop in São José dos Campos (SP), about 40 years old, family-run (Sr. Júnior, now Rafael). Source of truth: `brands/junior-automaticos/DESIGN.md` (from the client's logo) and `brands/junior-automaticos/COPY.md` (the client's copy doc, with what was added and the open items). Layout reference: socambio.com.br; do not copy its colors, fonts or text.
- The name is **Júnior Automáticos**, with the accent, as in the logo. Real contact data sits in `JA_CONTACT` (`src/features/junior/tokens.ts`). Never invent prices, warranties, hours, reviews or photos: they are open items in COPY.md.
- Fonts: Saira 700 for headings and big numbers (line-height 1.1, −0.01em); Barlow for text, labels, menu and buttons (labels and buttons uppercase and tracked).
- Core colors: black `#0B0B0C`, raised `#151517`, footer `#060607`, gold `#CF9B3A` (hover `#E0B24F`), gold ink `#7A5818` for small labels on light, paper `#F6F3EE`, body `#4A4A50`, on-dark text `#B8B8BC`, line `#E4DED4`, dark hairline white at 9%. Text on gold is always black; gold text never goes on the paper.
- One gold accent family: buttons, icons, hairlines and the highlighted headline word. Dark bands (header, hero, diagnosis, history, contact, footer) alternate with paper bands. WhatsApp green only on the floating circle.
- The logo files are raster 3D renders on black, keyed to transparent PNGs that only work on dark backgrounds. The logo never sits on a light band. Logo and symbol images keep an explicit width so the brand pass recognizes them and keeps their size.
- Content is 1200px inside 32/24/16px gutters; sections 96/72/56px. Header sticky, 80/64px. Buttons 6px, cards, panels and the map 12px. No shadows except the mobile menu and the WhatsApp float.
- Templates are native Elementor trees built with `src/features/junior/elementor.ts`. Zero HTML widgets: the mobile menu and the FAQ are nested accordions, the map is `google_maps`.
- Applying the Júnior brand to its own template must leave it unchanged. The DESIGN.md has no `label` role, no `divider` and no `button-secondary` on purpose (each one rewrote the page); diff `applyBrand` output against the raw template before editing the front matter.
- Motion: 180ms color changes, cards only get the gold border on mouse hover, buttons scale to 0.96 on press, short fade-up entrances, and the hero P R N D selector shifts into D once. All behind `prefers-reduced-motion`; without motion D is already lit.
