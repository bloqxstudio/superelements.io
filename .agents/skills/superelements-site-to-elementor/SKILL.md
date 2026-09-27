---
name: superelements-site-to-elementor
description: Rebuild an entire website from a supplied URL as editable native Elementor templates inside the Superelements.io project. Use this skill whenever the user provides a website link and asks to clone, recreate, migrate, continue, or build the rest of the project in Elementor, even if they only say “faça essa página”, “para essa agora”, “leve para o Elementor”, or “construa o restante”. Survey the source, import assets, create native container/widget trees, register page templates, and verify the Elementor-rendered result. Never treat a React-only replica or a monolithic HTML widget as completion.
compatibility: Superelements.io React/Vite workspace with the local Elementor renderer and landing-template library.
---

# URL to native Elementor project

Turn a public website URL into a complete set of editable Elementor templates in `superelements-io`.

The visible page and the Elementor data are equally important. A visually accurate React route is useful as a reference, but the requested deliverable is the native Elementor tree that a user can edit after pasting it into WordPress.

## Required input

- A public source URL.
- The current Superelements.io checkout. Resolve the actual project root before editing.

Infer the site slug, brand name, page inventory, and template families from the source. Ask only when access, licensing, or an external integration creates a real decision.

## Definition of done

A project is complete only when:

1. The source was surveyed and grouped into page templates.
2. Brand tokens and breakpoints came from computed source values.
3. Source assets are local or have an explicit portable destination.
4. Every page is registered as a Superelements landing template.
5. Sections use native Elementor containers and widgets.
6. The local Elementor renderer reports zero unsupported widgets and zero warnings.
7. Visual checks pass at the source breakpoints using the Elementor-rendered preview.
8. Build and targeted lint/type checks pass.
9. The handoff names anything that cannot work after WordPress import.

A template made from one HTML widget per section fails this contract even when it looks perfect in React.

## Phase 0 — Survey before implementation

Use the browser to inspect the live site. Follow internal navigation far enough to identify templates rather than individual URLs.

Record in `MIGRATION.md`:

- navigation and shared regions;
- page URLs grouped by template;
- computed colors, typography, widths, spacing, radii, shadows, motion, and source breakpoints;
- fonts and their licensing/hosting status;
- images, SVGs, videos, icons, and other media;
- dynamic collections, forms, accounts, checkout, search, and third-party embeds;
- explicit items that cannot be reproduced from the public site.

Maintain `migration.json` with the source URL, target routes, templates, current phase, decisions, `needsYou`, and remaining gaps.

Do not start application code until the survey is recorded. If `shipstudio-site-to-code` is available, follow its survey and measurement loop.

## Phase 1 — Establish the visual system

Read computed styles from the source. Do not estimate values from screenshots.

Create:

- local design tokens in the project’s existing idiom;
- a style-guide route for the imported brand;
- a scoped entry in `AGENTS.md` so later work does not blend brands;
- an asset directory under `public/<slug>/assets/`.

Keep each imported brand scoped. Never allow a source site’s tokens to leak into the Superelements application shell or another imported model.

## Phase 2 — Build native Elementor templates

Create `src/features/space/<slug>Template.ts` and register it in `src/features/space/landingTemplates.ts`.

Represent every section as `SectionNodeData` with an Elementor JSON tree:

```text
root container
├── child container/grid
│   ├── heading widget
│   ├── text-editor widget
│   └── image/video/button widget
└── additional native containers/widgets
```

Use the project’s established Elementor schema:

- `container` for flex and grid layout;
- `heading` for headings, labels, wordmarks, and editable display text;
- `text-editor` for paragraphs and legal copy;
- `image` for every authored image or SVG;
- `video` for hosted, YouTube, or Vimeo video;
- `button`, `icon-list`, `image-box`, and other supported widgets when appropriate;
- responsive Elementor settings such as `*_tablet`, `*_mobile`, `padding_mobile`, and mobile grid definitions;
- `custom_css` for scoped `selector` rules, pseudo-elements, media queries, focus states, and effects that Elementor controls cannot express cleanly.

Read [references/native-elementor-contract.md](references/native-elementor-contract.md) before authoring a template.

### HTML widget boundary

Do not use an HTML widget for:

- section layout;
- headings or paragraphs;
- images;
- buttons;
- cards;
- navigation that can be composed with containers and supported widgets;
- loading a project stylesheet that contains the real layout.

An HTML widget is allowed only for a small isolated behavior with no native equivalent, such as a canvas visualization or a tiny accessibility-enhanced disclosure. Keep authored content outside it. Name the exception in the validation report.

The default acceptance target is zero HTML widgets.

### IDs and section boundaries

- Generate valid unique seven-character Elementor IDs.
- Use a distinct prefix per section while authoring.
- Keep each major source section as a separate `SectionNodeData` entry so it remains independently reusable.
- Use one root container per section.
- Give important containers and widgets descriptive CSS classes for maintainability.

