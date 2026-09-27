# Native Elementor contract

Use this reference while implementing or reviewing a generated site template.

## Supported structural pattern

Each major fold is a `SectionNodeData` entry containing one root container. Layout is expressed by nested containers, not by HTML strings.

```ts
type ElementorNode = {
  id: string
  elType: 'container' | 'widget'
  isInner: boolean
  widgetType?: string
  settings: Record<string, unknown>
  elements: ElementorNode[]
}
```

Root containers use `isInner: false`; child containers use `isInner: true`; widgets use `isInner: false` and an empty `elements` array.

## Preferred widgets

| Content | Widget |
|---|---|
| Heading, display text, editable wordmark | `heading` |
| Paragraph, legal copy | `text-editor` |
| Image, SVG, poster | `image` |
| Hosted, YouTube, Vimeo media | `video` |
| CTA | `button` |
| Repeated text/icon rows | `icon-list` |
| Image with title/copy | `image-box` |

Confirm support in `src/engine/elementor/render.ts` and `src/engine/elementor/widgets/` before choosing another widget type.

## Responsive settings

Set explicit tablet and mobile values for structural properties that change:

- `grid_columns_grid_tablet`, `grid_columns_grid_mobile`;
- `flex_direction_tablet`, `flex_direction_mobile`;
- `padding_tablet`, `padding_mobile`;
- `typography_font_size_tablet`, `typography_font_size_mobile`;
- widget width and alignment variants;
- min-height variants when the source changes them.

Do not assume Elementor will reinterpret desktop custom CSS into a useful mobile layout.

## Custom CSS

Use `selector` so the local renderer and Elementor scope the rule to its element. Custom CSS may contain pseudo-elements, descendant selectors, keyframes, reduced-motion rules, and media queries.

Keep primary geometry in Elementor settings. Custom CSS enhances or handles cases that controls cannot represent; it should not hide the entire real page inside a stylesheet attached to an empty widget.

## Native-structure rejection rules

Reject the template when any of these is true:

- a root container has only one HTML widget containing the section markup;
- authored headings, paragraphs, cards, or images live inside an HTML string;
- all visual geometry comes from a linked external stylesheet;
- Elementor’s Navigator cannot select the meaningful content separately;
- replacing an image through the project media mapper cannot find that image;
- an unsupported widget is silently omitted by the renderer;
- duplicate IDs cause selector leakage.

## Portability gate

Before handoff, test the template as if WordPress were on another domain. Record every URL that contains localhost, a filesystem path, a blob URL, or an expiring source.

Images should use media objects. Videos and fonts need a stable deployed URL or a WordPress upload/custom-font step.

