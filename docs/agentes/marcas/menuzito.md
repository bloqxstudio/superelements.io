# Menuzito model

Scope: `/menuzito-modelo`, `/menuzito-style-guide`, `src/features/menuzito/**`, and `public/menuzito/**`.

- Use the local Inter variable font from `/menuzito/assets/fonts/inter-latin.woff2` for weights 300–900.
- Core colors: `--mz-primary #699FB5`, `--mz-secondary #4D578F`, `--mz-showcase #749EB3`, `--mz-ink #020817`, `--mz-muted #64748B`, `--mz-soft #F1F5F9`, `--mz-line #E2E8F0`, and white surfaces.
- The page is mostly white and slate with restrained blue gradients only on conversion buttons and highlighted headline text.
- Content container is 1280px with 24px desktop gutters, 20px tablet gutters, and 16px mobile gutters.
- Section rhythm is 80px desktop and 62px mobile. Header is fixed at 80px desktop and 64px mobile.
- Type: hero 48–64px/800 with 1.06 line-height and tight tracking; section headings 32–40px/750; card titles 15–18px/700; body 14–17px/400–500.
- Radii: 8px buttons, 12–18px compact cards, 20–24px major surfaces, and 999px badges.
- Borders are structural (`#E2E8F0`). Shadows are soft and sparse; stronger shadows indicate elevation or a featured pricing card.
- Motion is restrained: 150–220ms for controls, 500–700ms for image zoom, no `transition: all`, and every pressable control scales to 0.96 on active.
- Preserve focus visibility and `prefers-reduced-motion`. Hover can enhance but must never contain essential information.
- Source-derived assets live under `/menuzito/assets`; do not hotlink the original site or its analytics/CRM resources.
- Do not add neon effects, dark AI gradients, glass cards across the whole page, or decorative elements foreign to the source.

The Menuzito model reproduces a third-party reference solely inside its requested template scope. The rest of the application keeps its existing visual language.
