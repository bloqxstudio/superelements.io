# Inpel → Elementor nativo

Source: https://www.inpel.com.br/
Target: 13 Superelements landing templates in native Elementor containers/widgets, validated at `/inpel-elementor-preview`.
Brand for the project: `brands/inpel/DESIGN.md` (listed in the Space brand examples).

The root `MIGRATION.md` belongs to the UGLYCASH model; this folder is the Inpel record.

## Status

- `survey`: done (2026-09-27)
- `design-system`: done (`src/features/inpel/tokens.ts`, `brands/inpel/DESIGN.md`)
- `content`: read from the site's public API into `src/features/inpel/content.ts`
- all 13 templates: native, renderer clean, checked at 1440/1024/768/390px

## Survey

Vue 2 single-page app (Bootstrap 3 + the "Electro" e-commerce theme) served by IIS. Every text and image comes from a small CMS API at `https://controle.inpel.com.br/api` (`institucional/telas/<tela>`, `SegmentoProdNivel1`, `Produto/segmentoprodnivel1/<id>`, `produto/<id>`, `MontaPeca/Produto/<id>`). The app sorts and filters the API data itself: slider by `ordem` descending, highlights by `ordem`, posts by `data1` descending, only `visivel` items.

### Page inventory → templates

| Template id | Source URLs | Notes |
|---|---|---|
| `inpel-home` | `/` | slider (7), 3 red-band highlights, carousel of the 21 applications, 5 latest posts, social row |
| `inpel-sobre` | `/sobre` | text + factory photo, YouTube video, 2 PDF downloads, 8 partner logos |
| `inpel-caixas` | `/segmentos` | categories column + grid of the 21 applications |
| `inpel-produtos` | `/produtos/:id/:segmento` | one application (Roçadeiras, 5 models) with red tags |
| `inpel-produto` | `/produtoDetalhe/:id/:nome` | CT-145: gallery, PDFs, application, description, "Monte a sua caixa" |
| `inpel-blog` | `/blog` | grid of the visible posts |
| `inpel-post` | `/blogDetalhe/:id/:nome` | "Recorde de colheita" as the representative post |
| `inpel-contato` | `/contato` | WhatsApp, e-mail, form, Google map |
| `inpel-sugestoes` | `/sugestoes` | 1–10 rating, message, optional contact |
| `inpel-lgpd-194…197` | `/InformacoesLgpd/:id/:nome` | Termos de Uso, Política de Privacidade, Política Cookies, Código de Ética |

Out of scope (app features, not pages): `/login`, `/novaConta*`, `/meus*`, `/carrinho`, `/comprovantePgto`, `/pedidoRealizado` (account, quote cart and PagSeguro/Yapay checkout), product search results (`/produtos/:texto`).

### Shared regions

- Desktop header (≥992px): 3px red top line, 40px dark bar (phone, e-mail, address, Google Translate, "Orçamento" cart), logo 225×100, pill search (input + red "Pesquisar"), 7 links with a red underline that grows on hover, 2px bottom line.
- Mobile header (<992px): grey Bootstrap "Menu" button (opens a sidebar) + logo 180×80.
- Footer: 4 columns on `#15161D`, credit bar `#1E1F29` with the Avance Digital mark.
- Fixed "Atendimento via WhatsApp" image bottom-left; Yeastar live-chat bubble bottom-right.

## Visual system (computed values at 1440px)

- Colors: red `#D10024`, ink `#2B2D42`, body `#333333`, muted `#8D99AE`, line `#E4E7ED`, breadcrumb band `#FBFBFC`, top bar `#1E1F29`, footer `#15161D`, footer text `#B9BABC`.
- Font: Montserrat 400/500/700 from Google Fonts. Some headings ask for 800, which is not loaded and renders as 700; the templates use 700.
- Type: section titles 24/26.4 700 (`CAIXAS DE TRANSMISSÃO` 25px caps); highlight titles 24/700 white; body 14/20; top bar and breadcrumb 12/500; card category 12 caps muted; card name 14/500 caps; post titles 18/500; footer titles 18/700 caps.
- Layout: `.container` 1170px with 15px columns → 1140px content; `.section` padding 30px; grid gutter 30px.
- Highlights: 360×253 image with two `#D10024` bands at 90% opacity skewed −45°, text over them, image zooms 1.1 on hover.
- Product card: 1px `#E4E7ED` outline that turns into a 2px red outline on hover.
- Breakpoints: Bootstrap 3 (768 / 992 / 1200), plus `.col-xs-6` → 100% below 481px.

