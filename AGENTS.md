# Project instructions

## Working on a client page

Each Space project is a client. When the user asks to analyze or change a page, or to create, change or reorder a section, the deliverable is that change made in the project's page in the Space canvas (through `scripts/space/space.mjs`), not a new template. Follow `.claude/skills/cliente/SKILL.md`.

## Visual language

This repository contains multiple explicit brand scopes. Do not blend them.

### MSA — Marketing sem Agência model

Scope: `/msa-style-guide`, `/msa-elementor-preview`, `src/features/msa/**`, `src/features/space/msaTemplate.ts`, `brands/marketing-sem-agencia/**`, `public/brands/marketing-sem-agencia/**` and `migrations/msa/**`.

- Source: `https://marketingsemagencia.com.br/`; public founder context: `https://www.instagram.com/hzanotti/`. The public spelling is **Henrique Zanotti**; the user-written “Zanote” remains an explicit confirmation item.
- Sources of truth: `brands/marketing-sem-agencia/DESIGN.md` and `brands/marketing-sem-agencia/COPY.md`. Keep facts, brand claims, interpretations and open evidence gaps distinct.
- Fonts: local Syne for display and Urbanist for body/UI. Install through Elementor Custom Fonts or stable licensed URLs for WordPress portability.
- Core colors: paper `#F3EFE4`, ink `#2F2317`, muted `#61695B`, sage `#BED499`, soft `#E6E1D2` and white.
- Content is 1180px inside 32/24/20px gutters; section rhythm is 112/84/64px. Buttons are nearly square at 2px. Avoid generic gradients, glassmorphism and large shadows.
- Complex content goes in cards (the user asked for them): 2px radius, 1px structural border, no shadow. Tones `msa-card-light` (paper on soft), `msa-card-ink`, `msa-card-dark` (translucent on ink) and `msa-card-sage` for the one destination card. Lists inside cards use `msa-list-check` (sage square with a check) or `msa-list-dash`. Comparisons sit side by side and read top-down; never stack from the bottom up.
- The brand grammar is architectural: foundation, layers, rules, numbered stages and hand-off. Lines are straight; avoid orbital decoration and generic dashboards.
- Lead with positive internal capability. The enemy is dependency and improvisation, not every agency. “Marketing construtivo” is a working category until Henrique approves its definition.
- Do not present the award, Head-of-the-Year title, record revenue, agency-attention percentages or client results as verified facts until documentary evidence is supplied.
- Brand in the Space (2026-10-02, the client wants every section seen with it): `brands/marketing-sem-agencia/DESIGN.md` is saved and on in the MSA project. Its front matter holds only colors, font families (no weight, line-height or label role), the 2px button radius, the logo and the photo bank. Do not add label, card, divider, shadow or motion keys, and keep timings out of the body text (the reader turns them into motion): each one rewrites the pages. Applying it changes 0 settings in all 34 sections; keep it that way and diff `applyBrand` against every page before editing it.
- Logo: typographic lockup (Syne 800 “MSA” + Urbanist 600 descriptor at 0.16em), vector outlines in `public/brands/marketing-sem-agencia/logo/` (`msa-logo`, `-on-dark`, `msa-simbolo`, `-on-dark`, `msa-icone` for favicon/avatar). The pages keep the header and footer wordmarks as native text.
- Sales page (“MSA · Página de vendas” in the Space, 2026-10-02): its copy is Henrique's own (`COPY.md` › Sales page copy), with prices, the value stack, the guarantees, the agency model named as the problem and the B2B case behind his disclaimer. Keep his text; his pre-publication checklist is still open. Same visual language as the Homepage, plus a price card (ink, with the sage founder price as the one destination card) and comparison rows that keep each pair aligned.
- Photos: the seated portrait (from the public site, cropped to `henrique-retrato.jpg`) plus three stage photos the user supplied on 2026-09-29 (`henrique-palco.jpg`, `henrique-microfone.jpg`, `henrique-evento.jpg`, the last only 640px wide, so keep it small). Final publication still needs Henrique's confirmation of rights. Photos carry no captions (the user asked).
- Henrique section: espresso editorial. "HENRIQUE" solid and "ZANOTTI" as a filled ghost (paper at 28%; keep it filled, the user chose it; `text-stroke` shows the overlapping contours of the variable Syne), four photos in two offset columns and the quote, bio and spec card sticky beside them. The quote breaks as "Eu saio. / A máquina fica."
- Section titles run full width with one sentence per line (`<br>`); the supporting text sits below, right-aligned on desktop. The comparison cards carry "SEM A MSA" / "COM A MSA" tags.
- Templates are native Elementor trees. Content stays in native widgets; motion is progressive enhancement behind `prefers-reduced-motion`, and focus-visible states remain explicit.
- Motion is subtle, by the user's decision (a pinned scaffold story, a bottom-up comparison and a counter preloader were tried and rejected as complex): one behavior-only HTML widget, the first child of the hero, loads GSAP and ScrollTrigger from jsDelivr (`src/features/msa/story.ts`). Preloader: ink panel, MSA and a sage line filling, then the panel lifts. Hero items rise 14px and fade in; blocks marked `.msa-rise` rise 18px once as they enter, in batches; the footer wordmark drifts up slowly. No pins, no scrubbed stories, no word-by-word fills.
- The CSS alone is always the final composition; the script only arms `msa-pending`, `msa-loading` and the hidden reveal states. Reduced motion, no GSAP, the static preview, the Elementor editor (`elementor-editor-active`) and the Space canvas thumbnails run nothing (no preloader). Never put Elementor entrance animations on anything GSAP moves: their `fill-mode: both` overrides the transforms.
- Only the hero has a texture: a faint static planning grid. No diagonal lines (the user disliked them in the footer). The footer is structured (brand, navigation, contact, CTA) over a large MSA wordmark at 8% opacity; keep all footer text and links native.

