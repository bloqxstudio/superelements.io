---
name: MSA — Marketing sem Agência
slug: msa
source: https://marketingsemagencia.com.br/
fonts:
  display: Syne
  body: Urbanist
colors:
  paper: "#F3EFE4"
  ink: "#2F2317"
  muted: "#61695B"
  sage: "#BED499"
  soft: "#E6E1D2"
  white: "#FFFFFF"
layout:
  content: 1180
  gutterDesktop: 32
  gutterTablet: 24
  gutterMobile: 20
  sectionDesktop: 112
  sectionTablet: 84
  sectionMobile: 64
radius:
  button: 2
  panel: 0
motion:
  duration: 520
  easing: cubic-bezier(.22,1,.36,1)
---

# MSA visual system

This file records the measured source system and the art direction for the first native Elementor slice.

## 1. Visual idea

The MSA should feel like an operating system being assembled, not like an ad agency portfolio and not like an AI SaaS product. Its material language is editorial and architectural: warm paper, dark espresso ink, a dry sage accent, technical rules, numbered stages and generous negative space.

The first slice evolves the source without replacing its identity. It adds a visible construction grammar — foundations, layers and hand-off — while preserving the measured palette, typography and mostly square geometry.

## 2. Typography

- Display: Syne 700–800. Use uppercase for major statements and titles, with tight tracking and line-height around 1.02–1.08.
- Body/UI: Urbanist 300–600. Use 17–19px for primary reading copy and 12px tracked uppercase for labels.
- Local transported files:
  - `/brands/marketing-sem-agencia/assets/fonts/syne-latin.woff2`
  - `/brands/marketing-sem-agencia/assets/fonts/urbanist-latin.woff2`
- WordPress destination: install these through Elementor Custom Fonts or replace them with licensed stable font URLs. Local preview URLs alone are not portable.

## 3. Color roles

- Paper `#F3EFE4`: primary canvas.
- Ink `#2F2317`: display text, dark sections and primary actions.
- Muted `#61695B`: supporting text and system labels.
- Sage `#BED499`: construction progress, small marks and selected states.
- Soft `#E6E1D2`: secondary surfaces and image placeholders.
- White `#FFFFFF`: used sparingly for high-contrast text where necessary.

Sage is an accent, not a default page background. Ink and paper create the main alternation.

## 4. Layout and shapes

- Content width: 1180px.
- Gutters: 32px desktop, 24px tablet, 20px mobile.
- Section rhythm: 112 / 84 / 64px.
- Source breakpoints: 900px and 640px. The local renderer also receives explicit Elementor tablet/mobile values.
- Buttons stay rectangular with 2px radius.
- Cards carry complex content: 2px radius, 1px structural border, no shadow. Paper cards on soft sections, translucent cards on ink, one sage card for the destination (Autonomia, Acompanhamento). No glassmorphism or ambient shadows.
- Comparisons are side by side and read top-down. Sequences read left to right or top to bottom, never from the bottom up.
- Use rules, numbering and structural blocks instead of decorative blobs.

## 5. Construction grammar

The visual metaphor is a system assembled in layers:

1. Direção — diagnose the business and choose a route.
2. Pessoas — define roles and install the team.
3. Processo — create routines, tools and documentation.
4. Autonomia — transfer governance so the structure remains.

Lines should be straight. Motion can reveal, align or fill blocks; it should never orbit or float aimlessly.

## 6. Imagery

- Current authorized status: the portrait was extracted from the public site bundle and is suitable for a local working draft.
- Final publication still needs confirmation of rights and the original supplied by Henrique.
- Use portraits with neutral environments, direct eye contact and visible working context. Stage and microphone images can support authority only after original files and permission are supplied.
- Avoid generic teams around laptops, fake dashboards and AI-generated office scenes.

## 7. Motion

Motion is quiet. It runs only with `prefers-reduced-motion: no-preference`, and the static page is always complete.

- **Entry**: ink panel with the MSA mark; a thin sage line fills while the page loads, then the panel lifts over the hero (about 2s in total).
- **Reveal**: content rises 14–18px and fades in, once, 0.8s `power2.out`, with 70–80ms between neighbours. Cards in a row enter in sequence.
- **Scroll**: only the footer wordmark drifts up slowly. No pins, scrubbed stories or word-by-word fills: they were tried in V4 and rejected as complex.
- **Controls**: 180–240ms color changes, arrow nudge on buttons, press scale 0.96.

Do not animate layout properties. Use transform, opacity, clip-path and background/color changes only.

## 8. Accessibility

- Keep explicit focus-visible outlines.
- Pressable controls scale to 0.96 only when motion is allowed.
- Do not remove input outlines without a replacement.
- Hover is never required to reveal meaning.
- At 390px every authored width must resolve through `min(100%, Npx)` or a responsive grid.

