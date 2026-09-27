# Zelo → Elementor nativo

Source: https://zelosistemas.com.br/
Target: three Superelements landing templates in native Elementor containers/widgets, validated at `/zelo-elementor-preview`.
Style guide: `/zelo-style-guide`.

The root `MIGRATION.md` belongs to the UGLYCASH model; this folder is the Zelo record.

## Status

- `survey`: done (2026-09-26)
- `design-system`: done
- `home`: native Elementor template, verified at 1440/1024/768/390px
- `contato`: native Elementor template, verified
- `privacidade`: native Elementor template, verified

## Survey

Hand-written static site (no CMS, no builder) served by Cloudflare. Dark theme is the default; a sun/moon button switches to a light theme stored in `localStorage`.

### Page inventory → templates

| Template | URLs | Notes |
|---|---|---|
| Home (one-page) | `/` | 11 regions, anchors `#servicos #agente #site #processo #duvidas #contato #conta` |
| Contato | `/contato` | invitation + form card, short footer |
| Legal | `/privacidade.html` | single 62ch column, short footer |

`/admin` is behind Cloudflare Access and out of scope. `sitemap.xml` lists only the three pages above.

### Shared regions

- Sticky header, 57px, `rgba(0,0,0,.88)` + `blur(10px)`, 1px bottom line. Wordmark PNG mask tinted with the brand green. Links hide on mobile.
  - home: 6 anchor links + filled "Agendar conversa"
  - contato: 5 links to `/#…` + ghost "Voltar ao site"
  - privacidade: wordmark + filled "Voltar ao site"
- Footer: full (home) or short centered (contato, privacidade), background `#13201C`.

### Home regions (source order)

1. Hero — Plus Jakarta Sans 800 headline with a rotating word (dinheiro ↔ tempo, 4.6s), two CTAs, particle-constellation canvas behind.
2. Movimento — dotted adoption curve drawn by the same canvas (`particulas.js`), rail label, heading, lede.
3. O problema — alert card with 3px green left border, 3 "leak" cards on a 1px grid.
4. A conta — interactive ledger (7 checkboxes, hours) + sticky total card with count-up and a WhatsApp link that carries the selection.
5. O que fazemos — intro split + 5 operations, each with an animated mini product screen (analysis list, monitoring bars, classifier chips, execution checklist, alert thread).
6. Agente de IA — floating bot illustration in the rail, "Protocolo" document card, WhatsApp phone image, 2×2 leak grid.
7. Site — laptop/phone image with halo, 6 bullet points.
8. Como funciona — 4 phases in a zig-zag with medallions and dotted connectors.
9. Dúvidas — heading + 6-item `<details>` accordion card.
10. Contato — contact lines + form card (backend + Cloudflare Turnstile).
11. Footer + floating "Zelo IA" chat launcher (Groq-backed).

## Visual system (computed values)

`html { font-size: 80% }` → 1rem = 12.8px. All values below are computed px at 1440px unless noted.

- Colors: paper `#000000`, raised `#13201C`, band `#283933`, ink `#FFFFFF`, ink-soft `#A8A8A8`, green `#90B8A6`, green-2 `#BAD5C8`, line `#90B8A6` @ 20%, line-strong `#90B8A6` @ 38%, red `#E0897B`, online `#3DD68C`. Headline highlight gradient `#51675D → #5F796E → #CFE2D9`.
- Fonts (all OFL, self-hosted by the source): Plus Jakarta Sans 800 (hero h1), Nunito 400–900 (UI, headings), Figtree 300–900 (body), Spline Sans Mono 400–600 (numbers, labels).
- Type: hero `clamp(30.72px, 4.96vw, 53.12px)`/1.0/-0.032em; section h2 `clamp(23.68px, 3.12vw, 34.56px)`/1.08/-0.032em Nunito 800; lede 14.46/1.62; body 12.8/1.62; rail labels 11.52/700; small labels 10.5/700.
- Layout: wrap 1120px incl. gutters `clamp(14.72px, 3.2vw, 38.4px)` → 1044px content. Section padding 97px desktop, ~67px at 900px, 55px mobile. Hero `min-height: calc(100svh - 57px)`.
- Radii: 7 / 11 / 16 / 21 / 999px. Shadow `0 1px 0 rgba(0,0,0,.25), 0 12px 32px -22px rgba(0,0,0,.85)`.
- Motion: headline shimmer 2.8s, word swap 4.6s, pulse dots 2s, medallion orbit 18–31s, button shine on hover, reveal on scroll. Everything is inside `prefers-reduced-motion: no-preference`.
- Source breakpoints: 900, 880, 800, 760, 720, 704, 700, 688, 624, 560, 460px. Most two-column grids collapse between 760 and 700px, which maps to Elementor mobile (≤767px).

## Assets

Stored in `public/zelo/assets/`:

- `whatsapp-agente.webp`, `site-responsivo.webp`, `og.png`, `favicon.png` (downloaded)
- `fonts/*.woff2` (downloaded, used by the style guide; Elementor uses the same families from Google Fonts)
- `zelo-wordmark.png` (the source mask tinted `#90B8A6`)
- generated SVGs: `hero-campo.svg`, `movimento-campo.svg`, `curva.svg`, `mon-barras.svg`, `fio.svg`, `selo.svg`, `bot.svg`, `icons/*.svg` (the source sprite, stroke `#90B8A6`)

## Dynamic behavior and integrations

| Source behavior | Elementor result |
|---|---|
| Particle canvas + curve (`particulas.js`) | static SVG images (constellation background, dotted curve) |
| Word swap in hero | CSS keyframes in the heading's scoped custom CSS, off with reduced motion |
| Ledger calculator | native rows + one script-only HTML widget (documented exception) |
| Operation mini-screens | native containers/headings in their final state; pulse dots animate with CSS |
| FAQ `<details>` | native `nested-accordion` |
| Contact form → backend + Turnstile + WhatsApp fallback | native Elementor Pro `form` widget; actions must be configured in WordPress |
| Theme toggle (light theme) | not reproduced: templates are the default dark theme |
| Zelo IA chat (Groq) | not reproduced |
| Scroll reveal, card mouse glow, reading progress bar | not reproduced |

## Cannot come across from the public site

- Contact backend, Cloudflare Turnstile and the admin panel.
- The Zelo IA conversation service.
- Light theme and its `localStorage` preference.

## Validation (2026-09-27)

Rendered by `renderElementorDocument` at `/zelo-elementor-preview`:

| Template | Sections | Containers | HTML widgets | Unsupported | Warnings | Duplicate IDs |
|---|---|---|---|---|---|---|
| home | 12 | 174 | 1 (ledger script) | 0 | 0 | 0 |
| contato | 3 | 17 | 0 | 0 | 0 | 0 |
| privacidade | 3 | 6 | 0 | 0 | 0 | 0 |

- Page height at 1440px: source 8740px, Elementor 8659px. Every section is within 4px except Contato (−59px: no Turnstile widget).
- No horizontal overflow at 1440, 1024, 768 or 390px; headlines break like the source (`text-wrap: balance`).
- Ledger: click, Space/Enter, `role="checkbox"`, total, days and the WhatsApp message all update. FAQ opens and closes.
- All 33 local image URLs are Elementor media objects, so the project media mapping can replace them.
- The skill validator (`validate-elementor-json.mjs`) passes contato and privacidade. On home it reports `html` and `nested-accordion` as unsupported because its hard-coded list predates the renderer; the renderer supports both.

## HTML widget exception

`Zelo · A conta` has one HTML widget containing only a script. It turns the native ledger rows into checkboxes and updates the native total, days and button. Without it the section still renders its default state (38h).
