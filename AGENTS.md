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

### ProcessBase model

Scope: `/processbase-elementor-preview`, `src/features/processbase/**`, `src/features/space/processbaseTemplate.ts`, `src/features/space/processbaseGraph.ts`, `brands/processbase/**` and `public/brands/processbase/**`.

- Source of truth: `brands/processbase/DESIGN.md` (tokens from processbase.fig) and `brands/processbase/COPY.md` (copy from the client vault, with sources and open items).
- Font: Inter only, headings at weight 400 with tight line-height and negative tracking. Lexend Deca lives only inside the logo files.
- Headline highlight (`hl()` in `src/features/processbase/elementor.ts`, as in the hero): one key phrase per headline in semibold 600, slate `#829AAF` on navy, slate-ink `#5F7A91` on light (the plain slate fails contrast on white), weight only on the orange card. Prefer highlighting the whole last line so a line break never splits it.
- Core colors: navy `#171A2C`, navy raised `#1E2237`, orange `#FF5900`, slate `#829AAF`, white, mist `#F2F3F5`, body `#5E6472`, border `#C9CCD3`. Text on orange buttons is white semibold with the arrow icon (`ARROW`, Font Awesome) and hover `#E24E00`: the user chose it knowing it is 3.1:1, below AA for small text. Do not switch back to navy text without asking.
- One orange accent per screen. Orange is never a background block: it lives in CTAs, small marks and the lit emblem. The contact block is navy with square corners (the orange version failed contrast).
- Cards use the double frame (6px shell + core with 16px radius, panel head with label and tag). No shadows: depth comes from navy against white.
- Section order: navbar, hero + pillar cards, o que muda, como funciona, o que fica, especialista, FAQ, form, footer. Tones alternate navy, white, mist, navy, white, mist, white, navy. No background color transitions between sections (tried and removed by the user): each section always shows its own color. The logo story stays reversible: formation, turn, fills and legend go back and forth with the scroll.
- Textures come from the library backgrounds (`src/features/section-pack/decorativeBackgroundPresets.ts`) adapted to the brand through `texture` in `src/features/processbase/elementor.ts`: dots, grid, grain, glow, plus the 2:1 hatch from the emblem cuts. Nothing behind the logo. Always masked and faint; no orbital circles (no curves as decoration).
- The navbar is the one glass surface, by the user's request: navy at 82% with backdrop blur, overlapping the hero (negative margin), solid navy where blur is unsupported. Below 82% it turns gray over the white sections.
- Small labels on light backgrounds are navy with an orange bar in front, because orange text fails contrast at small sizes.
- Diagonals follow the emblem: 2:1 cuts (about 63°) or 45° chamfers. No curves or waves as decoration.
- Hover only changes color. Motion is a short entrance, plus the one scroll story in the first section: the hero graph flows into the flat emblem, the emblem turns into a 3D block in 2:1 isometry, then the pillar cards stack and fill its pieces in orange (GSAP ScrollTrigger from jsDelivr, `src/features/processbase/story.ts`). Every rule stays behind `prefers-reduced-motion`, and without GSAP the page shows the final state.
- Templates are native Elementor trees built with `src/features/processbase/elementor.ts`. The only HTML widgets are the mobile menu, the hero sky (graph canvas plus the story script), the emblem block canvas (`src/features/processbase/emblem3d.ts`) and the diagnosis modal's close button plus behavior (`src/features/processbase/modal.ts`); the legend, the cards, the modal content and all text stay native.
- WhatsApp float (`makeWhatsApp`): fixed bottom-right, z-index 900 (under the modal), WhatsApp green only on the icon circle. It is the one element with a shadow, because it floats over both navy and white. The number lives in `GIAN_WHATSAPP`; while empty it links to `#contato` (opens the modal). Never invent a number.
- Every "Agendar diagnóstico" link points to `#contato`; the modal script intercepts those clicks and opens `#agendar-diagnostico` (last section). Without JS the link still scrolls to the open form at the bottom, which stays for people who never click. The two forms use different field ids (`modal_` prefix).
