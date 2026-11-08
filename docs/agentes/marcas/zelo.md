# Zelo model

Scope: `/zelo-style-guide`, `/zelo-elementor-preview`, `src/features/zelo/**`, `src/features/space/zeloTemplate.ts`, `public/zelo/**` and `docs/site-imports/zelo/**`.

- Source: https://zelosistemas.com.br/ (home, `/contato`, `/privacidade`). Default dark theme only.
- Fonts: Plus Jakarta Sans 800 (hero), Nunito (UI and headings), Figtree (body), Spline Sans Mono (numbers, labels). The source root is `font-size: 80%`, so every value is already converted to px (1rem = 12.8px).
- Core colors: paper `#000000`, raised `#13201C`, band `#283933`, ink `#FFFFFF`, ink-soft `#A8A8A8`, green `#90B8A6`, green-2 `#BAD5C8`, line `#90B8A633`, line-strong `#90B8A661`, red `#E0897B`.
- Green is for labels, the highlighted headline word, icons and buttons. Never paint large areas green.
- Content is 1044px inside gutters of 38/29/15px; section rhythm 97/72/55px; radii 7/11/16/21/999px.
- Templates are native Elementor trees built with `src/features/zelo/elementor.ts`. Constrain reading width with `min(100%, Npx)`, never a fixed width. Every section root keeps `overflow-x: clip`.
- The only HTML widget is the ledger script in "A conta": it holds behavior only, all content is native.
- Motion stays inside `prefers-reduced-motion: no-preference`. Hover never carries essential content.
