# MSA — Marketing sem Agência

Source: https://marketingsemagencia.com.br/

Instagram supplied by the client: https://www.instagram.com/hzanotti/

Survey date: 2026-09-29

## Status

- `doing`: Nothing. Homepage V4 is ready for stakeholder review.
- `done`: Phase 0 survey; brand foundation and style guide; Homepage V4 (2026-09-29): nine native sections rebuilt around the building-site grammar, a branded preloader, GSAP + ScrollTrigger + SplitText motion with a static final state; validated at 1440, 1024 and 390px, with reduced motion and without JavaScript.
- `notDone`: Stakeholder approval, the production qualification form and privacy flow, Elementor export and publication.

## Homepage V4 (2026-09-29)

Why V3 broke: Elementor entrance animations (`fadeInUp`, `fill-mode: both`) sat on the same layers and stages GSAP moved, so their final `transform: none` cancelled the scroll story while a 920px pin ran over a static block. The pin also had no guard for the Space's auto-height iframes, and the footer used `100dvh`, which the engine does not convert.

First V4 pass (same day, rejected): a building-site story with a counter preloader, a bottom-up "rented vs built cycles" ledger, a pinned Método with floors and a scaffold, word-by-word fills and diagonal textures. The user found it broken in places, hard to read and too complex, and asked for subtler motion and cards.

What V4 is now, section by section (`src/features/space/msaTemplate.ts`, motion in `src/features/msa/story.ts`):

1. Preloader inside the hero: ink panel, MSA and a sage line filling, then the panel lifts.
2. Hero: full-width headline; the System MSA card read top-down (01 Direção to 04 Autonomia in sage).
3. O que muda: two cards side by side, Dependência (paper, dash list) × Capacidade (ink, check list).
4. Método: four stage cards; each has four ticks at the top and lights its own; Autonomia is the sage card.
5. Programa: three phase cards sized by months (2/4/3), then six deliverable cards.
6. Henrique: portrait and the quote "Eu saio. A máquina fica."
7. Para quem faz sentido: three criterion cards with a sage check.
8. FAQ: native nested accordion with a drawn plus/minus and CSS-counter numbers.
9. Próximo passo: one ink card with the CTA and three step cards. Footer: brand, navigation, contact and CTA over an 8% MSA wordmark; no diagonal lines.

Motion: hero items and `.msa-rise` blocks rise and fade in once; only the footer wordmark moves with the scroll. No pins.

Native tree: 9 sections, 1 behavior-only HTML widget (first child of the hero), 1 nested accordion, 98 headings, 39 text widgets, 5 buttons, 1 local image. Engine report: 0 unsupported widgets, 0 warnings. Checked at 1440, 1024 and 390px, with reduced motion, without JavaScript, reloading mid-page and in the real `/msa-elementor-preview` route in both modes.

## Homepage V3 Motion validation (superseded)

- Preview: `/msa-elementor-preview`.
- Style guide: `/msa-style-guide`.
- Native tree: 9 sections, 76 containers, 100 headings, 38 text widgets, 4 buttons, 1 local image and 1 behavior-only HTML widget.
- Compatibility: 1 documented HTML exception, 0 unsupported widgets, 0 warnings, 0 duplicate IDs and 0 sections without a container.
- Responsive check: desktop, 1024px, 768px and 390px with no horizontal overflow or cropped headings; portrait loaded at its native 5464 × 8192 resolution.
- Motion check: GSAP and ScrollTrigger loaded from jsDelivr; one desktop pin spacer created; layer progress changed with scroll; mobile created no pin spacer; static preview loaded no GSAP.

### Documented HTML exception

The single HTML widget in the hero contains only the inline controller from `src/features/msa/story.ts`. All headings, copy, images, links, backgrounds and layout remain native Elementor nodes. The controller loads GSAP 3.13 and ScrollTrigger from jsDelivr, respects reduced motion, and fails to the complete static state when the CDN is unavailable.

## Product shape

The public site is currently a one-page brochure and application funnel. It presents one offer rather than a collection of products.

### Template families found

1. Marketing homepage / application page
   - Source: `https://marketingsemagencia.com.br/`
   - Regions: sticky navigation, hero, three-phase method, agency-model comparison, program deliverables, statement band, Henrique profile, application form, FAQ and footer.
2. Qualification form
   - Source: `https://msaforms.netlify.app/`
   - Seven-question qualification flow with a Google Apps Script / Google Sheets destination.
3. Privacy page
   - Mentioned in the footer, but no working public link was detected.

No blog, case-study collection, account area, checkout or additional public page template was found.

## Shared regions and navigation

- Sticky header with MSA wordmark, anchor navigation and one application CTA.
- Anchor targets: method, problem, program, team and FAQ.
- Footer repeats those anchors, Instagram and application CTA.
- The main CTA opens the external qualification form.

