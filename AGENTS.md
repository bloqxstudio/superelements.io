# Project instructions

## Visual language

This repository contains multiple explicit brand scopes. Do not blend them.

### Menuzito model

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

### UGLYCASH model

Scope: `/uglycash-modelo`, `/uglycash-style-guide`, `src/features/uglycash/**`, and `public/uglycash/**`.

- Use local Helvetica Now Display Condensed for editorial display type and local Inter for body/UI copy.
- Core colors: canvas `#F2F2F2`, ink `#000000`, paper `#FFFFFF`, hot pink `#FF00E5`, acid lime `#C9FF00`, signal orange `#FF4B17`, sky `#78BFFF`, and deep blue `#182D86`.
- Desktop content canvas is 1440px with 16px external gutters. Large sections are paper-like rounded panels with 24–30px radii.
- Hero type is 164/140px with -5.48px tracking on wide desktop. Section headings use 64/60px condensed uppercase. Body copy uses Inter at 15–18px.
- The visual language is editorial brutalism: oversized black typography, dense product UI, bright utilitarian color blocks, odd physical objects and minimal chrome.
- Keep images and the hero video local. Do not hotlink the source website or copy analytics, financial services, store or social integrations.
- Hover motion is subtle and never carries essential content. Preserve focus visibility and `prefers-reduced-motion`.
- Do not soften the work into generic fintech gradients, glassmorphism or rounded SaaS cards outside the source-derived pattern.

### Zelo model

Scope: `/zelo-style-guide`, `/zelo-elementor-preview`, `src/features/zelo/**`, `src/features/space/zeloTemplate.ts`, `public/zelo/**` and `migrations/zelo/**`.

- Source: https://zelosistemas.com.br/ (home, `/contato`, `/privacidade`). Default dark theme only.
- Fonts: Plus Jakarta Sans 800 (hero), Nunito (UI and headings), Figtree (body), Spline Sans Mono (numbers, labels). The source root is `font-size: 80%`, so every value is already converted to px (1rem = 12.8px).
- Core colors: paper `#000000`, raised `#13201C`, band `#283933`, ink `#FFFFFF`, ink-soft `#A8A8A8`, green `#90B8A6`, green-2 `#BAD5C8`, line `#90B8A633`, line-strong `#90B8A661`, red `#E0897B`.
- Green is for labels, the highlighted headline word, icons and buttons. Never paint large areas green.
- Content is 1044px inside gutters of 38/29/15px; section rhythm 97/72/55px; radii 7/11/16/21/999px.
- Templates are native Elementor trees built with `src/features/zelo/elementor.ts`. Constrain reading width with `min(100%, Npx)`, never a fixed width. Every section root keeps `overflow-x: clip`.
- The only HTML widget is the ledger script in "A conta": it holds behavior only, all content is native.
- Motion stays inside `prefers-reduced-motion: no-preference`. Hover never carries essential content.