### Superelements model (our own product page)

Scope: `src/features/superelements/**`, `brands/superelements/**`, `public/brands/superelements/**` and the "Superelements" project in the Space (created 2026-10-02).

- Our own product. Sources of truth: `brands/superelements/DESIGN.md` and `brands/superelements/COPY.md` (copy from the concept landing `src/pages/SuperElementsLanding.tsx`, with the open items). Never show prices, client names or numbers as facts; the demo project is the fictional Caramelo Pet on `caramelopet.exemplo`.
- The user asked for a tech style with Space Mono: Space Grotesk 600 for titles, Space Grotesk 400 for text, Space Mono for labels (`[ 02 ] Como funciona`), buttons, indexes and UI. The product screens use Inter, the app's font. The logo never uses mono (the user asked): the wordmark and the big footer mark are Space Grotesk 700.
- Site pages in the Space project: Home (`/inicio`), Produto (`/produto`), Preços (`/precos`), Agências (`/agencias`), Contato (`/contato`); the shared header and footer link them by slug (set with `space details`). Prices come from `src/features/superelements/plans.ts` (R$ 89 / 179 / 349, confirmed by the user on 2026-10-02).
- Titles keep one sentence per line on desktop; on mobile the h2 `<br>` is hidden, so `heading()` always puts a space before `<br>`.
- Core colors: ink `#09090B`, raised `#111114`, white text `#F4F4F5` / `#A1A1AA`, canvas `#F4F4F5`, white, light line `#E4E4E7`, lime `#D2F525` (hover `#DDFA47`) from the logo. Lime only on what you click and on small marks; never lime text on light. Inside the screens the app colors stay (violet `#8B5CF6` selection, `#D97757` agent, emerald published, Tailwind grays).
- Content 1240px inside 32/24/16px gutters; sections 128/96/72px. Buttons 8px, cards 12–16px, windows 16px. No shadows outside the screens. The only texture is the canvas dot grid (24px).
- The user asked to show the real product: the Space window, toolbar, library, page frame with the Caramelo Pet section photos, Claude panel and publish dialog are native containers copied from the app (`src/features/superelements/screens.ts`). Keep labels, icons and measures faithful to the app.
- Motion (`src/features/superelements/story.ts`, one behavior-only HTML widget, first child of the hero): the scroll drives a publish. The window arrives tilted and settles, pins, the camera zooms into "Publicar no site" with a spotlight, the large cursor (38px, the user asked for it bigger) arcs in, the button lights up and the click releases two lime rings; the real publish dialog grows out of the button, runs its steps with a progress bar, and the page frame flashes lime and gets "No site". A mono ruler under the window lights the four steps. Reversible; no pin below 1025px, where a short sequence plays once. Containers here have no CSS `transform` transition (Elementor's 0.4s made the window slide at the pin end, the bug the user reported): keep `transition-property` without transform in `BASE_CSS`.
- Brand in the Space stays saved but **off**: applying it recolors and refonts the product screens (804 changes in 11 sections on 2026-10-02). Build the pages in the brand instead.
- The engine's hosted video now honors Elementor's autoplay, mute, loop and controls (the 3D symbol in the final CTA).

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
- WhatsApp float (`makeWhatsApp`): fixed bottom-right, z-index 900 (under the modal), WhatsApp green only on the icon circle. It is the one element with a shadow, because it floats over both navy and white. It opens the WhatsApp chat directly (new tab), not the modal. The real contact data (WhatsApp `GIAN_WHATSAPP`, form inbox `CONTACT_EMAIL`, Instagram) sits at the top of the contato block in `processbaseTemplate.ts` and in `brands/processbase/COPY.md` §13d. Never invent contact data: the LinkedIn is still missing.
- Every "Agendar diagnóstico" link points to `#contato`; the modal script intercepts those clicks and opens `#agendar-diagnostico` (last section). Without JS the link still scrolls to the open form at the bottom, which stays for people who never click. The two forms use different field ids (`modal_` prefix).

### Inpel model

Scope: `/inpel-elementor-preview`, `src/features/inpel/**`, `src/features/space/inpelTemplate.ts`, `brands/inpel/**`, `public/inpel/**` and `migrations/inpel/**`.

- Source: https://www.inpel.com.br/ (Vue app on the Bootstrap 3 "Electro" theme). Texts, products and posts come from its public API into `src/features/inpel/content.ts`; do not retype them from screenshots. Record in `migrations/inpel/`.
- Font: Montserrat 400/500/700 only (the source asks for 800 but never loads it).
- Core colors: red `#D10024` (hover `#A8001D`), ink `#2B2D42`, body `#333333`, muted `#8D99AE`, line `#E4E7ED`, mist `#FBFBFC`, bar `#1E1F29`, footer `#15161D`, footer text `#B9BABC`. One red only; no gradients.
- Content is 1140px with 15px gutters; sections have 30px top and bottom; grids use a 30px gutter. The header switches to the mobile bar below 992px with custom CSS, like Bootstrap.
- Shapes are square (cards, images, fields, social icons); only the search and the red buttons use the 40px pill. The highlight cards keep the two red bands skewed −45° at 90% opacity.
- Cards: 1px `#E4E7ED` outline that becomes a 2px red outline on hover. No other shadows.
- Motion stays at the source level: 0.2s color and underline on links, 1.1 zoom on highlight photos, all behind `prefers-reduced-motion`.
- Templates are native Elementor trees built with `src/features/inpel/elementor.ts`. Zero HTML widgets: the mobile menu is a nested accordion, the search is `search-form`, the rating is a radio group drawn as stars.
- The import is faithful on purpose, errors included (see "Improvements found" in `migrations/inpel/MIGRATION.md`). Fix them as improvements, one at a time, and update the record.

### Caramelo Pet model (petshop example)

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

### Júnior Automáticos model

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

### Leo Scherer model

Scope: `/leoscherer-style-guide`, `/leoscherer-elementor-preview`, `/leoscherer-redesign`, `/leoscherer-redesign-proposta`, `src/features/leoscherer/**`, `src/features/space/leoschererTemplate.ts`, `src/pages/LeoSchererRedesign*`, `public/leoscherer/**`, `migrations/leoscherer/**`, `brands/leo-scherer/**`, `public/brands/leo-scherer/**` and the "Leo Scherer" project in the Space.

New version in the Space (2026-10-02, "Home" page; "Site atual (importado)" is the faithful reference): same brand and logo, organized as an Apple-standard editorial showcase. Sources of truth: `brands/leo-scherer/DESIGN.md` and `brands/leo-scherer/COPY.md` (site and Instagram facts, open items). Builders: `src/features/leoscherer/redesign.ts` and `story.ts`; section build files in `.space/leo-scherer/build/home/`.

- Contact and purchase go to Instagram @leooscherer, as on the site (no WhatsApp on record). "Simule" and "Inscreva-se" use the site's Elementor popup links (ids 2432, 9064, 3993); they only work published on the LS WordPress.
- Helvetica only; content 1200px inside 32/24/16px gutters; sections 120/88/64px; pill buttons; cards 20–24px. Red `#FF0000` only for the dot before "Simule" and small labels on dark. One light band: "Em destaque" (white, product photos multiplied on `#F5F5F7` frames).
- Backgrounds (the user asked for dots and soft lights, Apple elegance): each section has a native `.ls-bg` layer with a masked 24px dot grid and two or three heavily blurred lights. Keep the lights soft: the user found the blue too strong (2026-10-02). Never name a container class `ls-light` (it is the light).
- Hero (the user asked for a phone animation): centered copy over the iPhone 18 Pro pair; the phone rises tilted in 3D and settles, a glint masked by the phone's own image sweeps it, and on desktop the hero pins briefly while the copy leaves and the phone grows to the center. Official Apple images with black backgrounds are converted to transparent PNGs; never use `mix-blend-mode` on a stage GSAP moves (it showed a border under the pin).
- Hover only on the featured products (the user's decision): the image itself zooms inside its frame and "Ver produto" appears; the frame never turns white (scaling the wrapper isolates the multiply). No hover effects on the other cards.
- "Novos e seminovos" cards put the phone beside the copy (on top on mobile), never below it (the user disliked it).
- More buttons (the user asked, 2026-10-03): cards and tiles use small outline pill buttons with an arrow (`cta()` in `redesign.ts`), not text links. On the Watch photo tile the button gets a dark translucent backing.
- Inner pages as examples (2026-10-03): "Categoria · iPhones novos" (dark hero with breadcrumb, lineup and category pills, white product grid) and "Produto · MacBook Neo", which is light by the user's request (white and `#F5F5F7` bands, black and outline buttons; only the header and footer stay black). Product cards everywhere use `productCard()` + `PRODUCT_CARD_CSS`, with the featured-products hover. Products, prices and colors are static text from the site; in WordPress they become WooCommerce templates.
- Instagram photos are 360×640 post covers: keep them small (mosaic, service cards, JBL tile) until the client sends originals and confirms use.
- The brand is saved in the Space but off: applying it recolors the light band and labels (157 changes on 2026-10-02).

- Source: https://leoscherer.com.br/ (WordPress + WooCommerce + Elementor). The public sitemap contains 2,094 product URLs and nine product categories, represented by home, category and product template families.
- Fonts measured from the source: Helvetica for display/editorial text, Source Sans Pro for Storefront body copy and Inter only in the agency credit. Helvetica has no transported font file; use `Helvetica, Arial, sans-serif` and document the destination fallback.
- Core colors: canvas `#000000`, raised `#101010`, hero navy `#151C25`, paper `#FFFFFF`, theme body `#6D6D6D`, soft `#B6B6B6`, WooCommerce purple `#7F54B3`, action blue `#6EC1E4`, signal red `#FF0000`.
- Desktop content is approximately 1120px with 20px gutters; tablet changes at 1024px and mobile at 767px. Mobile gutters are 16px.
- Hero type is 52/52px weight 600 on desktop; Watch and story headings are 40/40px; the immersive statement is 75/75px. Body follows the source's 16/25.888px Source Sans Pro rhythm.
- The language is a black editorial stage: isolated product renders, long negative-space bands, one white AirPods band and sparse blue/red accents. Do not turn it into a generic rounded ecommerce grid, bright SaaS page or glass interface.
- Gradients are source-derived radials only: `#151C25` to `#010101` in hero/history and `#0B1B33` to `#00040A`/black in financing. Radii and shadows are rare.
- Assets are local under `/leoscherer/assets`; do not hotlink uploads or copy analytics, pixels, WooCommerce sessions, cart, checkout, payment or account scripts.
- Templates are native Elementor trees. Search, gallery, video and newsletter use supported widgets; the newsletter has no destination action until configured in the target WordPress.
- Hover never carries essential content. Controls scale to 0.96 on press; motion is guarded by `prefers-reduced-motion`.