## Measured visual system

These values came from rendered computed styles and the source document, not screenshot sampling.

- Display font: Syne, embedded as WOFF2 data in the current bundle.
- Body/UI font: Urbanist, embedded as WOFF2 data in the current bundle.
- Paper: `#F3EFE4`.
- Ink / dark band: `#2F2317`.
- Sage accent: `#BED499`.
- Muted olive-grey: `#61695B`.
- Soft supporting surface: `#E6E1D2`.
- Desktop content width: `1180px`.
- Desktop gutters: `32px`.
- Mobile gutters below `640px`: `20px`.
- Source breakpoints: `900px` and `640px`.
- Desktop hero heading: `92px / 1.02`, Syne 700, `-0.015em` tracking.
- Section headings: usually `54px / 1.08`, Syne 700, uppercase.
- Body copy: Urbanist, generally `17–19px`, weight 300–400, line-height around `1.6–1.65`.
- Large section rhythm: `104–120px`; statement band `96px`.
- Buttons and authored panels are nearly square: `2px` button radius and mostly square frames.
- Borders use translucent ink or paper; shadows are effectively absent.
- Motion is restrained: short color transitions and accordion-state motion. Essential information is not hover-only.

## Brand voice and positioning

### Publicly observable

- Instagram identifies the founder as **Henrique Zanotti** and the public bio says he helps companies stop depending on agencies and builds their own marketing operations.
- The offer is an implementation program: six months of implementation plus three months of follow-up.
- The method is presented in three stages: diagnosis and direction, construction, and consolidation.
- Explicit fit constraint: companies that sell through an Inside Sales operation.

### Brand claims requiring proof before prominent use

- “Head de Operações do Ano”.
- “Maior assessoria de marketing do país”.
- Team with the highest revenue and retention.
- Two operated companies reaching record revenue.
- A precise percentage of agency attention or a fixed number of accounts per analyst.
- “Prêmio Jovem Empresário 2023” currently has a public self-authored post, but the awarding institution, category and official record still need confirmation.

### Editorial direction for the first build

- Lead with internal capability and construction, not an indiscriminate attack on every agency.
- Preserve “Marketing não se aluga, se constrói.” as the strongest current line.
- Use “Eu saio. A máquina fica.” as founder-led proof of the model, with appropriate scope conditions.
- Present Henrique as an operator who transfers capability, using one verified credential at a time.
- Treat “marketing construtivo” as a proposed category until Henrique confirms its official definition.

## Audience

Explicit signals point to owners, partners, directors and managers of companies that sell through Inside Sales and are willing to build or reorganize an internal marketing team. The likely primary audience is a B2B operator with a functioning commercial motion, decision authority and budget for people, software and implementation. Revenue minimum, team size, ticket and maturity threshold are not stated and must not be invented.

## Assets

- Current homepage contains an embedded portrait with alt text “Henrique Zanotti”.
- Instagram exposes a public profile image and public post thumbnails, but those should be treated as research references rather than final licensed assets.
- Final launch should use original high-resolution photos supplied or explicitly authorized by Henrique.
- Current fonts are embedded in the source bundle. For portability, they need locally extracted files with a clear license/source record or Elementor Custom Fonts configuration.

## Dynamic and external behavior

- The homepage form opens `msaforms.netlify.app` and forwards personal data through URL query parameters.
- The external form posts client-side to Google Apps Script / Google Sheets and stores answers in local storage.
- No CRM, scheduling integration or server-side success verification is publicly visible.
- The homepage and external form use inconsistent revenue ranges and ask different qualification questions.

## Cannot come across automatically

- Google Apps Script / Google Sheets write behavior will not be copied into the first native Elementor draft.
- No private CRM, automation, analytics, award record or confidential case data can be inferred from the public pages.
- Instagram photos will not be treated as final reusable client assets without authorization or originals.
- The current embedded font data is not automatically portable to another WordPress domain.

## Needs the client

1. Confirm the correct surname spelling. Public sources consistently use **Zanotti**.
2. Confirm the official definition and ownership of “marketing construtivo”.
3. Supply original portrait/lifestyle photos and usage authorization.
4. Supply the prize name, awarding entity, category, year and official evidence.
5. Supply two publishable cases with baseline, period, investment, result definition and client permission.
6. Decide where qualification submissions should go in production and approve a privacy/LGPD flow.
7. Confirm whether the offer should be described as six months or as a nine-month relationship (six implementation + three follow-up).

## Improvement opportunities found

- Unify the embedded and external qualification experiences.
- Do not place name, email, WhatsApp or company data in query strings.
- Add a real privacy-policy link and consent language.
- Reconcile qualification ranges and “2 minutes” versus “under 3 minutes”.
- Replace absolute anti-agency claims with precise statements about the dependency pattern the MSA solves.
- Attach evidence and conditions to awards, revenue and performance claims.
