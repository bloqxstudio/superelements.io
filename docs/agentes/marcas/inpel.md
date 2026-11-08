# Inpel model

Scope: `/inpel-elementor-preview`, `src/features/inpel/**`, `src/features/space/inpelTemplate.ts`, `brands/inpel/**`, `public/inpel/**` and `docs/site-imports/inpel/**`.

- Source: https://www.inpel.com.br/ (Vue app on the Bootstrap 3 "Electro" theme). Texts, products and posts come from its public API into `src/features/inpel/content.ts`; do not retype them from screenshots. Record in `docs/site-imports/inpel/`.
- Font: Montserrat 400/500/700 only (the source asks for 800 but never loads it).
- Core colors: red `#D10024` (hover `#A8001D`), ink `#2B2D42`, body `#333333`, muted `#8D99AE`, line `#E4E7ED`, mist `#FBFBFC`, bar `#1E1F29`, footer `#15161D`, footer text `#B9BABC`. One red only; no gradients.
- Content is 1140px with 15px gutters; sections have 30px top and bottom; grids use a 30px gutter. The header switches to the mobile bar below 992px with custom CSS, like Bootstrap.
- Shapes are square (cards, images, fields, social icons); only the search and the red buttons use the 40px pill. The highlight cards keep the two red bands skewed −45° at 90% opacity.
- Cards: 1px `#E4E7ED` outline that becomes a 2px red outline on hover. No other shadows.
- Motion stays at the source level: 0.2s color and underline on links, 1.1 zoom on highlight photos, all behind `prefers-reduced-motion`.
- Templates are native Elementor trees built with `src/features/inpel/elementor.ts`. Zero HTML widgets: the mobile menu is a nested accordion, the search is `search-form`, the rating is a radio group drawn as stars.
- The import is faithful on purpose, errors included (see "Improvements found" in `docs/site-imports/inpel/MIGRATION.md`). Fix them as improvements, one at a time, and update the record.