## Decisions

- Content comes from the API, not from screenshots: `content.ts` keeps visible items in the site's order. HTML from the CMS is kept, with inline black color spans and the zero-width BOM characters removed.
- Header: native containers; the mobile "Menu" is a native nested accordion (dropdown under the bar instead of a sidebar). The desktop/mobile switch is custom CSS at 992px, like the source.
- Search: Elementor Pro `search-form` (classic skin). The renderer did not support it; added to `src/engine/elementor/widgets/pro.ts`. It searches WordPress (`?s=`), not the old catalog API.
- Carousels: Elementor Pro nested carousel (slider 1 per view with autoplay 5s; applications 4/3/1; partners 6/4/2).
- "Monte a sua caixa": the construction table is an image; the five dependent dropdowns become a native form (5 selects + hidden product field) that e-mails `vendas@inpel.com.br`. The rule "choose in order" and the per-combination drawing are not reproduced.
- Rating on "Reclamações/Sugestões": a native radio group 1–10 drawn as stars with CSS (keyboard works, `:has()` lights the stars).
- Gallery thumbnails open the full image in the Elementor lightbox instead of swapping the main image.
- "Selecione Idioma" (Google Translate) and the Yeastar chat are not reproduced. "Orçamento" points to `/contato`.
- Copy kept as published, including the "Útimos Posts" typo and the "EMAIL AQUI" placeholder in the privacy policy (see improvements).

## Assets

59 files in `public/inpel/assets/` (13 MB), downloaded from `controle.inpel.com.br/imagens` and `www.inpel.com.br/img`: brand (logo, favicon, WhatsApp badge, agency mark), slider (7), highlights (3), applications (21), blog (5), about (3), partners (8), products (Roçadeiras list + CT-145 gallery and construction table). All are discoverable by `collectImageUrls` and uploaded by the WordPress publish flow.

Links that stay external: PDFs of the CT-145 (`controle.inpel.com.br/imagens/ProdutoPremio/*.pdf`), the SharePoint quality downloads and product manual, the careers portal (Pandapé), YouTube, Google Maps.

## Improvements found during the survey (next phase)

Measured on the live site on 2026-09-27:

1. No `<title>` and no meta description; the content only exists after JavaScript runs (Vue SPA without server rendering), so search engines see an empty page.
2. The privacy policy tells people to write to "EMAIL AQUI" (placeholder never filled in).
3. Home heading "Útimos Posts" (should be "Últimos Posts").
4. Horizontal scroll on phones: the page is 418px wide at a 390px viewport.
5. Slider text is baked into 0.4–1 MB PNGs at 1315×530, stretched to 1440px: heavy, blurry on large screens, unreadable on phones, invisible to search and screen readers.
6. 38 of the 43 images on the home have an empty `alt` (logo, slider, applications, posts).
7. Post links on the home and blog are `href="#"` (navigation only through JavaScript); top-bar phone and e-mail are `href="#"` instead of `tel:`/`mailto:`.
8. Muted grey `#8D99AE` on white (card categories, breadcrumb) is 2.9:1, below WCAG AA for 12px text.
9. Headings request Montserrat 800, which is never loaded.
10. The API still stores the old careers link (`http://gestao.inpel.net.br:8181/TrabalheConosco/`) while the site shows Pandapé.

## Needs you

- WordPress pages with slugs `/sobre`, `/segmentos`, `/contato`, `/blog`, `/sugestoes` so the header and footer links resolve; product and post URLs depend on how the catalog will live in WordPress (pages, a custom post type or WooCommerce).
- Form actions (recipient, anti-spam) for Contato, Sugestões and the CT-145 quote.
- Decide the future of the quote cart, account area and checkout, which have no Elementor equivalent.