### Assets and portability

Download public source assets to `public/<slug>/assets/` when licensing permits.

Use Elementor media objects for images:

```ts
{ id: '', url, alt, source: 'url', size: '' }
```

Do not stop at “it works on localhost”. Classify every asset:

- Images and SVGs: must be discoverable by `collectImageUrls` and replaceable through the project’s media mapping.
- Video: upload to WordPress or point to a stable deployed public URL; a localhost `external_url` is not portable.
- Fonts: use Elementor Custom Fonts, a licensed public font URL, or a declared fallback. Localhost font URLs do not survive import.
- Scripts and integrations: declare their destination and security boundary.

Never silently hotlink a temporary browser cache, blob URL, or local filesystem path.

## Phase 3 — Build the Elementor validation route

Create `/<slug>-elementor-preview` using `renderElementorDocument`, or extend an existing project preview that uses the same renderer.

The preview header must expose:

- section count;
- container count;
- widget counts grouped by type;
- HTML widget count;
- unsupported widget count;
- renderer warning count.

Render the actual Elementor JSON, not the React reference implementation.

Acceptance gates:

- at least one native container per section;
- HTML widget count is zero unless a documented exception exists;
- unsupported widget count is zero;
- renderer warning count is zero;
- images resolve;
- IDs are unique;
- desktop, tablet, and mobile produce no horizontal overflow;
- headings do not crop at 390px;
- page order matches the source.

Use [scripts/validate-elementor-json.mjs](scripts/validate-elementor-json.mjs) for exported JSON validation when an export file is available.

## Phase 4 — Visual verification

Compare the live source with the Elementor-rendered output, not only with a React model.

At every source breakpoint:

1. Capture source and native Elementor preview.
2. Compare container widths, section heights, type metrics, spacing, colors, media crop, and page height.
3. Fix one named structural discrepancy per pass.
4. Recheck desktop, tablet, and mobile after shared changes.

Check separately:

- focus and keyboard behavior;
- hover and active states;
- `prefers-reduced-motion`;
- intermediate widths;
- longer editable copy;
- media replacement behavior.

At 390px, explicitly guard against fixed Elementor widths with `min-width:0`, `max-width:100%`, appropriate widget widths, `overflow-wrap`, and scoped `overflow-x` containment.

## Phase 5 — Complete the remaining project

After the homepage passes, build every template found in the survey. Reuse shared builder helpers and visual tokens, but keep pages as separate registered landing templates when their structure differs.

For each subsequent template:

- implement the hardest representative URL first;
- verify it using the same native-renderer loop;
- recheck one earlier page that shares components;
- update `MIGRATION.md` and `migration.json` before moving on.

Do not call a single homepage “the entire project” when the survey found listing, detail, legal, contact, authentication, or collection templates.

## Existing-canvas migration rule

Changing a template factory does not rewrite sections already stored on the user’s canvas. After replacing an old HTML-based template:

1. change the section `sourceId` values so the new structure is distinguishable;
2. tell the user to reopen “Modelos de landing page”;
3. select the updated model and confirm canvas replacement;
4. export again to Elementor.

Never report the fix without this instruction; otherwise the user may unknowingly export stale JSON.

## Verification commands

Run in proportion to the change:

```powershell
npm.cmd run build
npx.cmd eslint src\features\space\<slug>Template.ts src\pages\<Slug>ElementorPreview.tsx src\features\space\landingTemplates.ts
```

Also run the JSON validator when a concrete export exists:

```powershell
node .agents\skills\superelements-site-to-elementor\scripts\validate-elementor-json.mjs <export.json>
```

Build success is necessary but not visual or structural acceptance.

## Handoff format

Report these four states:

1. **Concluído** — templates, routes, assets, and validation numbers.
2. **Em andamento** — only if work is genuinely still running.
3. **Não concluído** — integrations, templates, or breakpoints still outstanding.
4. **Precisa de você** — licensing, credentials, upload, publish, or external-service decisions.

Always include:

- the Elementor preview route;
- the template source file;
- native container and widget counts;
- HTML, unsupported, and warning counts;
- build/lint results;
- asset-portability caveats;
- the existing-canvas replacement instruction when relevant.

## Failure patterns

- Looks correct in React but breaks in Elementor → the React page became the source of truth. Rebuild the Elementor tree and validate that output directly.
- One HTML widget per fold → reject and split into native containers/widgets.
- Images disappear after paste → their URLs were local and not included in media replacement.
- Fonts change after paste → the font was never installed in Elementor or its URL is not portable.
- Old broken structure persists → the canvas still contains the previous serialized JSON; reload the model.
- Mobile headings crop → remove fixed child widths and add the 390px responsive safeguards.
- Renderer looks blank → inspect renderer warnings, unsupported widgets, generated CSS, and the actual preview document before assuming the template works.

