# Caramelo Pet model (petshop example)

Scope: `src/features/petshop/**`, `src/features/space/petshopTemplate.ts`, `brands/caramelo-pet/**` and `public/brands/caramelo-pet/**`.

- A fictional neighborhood petshop, made as the Space's example project. Phone, address, prices and reviews are sample data; the contact constants sit in `PET_CONTACT` (`src/features/petshop/tokens.ts`). Never present them as a real business.
- Source of truth: `brands/caramelo-pet/DESIGN.md`. The palette comes from the local photo `/sections/c25/businesses/pet-daycare.webp`, the only photo on the page; everything else is icons and flat color blocks.
- Fonts: Fredoka 600 for headings, Nunito for text and UI. Eyebrows are Nunito 800 uppercase 12px; every other small text (menu, prices, names) stays in normal case.
- Core colors: navy `#1F2A44`, caramel `#F2994A` (hover `#E5832C`), caramel ink `#9A4A0B` for small labels on cream, pool blue `#9ED8F7`, cream `#FFF7EC`, warm `#FDE9D3`, body `#4B5468`, line `#EEDFCB`. Text on caramel is always navy (6.4:1); white on caramel fails.
- One caramel accent family: buttons, icons and small marks. The pool blue only paints the shop band. On the blue band the eyebrow is navy (caramel ink fails there).
- Content is 1200px inside 32/24/16px gutters; sections 96/72/56px. Pill buttons, 14px fields, 24px cards, 32px large surfaces. Light cards use the 1px line; cards on the navy band are `#2A3656` with an 8% white hairline. The only shadows are on the featured plan and the chip over the photo.
- Templates are native Elementor trees built with `src/features/petshop/elementor.ts`. Zero HTML widgets: the mobile menu is a nested accordion, the FAQ is a nested accordion, the booking form is the native form. Colored boxes behind text are native containers, never CSS backgrounds on a heading, so the brand pass sees them.
- Applying the Caramelo Pet brand to its own template must leave it nearly unchanged. Before editing the DESIGN.md front matter, diff `applyBrand` output against the raw template: a `label` typography role, a `card` component or a vague `motion.hover` rewrite the whole page.
- Motion: 180ms color changes, cards lift 4px on mouse hover, buttons scale to 0.96 on press, short fade-up entrances, all behind `prefers-reduced-motion`.
