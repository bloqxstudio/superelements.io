// Gerado por `npm run build:mcp` (scripts/mcp/build.mjs). Não edite à mão.
// @ts-nocheck

// src/features/space/brand/color.ts
var HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
var RGBA = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+%?)\s*)?\)$/i;
function parseColor(value) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  const hex = v.match(HEX)?.[1];
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join("") : hex;
    const byte = (i) => parseInt(full.slice(i, i + 2), 16);
    return { r: byte(0), g: byte(2), b: byte(4), a: full.length === 8 ? byte(6) / 255 : 1 };
  }
  const m = v.match(RGBA);
  if (!m) return null;
  const a = m[4] === void 0 ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return { r: +m[1], g: +m[2], b: +m[3], a };
}
var toHexString = ({ r, g, b }) => {
  const h = (n2) => Math.round(Math.min(255, Math.max(0, n2))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
};
var linear = (channel) => {
  const x = channel / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
function mix(a, b, t) {
  const x = parseColor(a);
  const y = parseColor(b);
  if (!x || !y) return a;
  return toHexString({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}
var luminance = ({ r, g, b }) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// src/features/criativos/brand.ts
var lum = (hex) => {
  const c = parseColor(hex);
  return c ? 0.299 * c.r + 0.587 * c.g + 0.114 * c.b : 128;
};
var sat = (hex) => {
  const c = parseColor(hex);
  if (!c) return 0;
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  return max === 0 ? 0 : (max - min) / max;
};
var ratio = (a, b) => {
  const x = parseColor(a);
  const y = parseColor(b);
  return x && y ? contrast(x, y) : 21;
};
function paletteOf(brand) {
  const valid = brand.colors.filter((c) => parseColor(c.hex));
  const hexes = valid.map((c) => c.hex);
  const named = (...names) => names.map((n2) => valid.find((c) => c.name.toLowerCase() === n2)?.hex).find(Boolean);
  const byLum = [...hexes].sort((a, b) => lum(a) - lum(b));
  const namedInk = named("primary", "ink", "text", "foreground");
  const ink = namedInk && lum(namedInk) < 110 ? namedInk : byLum[0] && lum(byLum[0]) < 110 ? byLum[0] : "#171717";
  const namedPaper = named("background", "paper", "canvas");
  const paper = namedPaper && lum(namedPaper) > 190 ? namedPaper : byLum.at(-1) && lum(byLum.at(-1)) > 190 ? byLum.at(-1) : "#f4f4f4";
  const accent = named("accent", "brand", "highlight") ?? [...hexes].filter((h) => h !== ink && h !== paper && sat(h) > 0.15).sort((a, b) => sat(b) - sat(a))[0] ?? ink;
  const onAccent = named("on-accent") ?? (ratio(accent, "#ffffff") >= ratio(accent, ink) ? "#ffffff" : ink);
  const accentOnLight = named("accent-ink", "accent-on-light") ?? (ratio(accent, paper) >= 3 ? accent : mix(accent, ink, 0.45));
  const accentOnDark = ratio(accent, ink) >= 3 ? accent : mix(accent, "#ffffff", 0.5);
  const muted = named("muted", "text-muted") ?? mix(ink, paper, 0.45);
  const mutedOnDark = named("on-dark-muted") ?? mix(paper, ink, 0.4);
  return { ink, paper, accent, onAccent, accentOnLight, accentOnDark, muted, mutedOnDark };
}
var buttonRadiusOf = (brand, h) => Math.min(brand.buttonRadius ?? 0, h / 2);
var capsButton = (brand) => (brand.buttonRadius ?? 0) < 4;

// src/features/criativos/color.ts
var parse = (value) => {
  const v = value.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(v);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16)).concat(1);
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(v);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), m[2] ? parseInt(m[2], 16) / 255 : 1];
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === void 0 ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : Number(m[4])];
  return void 0;
};
function alpha(color, a) {
  const c = parse(color);
  if (!c) return `rgba(0, 0, 0, ${a})`;
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${Math.round(a * 1e3) / 1e3})`;
}

// src/features/criativos/safeZone.ts
var STORY_SAFE = { top: 250, bottom: 300 };

// src/features/criativos/types.ts
var FORMATS = {
  "4x5": { id: "4x5", label: "Feed 4:5", use: "Feed e an\xFAncio", width: 1080, height: 1350 },
  "1x1": { id: "1x1", label: "Quadrado 1:1", use: "Feed e carrossel", width: 1080, height: 1080 },
  "9x16": { id: "9x16", label: "Story 9:16", use: "Stories e Reels", width: 1080, height: 1920 },
  "16x9": { id: "16x9", label: "Paisagem 16:9", use: "Capa, YouTube e apresenta\xE7\xE3o", width: 1920, height: 1080 },
  link: { id: "link", label: "Link 1.91:1", use: "An\xFAncio de link e LinkedIn", width: 1200, height: 628 },
  "2x3": { id: "2x3", label: "Vertical 2:3", use: "Pinterest", width: 1e3, height: 1500 }
};
var CUSTOM = /^(\d{3,4})x(\d{3,4})px$/;
function sizeOf(id) {
  const known = FORMATS[id];
  if (known) return known;
  const m = CUSTOM.exec(id);
  return m ? { id, label: `${m[1]}\xD7${m[2]}`, use: "Tamanho livre", width: Number(m[1]), height: Number(m[2]) } : FORMATS["4x5"];
}
var FORMAT_LIST = Object.values(FORMATS);
var uid = () => Math.random().toString(36).slice(2, 10);

// src/features/criativos/grid.ts
var marginOf = (format) => {
  const { width, height } = sizeOf(format);
  return Math.round(Math.min(width, height) * 0.0778);
};

// src/features/avence/cases.ts
var shots = (slug, pageH = 4e3) => ({
  cover: { path: `/brands/avence-studio/cases/${slug}-capa.webp`, w: 960, h: 600 },
  page: { path: `/brands/avence-studio/cases/${slug}-pagina.webp`, w: 1200, h: pageH },
  phone: { path: `/brands/avence-studio/cases/${slug}-celular.webp`, w: 520, h: 6400 }
});
var AV_CASES = [
  {
    // primeiro case por pedido do usuário (2026-10-04), com o efeito do site em vídeo
    // ("quero que mostre o efeito do case"): o logo se forma, gira em 3D e os pilares
    // acendem. As duas imagens SVG que o site publicado ainda mostra quebradas foram
    // trocadas na gravação pelos arquivos de `public/brands/processbase/`. A capa da
    // galeria saiu sem o GSAP (composição final do CSS).
    slug: "processbase",
    name: "ProcessBase",
    segment: "Consultoria de gest\xE3o para empresas",
    place: "S\xE3o Leopoldo, RS",
    url: "https://processbase.com.br/",
    domain: "processbase.com.br",
    summary: "Site de uma consultoria que organiza cultura, processos, treinamentos e planejamento nas empresas: o M\xE9todo Base em quatro pilares, como o projeto anda, quem conduz e o diagn\xF3stico marcado pelo site.",
    stack: "WordPress e Elementor",
    ...shots("processbase"),
    video: {
      desktop: { src: "/brands/avence-studio/cases/processbase-efeito.mp4", poster: "/brands/avence-studio/cases/processbase-efeito-capa.webp" },
      phone: { src: "/brands/avence-studio/cases/processbase-efeito-celular.mp4", poster: "/brands/avence-studio/cases/processbase-efeito-celular-capa.webp" }
    }
  },
  {
    slug: "vizor",
    name: "Vizor Pel\xEDculas",
    segment: "Pel\xEDculas para pain\xE9is de moto",
    place: "S\xE3o Leopoldo, RS",
    url: "https://vizorpeliculas.com.br/",
    domain: "vizorpeliculas.com.br",
    summary: "Site e cat\xE1logo de uma fabricante de pel\xEDculas protetoras para pain\xE9is de motocicletas, com busca por marca, modelo e ano e uma p\xE1gina para quem quer revender.",
    stack: "Astro",
    ...shots("vizor")
  },
  {
    slug: "flavia-neto",
    name: "Fl\xE1via Neto",
    segment: "Aulas de yoga",
    place: "Florian\xF3polis, SC",
    url: "https://flavianeto.com.br/",
    domain: "flavianeto.com.br",
    summary: "Site de uma professora de yoga no sul da Ilha de Florian\xF3polis: as aulas, o espa\xE7o, as perguntas frequentes e a aula experimental marcada pelo WhatsApp.",
    stack: "WordPress e Elementor",
    ...shots("flavia-neto")
  },
  {
    slug: "zena-viagens",
    name: "Zena Viagens",
    segment: "Viagens sob medida",
    url: "https://zenaviagens.com/",
    domain: "zenaviagens.com",
    summary: "Site de uma ag\xEAncia de viagens planejadas sob medida: o m\xE9todo, os servi\xE7os, quem est\xE1 por tr\xE1s e o pedido da viagem num formul\xE1rio.",
    stack: "WordPress e Elementor",
    ...shots("zena-viagens")
  },
  {
    slug: "contplan",
    name: "Contplan",
    segment: "Contabilidade para empresas",
    place: "Porto Alegre, RS",
    url: "https://www.contplan.com.br/",
    domain: "contplan.com.br",
    summary: "Site de um escrit\xF3rio de contabilidade: os servi\xE7os, os planos, o caminho para virar cliente, a \xE1rea do cliente e o contato.",
    stack: "WordPress e Elementor",
    ...shots("contplan")
  },
  {
    slug: "prexparts",
    name: "PrexParts",
    segment: "Pe\xE7as e acess\xF3rios para motos",
    url: "https://prexparts.com.br/",
    domain: "prexparts.com.br",
    summary: "Site de uma fabricante de pe\xE7as e acess\xF3rios para motos: a linha de produtos organizada por modelo, as marcas atendidas e a p\xE1gina da empresa.",
    stack: "WordPress e Elementor",
    ...shots("prexparts", 3740)
  }
];

// src/features/criativos/library.ts
var CASE_VIEW_LABEL = { capa: "capa", pagina: "p\xE1gina do computador", celular: "p\xE1gina do celular" };
var caseImage = (c, view) => {
  const shot = view === "capa" ? c.cover : view === "pagina" ? c.page : c.phone;
  return { src: shot.path, width: shot.w, height: shot.h };
};
var ILLUSTRATIONS = [
  { id: "site-parado", label: "Site parado no tempo", src: "/brands/avence-studio/ilustracoes/site-parado.svg", width: 650, height: 520 },
  { id: "clique-conversa", label: "Do an\xFAncio \xE0 conversa", src: "/brands/avence-studio/ilustracoes/clique-conversa.svg", width: 920, height: 500 },
  { id: "previa-site", label: "Pr\xE9via de uma p\xE1gina nova", src: "/brands/avence-studio/ilustracoes/previa-site.svg", width: 760, height: 640 },
  { id: "antes-depois", label: "Antes e depois", src: "/brands/avence-studio/ilustracoes/antes-depois.svg", width: 740, height: 680 },
  { id: "camadas-wordpress", label: "Camadas de p\xE1ginas", src: "/brands/avence-studio/ilustracoes/camadas-wordpress.svg", width: 620, height: 680 }
].map((i) => ({ ...i, group: "Ilustra\xE7\xF5es" }));
var LIBRARY = [
  ...AV_CASES.flatMap(
    (c) => ["capa", "pagina", "celular"].map((view) => ({ id: `${c.slug}-${view}`, group: `Case \xB7 ${c.name}`, label: `${c.name} \xB7 ${CASE_VIEW_LABEL[view]}`, ...caseImage(c, view) }))
  ),
  ...ILLUSTRATIONS
];
var caseBySlug = (slug) => AV_CASES.find((c) => c.slug === slug);

// src/features/criativos/render.ts
var fontCss = (layer) => `${layer.italic ? "italic " : ""}${layer.weight} ${layer.size}px "${layer.font}", system-ui, sans-serif`;
var scratch = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
function setMeasureContext(ctx) {
  scratch = ctx;
}
var EMPHASIS_FONT = "Instrument Serif";
var serifEmphasis = (layer) => !layer.emphasisFont || layer.emphasisFont === EMPHASIS_FONT;
function setText(ctx, layer, em = false) {
  const serif = em && serifEmphasis(layer);
  ctx.font = serif ? `italic 400 ${layer.size * 1.12}px "${EMPHASIS_FONT}", Georgia, serif` : em ? fontCss({ ...layer, font: layer.emphasisFont }) : fontCss(layer);
  ctx.letterSpacing = serif ? "0px" : `${layer.letterSpacing * layer.size}px`;
  ctx.textBaseline = "alphabetic";
}
function words(paragraph, emphasis) {
  const out = [];
  let em = false;
  for (const raw of paragraph.split(/\s+/).filter(Boolean)) {
    const m = /^(\*?)(.*?)(\*?)([.,;:!?…)"”]*)$/.exec(raw);
    if (!emphasis || !m) {
      out.push({ text: raw, em: false });
      continue;
    }
    const [, open, body, close, punct] = m;
    if (open) em = true;
    if (em) {
      out.push({ text: body, em: true });
      if (punct) out.push({ text: punct, em: false, glue: true });
    } else out.push({ text: body + close + punct, em: false });
    if (close) em = false;
  }
  return out;
}
var runWidth = (ctx, layer, run) => {
  setText(ctx, layer, run.em);
  return ctx.measureText(run.text).width;
};
var GLUE = /* @__PURE__ */ new Set(["a", "o", "e", "\xE9", "\xE0", "ao", "as", "os", "da", "de", "do", "em", "na", "no", "um", "se", "ou", "por", "com", "que", "n\xE3o", "sua", "seu", "para", "pela", "pelo", "das", "dos", "nas", "nos", "mais", "mas", "meu", "minha", "suas", "seus", "the", "an", "of", "to", "in", "is", "for", "and"]);
var bare = (t) => t.toLowerCase().replace(/[^\p{L}]/gu, "");
function wrapParagraph(ctx, layer, runs) {
  const space = (setText(ctx, layer), ctx.measureText(" ").width);
  let units = [];
  for (const run of runs) {
    if (run.glue && units.length) units[units.length - 1].push(run);
    else units.push([run]);
  }
  for (let i = 0; i < units.length - 1; ) {
    const unit = units[i];
    if (unit.length === 1 && !unit[0].em && GLUE.has(bare(unit[0].text)) && !/[.,;:!?…]$/.test(unit[0].text)) {
      units.splice(i, 2, [...unit, ...units[i + 1]]);
    } else i++;
  }
  const widthOf = (unit) => unit.reduce((n2, r, k) => n2 + runWidth(ctx, layer, r) + (k && !r.glue ? space : 0), 0);
  if (units.length >= 3) {
    const tail = [...units[units.length - 2], ...units[units.length - 1]];
    if (widthOf(tail) <= layer.w * 0.9) units = [...units.slice(0, -2), tail];
  }
  const sizes = units.map(widthOf);
  const greedy = (max) => {
    const lines = [];
    let line = [];
    let width = 0;
    units.forEach((unit, i) => {
      const w = sizes[i];
      if (line.length && width + space + w > max) {
        lines.push(line);
        line = [];
        width = 0;
      }
      line.push(...unit);
      width += (width ? space : 0) + w;
    });
    if (line.length) lines.push(line);
    return lines;
  };
  const full = greedy(layer.w);
  if (layer.size >= 60 && full.length > 1) {
    let lo = layer.w * 0.5;
    let hi = layer.w;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      if (greedy(mid).length === full.length) hi = mid;
      else lo = mid;
    }
    return greedy(hi + 1);
  }
  return full;
}
function measureText(layer, ctx = scratch) {
  const lineHeight = layer.size * layer.lineHeight;
  if (!ctx) return { lines: [[{ text: layer.text, em: false }]], lineHeight, height: lineHeight };
  ctx.save();
  const source = layer.upper ? layer.text.toUpperCase() : layer.text;
  const lines = [];
  for (const paragraph of source.split("\n")) {
    const runs = words(paragraph, !!layer.emphasis);
    if (!runs.length) lines.push([]);
    else lines.push(...wrapParagraph(ctx, layer, runs));
  }
  ctx.restore();
  return { lines, lineHeight, height: lines.length * lineHeight };
}
function widestLine(layer, ctx = scratch) {
  if (!ctx) return 0;
  const { lines } = measureText(layer, ctx);
  ctx.save();
  setText(ctx, layer);
  const space = ctx.measureText(" ").width;
  let widest = 0;
  for (const line of lines) {
    const total = line.reduce((n2, r, k) => n2 + runWidth(ctx, layer, r) + (k && !r.glue ? space : 0), 0);
    if (total > widest) widest = total;
  }
  ctx.restore();
  return widest;
}
function placeText(layer, ctx = scratch) {
  if (!ctx) return [];
  const { lines, lineHeight } = measureText(layer, ctx);
  const ascent = layer.size * 0.8 + (lineHeight - layer.size) / 2;
  const out = [];
  ctx.save();
  lines.forEach((line, i) => {
    setText(ctx, layer);
    const space = ctx.measureText(" ").width;
    const total = line.reduce((n2, r, k) => n2 + runWidth(ctx, layer, r) + (k && !r.glue ? space : 0), 0);
    let x = layer.align === "left" ? layer.x : layer.align === "center" ? layer.x + (layer.w - total) / 2 : layer.x + layer.w - total;
    line.forEach((run, k) => {
      if (k && !run.glue) x += space;
      const serif = run.em && serifEmphasis(layer);
      out.push({
        text: run.text,
        x,
        y: layer.y + ascent + i * lineHeight,
        font: serif ? EMPHASIS_FONT : run.em ? layer.emphasisFont : layer.font,
        weight: serif ? 400 : layer.weight,
        italic: serif || !!layer.italic,
        size: serif ? layer.size * 1.12 : layer.size,
        letterSpacing: serif ? 0 : layer.letterSpacing * layer.size,
        color: run.em ? layer.emphasisColor ?? layer.color : layer.color
      });
      x += runWidth(ctx, layer, run);
    });
  });
  ctx.restore();
  return out;
}
function layerBox(layer) {
  if (layer.type === "text") return { x: layer.x, y: layer.y, w: layer.w, h: Math.max(layer.h, measureText(layer).height) };
  return { x: layer.x, y: layer.y, w: layer.w, h: layer.h };
}

// src/features/criativos/editorial.ts
var SAFE = { top: 250, bottom: 300 };
var lum2 = (hex) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const n2 = parseInt(m[1], 16);
  return 0.299 * (n2 >> 16) + 0.587 * (n2 >> 8 & 255) + 0.114 * (n2 & 255);
};
var stoneOf = (brand, p) => {
  const light = brand.colors.map((c) => c.hex.toLowerCase()).filter((hex) => hex !== p.paper.toLowerCase() && hex !== "#ffffff" && lum2(hex) > 200);
  return light.sort((a, b) => lum2(b) - lum2(a))[0] ?? mix(p.paper, p.ink, 0.06);
};
var edOf = (brand, format, dark, at, tone = "paper") => {
  const p = paletteOf(brand);
  const { width: w, height: h } = sizeOf(format);
  const story = h / w > 1.7;
  const m = marginOf(format);
  const meta = story ? SAFE.top : m;
  const foot = story ? h - SAFE.bottom - 26 : h - m - 26;
  const bg2 = dark ? p.ink : tone === "white" ? "#ffffff" : tone === "stone" ? stoneOf(brand, p) : p.paper;
  return {
    brand,
    p,
    w,
    h,
    m,
    story,
    dark,
    bg: bg2,
    meta,
    foot,
    at,
    y0: meta + (story ? 130 : 134),
    y1: foot - (story ? 70 : 60),
    fg: dark ? "#ffffff" : p.ink,
    body: dark ? mix(p.paper, p.ink, 0.12) : mix(p.ink, p.paper, 0.18),
    muted: dark ? p.mutedOnDark : p.muted,
    line: dark ? "rgba(255, 255, 255, 0.14)" : mix(p.ink, p.paper, 0.86),
    hi: dark ? p.accentOnDark : p.accentOnLight
  };
};
var text = (c, name, t, o) => ({
  id: uid(),
  type: "text",
  name,
  text: t,
  h: 0,
  font: c.brand.bodyFont,
  weight: 400,
  color: c.fg,
  align: "left",
  lineHeight: 1.3,
  letterSpacing: 0,
  emphasisColor: c.hi,
  emphasisFont: c.brand.emphasisFont,
  ...o
});
var heightOf = (layer) => measureText(layer).height;
function fit(layer, maxLines, floor = 0.62) {
  let current = layer;
  const min = layer.size * floor;
  while (current.size > min && (measureText(current).lines.length > maxLines || widestLine(current) > current.w + 0.5)) current = { ...current, size: Math.round(current.size * 0.94) };
  return current;
}
var title = (c, t, o) => {
  const { maxLines, ...rest } = o;
  return fit(text(c, "T\xEDtulo", t, { font: c.brand.headingFont, weight: 500, lineHeight: 1.02, letterSpacing: -0.045, emphasis: true, ...rest }), maxLines ?? 4);
};
var label = (c, t, x, y, w) => text(c, "R\xF3tulo", t, { x, y, w, size: c.story ? 24 : 22, weight: 600, letterSpacing: 0.14, upper: true, color: c.hi });
var support = (c, t, x, y, w, lines = 4) => fit(text(c, "Apoio", t, { x, y, w, size: c.story ? 34 : 30, color: c.body }), lines, 0.8);
var rect = (name, o) => ({ id: uid(), type: "rect", name, radius: 0, ...o });
var image = (name, src, o) => ({ id: uid(), type: "image", name, src, fit: "cover", radius: 0, frame: "none", ...o });
var slide = (c, layers) => ({ id: uid(), background: c.bg, layers });
var metaRow = (c, color = c.muted) => {
  const o = { y: c.meta, w: c.w - c.m * 2, size: c.story ? 20 : 18, weight: 600, letterSpacing: 0.12, upper: true, color, lineHeight: 1.3 };
  return [
    text(c, "Meta esquerda", c.brand.name, { x: c.m, ...o }),
    ...c.at?.series ? [text(c, "Meta direita", c.at.series, { x: c.m, ...o, align: "right" })] : []
  ];
};
var footRow = (c, onDark = c.dark, color = c.muted) => {
  const src = onDark ? c.brand.logoOnDark ?? c.brand.logoOnLight : c.brand.logoOnLight ?? c.brand.logoOnDark;
  const logo = src ? image("Logo", src, { x: c.m, y: c.foot, w: 140, h: 26, fit: "contain" }) : text(c, "Logo", c.brand.name, { x: c.m, y: c.foot - 4, w: 400, size: 26, weight: 600, font: c.brand.headingFont, letterSpacing: -0.04, color: onDark ? "#ffffff" : c.p.ink });
  const count = !c.story && c.at && c.at.total > 1 ? [text(c, "Contador", `${String(c.at.index + 1).padStart(2, "0")} / ${String(c.at.total).padStart(2, "0")}`, { x: c.m, y: c.foot - 2, w: c.w - c.m * 2, size: 20, weight: 600, letterSpacing: 0.08, color, align: "right" })] : [];
  return [logo, ...count];
};
var button = (c, t, x, y) => {
  const t2 = `${t.trim()}  \u2192`;
  const caps = capsButton(c.brand);
  const probe = text(c, "Bot\xE3o (texto)", t2, { x: x + 36, y: 0, w: 2e3, size: c.story ? 30 : 28, weight: 600, letterSpacing: caps ? 0.08 : -0.01, upper: caps, color: c.p.onAccent });
  const w = Math.min(c.w - c.m * 2, Math.max(320, Math.ceil(widestLine(probe)) + 72));
  const h = c.story ? 104 : 96;
  return [rect("Bot\xE3o", { x, y, w, h, fill: c.p.accent, radius: buttonRadiusOf(c.brand, h) }), { ...probe, w: w - 72, y: y + (h - heightOf(probe)) / 2 }];
};
function rows(c, items, top, bottom) {
  const list = items.slice(0, 5);
  const step = Math.min(c.story ? 200 : 150, (bottom - top) / Math.max(1, list.length));
  const size = c.story ? 48 : 44;
  return [
    ...list.flatMap((r, i) => {
      const y = top + i * step;
      const item = fit(text(c, `Item ${i + 1}`, r, { x: c.m + 110, y: 0, w: c.w - c.m * 2 - 110, size, weight: 500, lineHeight: 1.1, letterSpacing: -0.03 }), 2, 0.7);
      const ih = heightOf(item);
      return [
        rect(`Linha ${i + 1}`, { x: c.m, y, w: c.w - c.m * 2, h: 2, fill: c.line }),
        text(c, `N\xFAmero ${i + 1}`, String(i + 1).padStart(2, "0"), { x: c.m, y: y + step / 2 - 17, w: 80, size: 26, weight: 600, letterSpacing: 0.04, color: c.hi }),
        { ...item, y: y + (step - ih) / 2 }
      ];
    }),
    rect("Linha final", { x: c.m, y: top + list.length * step, w: c.w - c.m * 2, h: 2, fill: c.line })
  ];
}
function stack(items, y) {
  let at = y;
  const layers = items.map(({ layer, gap }, i) => {
    at += i ? gap : 0;
    const placed = { ...layer, y: at };
    at += heightOf(placed);
    return placed;
  });
  return { layers, end: at };
}
var shift = (layers, dy) => layers.map((l) => ({ ...l, y: l.y + dy }));
var caseOf = (spec) => caseBySlug(spec.case ?? "") ?? caseBySlug("processbase");
var scene = (spec, fallback) => spec.prompt?.trim() ? spec.prompt.trim() : `Editorial photograph, soft natural light, muted tones, generous empty space, no text, no logos. Subject: ${fallback}`;
var EDITORIAL = {
  // Foto em tela cheia: manchete no alto (sobre o céu ou o espaço livre), frase do serviço e o logo embaixo
  "foto-manchete": (brand, format, spec, at) => {
    const c = edOf(brand, format, true, at);
    const wide = c.w - c.m * 2;
    const head = title(c, spec.title ?? "Seu projeto \xE9 *exclusivo*, seu site tamb\xE9m deveria ser.", { x: c.m, y: c.y0, w: Math.round(wide * 0.84), size: c.story ? 112 : 84, maxLines: 4 });
    return slide(c, [
      image("Foto", spec.photo ?? "", { x: 0, y: 0, w: c.w, h: c.h, ...spec.photo ? {} : { prompt: scene(spec, spec.title ?? "a contemporary house, natural light, calm") } }),
      rect("V\xE9u do topo", { x: 0, y: 0, w: c.w, h: Math.round(c.h * 0.5), fill: alpha(c.p.ink, 0.4), fill2: alpha(c.p.ink, 0), angle: 180 }),
      rect("V\xE9u da base", { x: 0, y: Math.round(c.h * 0.8), w: c.w, h: c.h - Math.round(c.h * 0.8), fill: alpha(c.p.ink, 0), fill2: alpha(c.p.ink, 0.4), angle: 180 }),
      ...metaRow(c, "rgba(255, 255, 255, 0.82)"),
      head,
      ...spec.body ? [text(c, "Apoio", spec.body, { x: c.m, y: c.foot - (c.story ? 64 : 58), w: wide, size: c.story ? 32 : 28, color: "rgba(255, 255, 255, 0.88)" })] : [],
      ...footRow(c, true)
    ]);
  },
  // Abre ou fecha uma ideia: rótulo e título grande no alto, a frase de apoio embaixo, perto do logo
  manifesto: (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? true, at);
    const wide = c.w - c.m * 2;
    const block = stack([
      ...spec.label ? [{ layer: label(c, spec.label, c.m, 0, wide), gap: 0 }] : [],
      { layer: title(c, spec.title ?? "Sites com *acabamento* de est\xFAdio.", { x: c.m, y: 0, w: wide, size: c.story ? 140 : 112, maxLines: 5 }), gap: 28 }
    ], c.y0 + (c.story ? 40 : 0));
    const body = spec.body ? support(c, spec.body, c.m, 0, wide - 160, 3) : void 0;
    return slide(c, [
      ...metaRow(c),
      ...block.layers,
      ...body ? [{ ...body, y: Math.max(block.end + 64, c.y1 - heightOf(body)) }] : [],
      ...footRow(c)
    ]);
  },
  // Uma ideia em letras grandes, no meio da tela
  "viral-frase": (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? false, at);
    const wide = c.w - c.m * 2;
    const block = stack([
      ...spec.label ? [{ layer: label(c, spec.label, c.m, 0, wide), gap: 0 }] : [],
      { layer: title(c, spec.title ?? "Marca forte n\xE3o *explica*. Ela se faz lembrar.", { x: c.m, y: 0, w: wide, size: c.story ? 128 : 112, maxLines: 6 }), gap: 28 },
      ...spec.body ? [{ layer: support(c, spec.body, c.m, 0, wide - 80, 3), gap: 44 }] : []
    ], 0);
    const top = Math.max(c.y0, Math.round((c.y0 + c.y1) / 2 - block.end / 2 - (c.story ? 60 : 0)));
    return slide(c, [...metaRow(c), ...shift(block.layers, top), ...footRow(c)]);
  },
  // Um número enorme no acento, um filete e o que ele quer dizer
  "viral-dado": (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? true, at);
    const wide = c.w - c.m * 2;
    const size = c.story ? 380 : 320;
    const numY = c.y0 + (c.story ? 120 : 60);
    const head = title(c, spec.title ?? "das pessoas decidem *em segundos*", { x: c.m, y: numY + size * 0.98 + 64, w: wide, size: c.story ? 88 : 76, maxLines: 4 });
    return slide(c, [
      ...metaRow(c),
      label(c, spec.label ?? "O n\xFAmero", c.m, c.y0, wide),
      text(c, "Dado", spec.number ?? "73%", { x: c.m - 10, y: numY, w: wide + 20, size, weight: 500, letterSpacing: -0.06, lineHeight: 0.98, color: c.hi, font: brand.headingFont }),
      rect("Filete", { x: c.m, y: numY + size * 0.98 + 24, w: wide, h: 2, fill: c.line }),
      head,
      ...spec.body ? [text(c, "Fonte", spec.body, { x: c.m, y: c.y1 - 40, w: wide, size: 22, weight: 500, color: c.muted })] : [],
      ...footRow(c)
    ]);
  },
  // Pergunta e três ou quatro linhas numeradas
  lista: (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? false, at);
    const wide = c.w - c.m * 2;
    const items = spec.items?.length ? spec.items : ["O site n\xE3o aparece quando procuram.", "Quem chega no celular desiste.", "O WhatsApp quase n\xE3o toca."];
    const block = stack([
      ...spec.label ? [{ layer: label(c, spec.label, c.m, 0, wide), gap: 0 }] : [],
      { layer: title(c, spec.title ?? "Seu site *faz isso*?", { x: c.m, y: 0, w: wide, size: c.story ? 112 : 92, maxLines: 3 }), gap: 28 }
    ], 0);
    const gap = c.story ? 96 : 80;
    const step = c.story ? 200 : 150;
    const listH = Math.min(items.slice(0, 5).length * step, c.y1 - c.y0 - block.end - gap - 20);
    const top = c.story ? Math.max(c.y0, Math.round((c.y0 + c.y1) / 2 - (block.end + gap + listH) / 2 - 40)) : c.y0;
    const listTop = top + block.end + gap;
    return slide(c, [...metaRow(c), ...shift(block.layers, top), ...rows(c, items, listTop, listTop + listH), ...footRow(c)]);
  },
  // O convite: título, botão quadrado e o contato
  cta: (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? true, at);
    const wide = c.w - c.m * 2;
    const handle = spec.body && spec.body.length <= 40 && spec.body.includes("@") ? spec.body : void 0;
    const block = stack([
      ...spec.label ? [{ layer: label(c, spec.label, c.m, 0, wide), gap: 0 }] : [],
      { layer: title(c, spec.title ?? "Veja o site do seu neg\xF3cio *antes* de fechar.", { x: c.m, y: 0, w: wide, size: c.story ? 116 : 100, maxLines: 5 }), gap: 28 },
      ...spec.body && !handle ? [{ layer: support(c, spec.body, c.m, 0, wide - 120, 3), gap: 44 }] : []
    ], 0);
    const btnH = c.story ? 104 : 96;
    const total = block.end + 64 + btnH + (handle ? 40 + 40 : 0);
    const top = c.story ? Math.max(c.y0, Math.round((c.y0 + c.y1) / 2 - total / 2 - 40)) : c.y0;
    const btnY = top + block.end + 64;
    return slide(c, [
      ...metaRow(c),
      ...shift(block.layers, top),
      ...button(c, spec.cta ?? "Fale com a gente", c.m, btnY),
      ...handle ? [text(c, "Perfil", handle, { x: c.m, y: btnY + btnH + 36, w: wide, size: c.story ? 30 : 26, weight: 500, color: c.muted })] : [],
      ...footRow(c)
    ]);
  },
  // A capa do site na janela, o título e a ficha (segmento, cidade, plataforma)
  "case-capa": (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? true, at);
    const k = caseOf(spec);
    const wide = c.w - c.m * 2;
    const cover = caseImage(k, "capa");
    const winY = c.meta + (c.story ? 90 : 68);
    const facts = [["Segmento", k.segment], ["Cidade", k.place], ["Plataforma", k.stack]].filter((f) => !!f[1]);
    const colW = Math.floor((wide - 24 * (facts.length - 1)) / facts.length);
    const block = stack([
      ...spec.label ? [{ layer: label(c, spec.label, c.m, 0, wide), gap: 0 }] : [],
      { layer: title(c, spec.title ?? `${k.name}.`, { x: c.m, y: 0, w: wide, size: c.story ? 104 : 92, maxLines: 3 }), gap: 24 },
      ...spec.body ? [{ layer: support(c, spec.body, c.m, 0, wide - 80, 2), gap: 28 }] : []
    ], 0);
    const gapWin = c.story ? 72 : 44;
    const factsH = 92;
    const winH = Math.max(280, Math.min(Math.round(wide * (c.story ? 0.7 : 0.62)), c.y1 - winY - gapWin - block.end - 56 - factsH));
    const blockTop = winY + winH + gapWin;
    const factY = Math.min(c.y1 - factsH + 20, blockTop + block.end + 56);
    return slide(c, [
      ...metaRow(c),
      image("Tela do site", cover.src, { x: c.m, y: winY, w: wide, h: winH, frame: "browser", focusY: 0 }),
      ...shift(block.layers, blockTop),
      ...facts.flatMap(([name, value], i) => [
        text(c, `${name} (r\xF3tulo)`, name, { x: c.m + i * (colW + 24), y: factY, w: colW, size: 16, weight: 600, letterSpacing: 0.14, upper: true, color: c.muted }),
        fit(text(c, name, value, { x: c.m + i * (colW + 24), y: factY + 30, w: colW, size: 26, weight: 500, lineHeight: 1.2 }), 2, 0.8)
      ]),
      ...footRow(c)
    ]);
  },
  // A página do case grande, numa janela, com o rótulo e uma legenda
  "case-janela": (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? false, at, "white");
    const k = caseOf(spec);
    const wide = c.w - c.m * 2;
    const view = spec.view === "capa" ? "capa" : "pagina";
    const block = stack([
      { layer: label(c, spec.label ?? "No computador", c.m, 0, wide), gap: 0 },
      ...spec.title ? [{ layer: title(c, spec.title, { x: c.m, y: 0, w: wide, size: c.story ? 84 : 72, maxLines: 3 }), gap: 24 }] : []
    ], c.y0);
    const caption = support(c, spec.body ?? `${k.name} \xB7 ${k.segment}`, c.m, 0, wide, 2);
    const capH = heightOf(caption);
    const winY = block.end + 44;
    const winH = Math.max(320, c.y1 - capH - 32 - winY);
    return slide(c, [
      ...metaRow(c),
      ...block.layers,
      image("P\xE1gina no computador", caseImage(k, view).src, { x: c.m, y: winY, w: wide, h: winH, frame: "browser", focusY: spec.focus ?? 0 }),
      { ...caption, y: winY + winH + 32, size: Math.min(caption.size, c.story ? 30 : 26) },
      ...footRow(c)
    ]);
  },
  // O site no celular de um lado e o texto do outro
  "case-duo": (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? false, at, "stone");
    const k = caseOf(spec);
    const phW = c.story ? 470 : 440;
    const phH = Math.min(Math.round(phW * 2.13), c.y1 - c.y0 + 60);
    const phY = c.story ? Math.round((c.y0 + c.y1) / 2 - phH / 2) : c.y0 - 40;
    const tx = c.m + phW + 56;
    const tw = c.w - c.m - tx;
    const block = stack([
      { layer: label(c, spec.label ?? "No celular", tx, 0, tw), gap: 0 },
      { layer: title(c, spec.title ?? `${k.name} nas *duas telas*.`, { x: tx, y: 0, w: tw, size: c.story ? 64 : 58, lineHeight: 1.04, letterSpacing: -0.035, maxLines: 6 }), gap: 24 },
      ...spec.body ? [{ layer: support(c, spec.body, tx, 0, tw, 6), gap: 32 }] : [],
      { layer: text(c, "Cr\xE9dito", `${k.name}${k.place ? ` \xB7 ${k.place}` : ""}`, { x: tx, y: 0, w: tw, size: 20, weight: 500, color: c.muted }), gap: 40 }
    ], 0);
    return slide(c, [
      ...metaRow(c),
      image("P\xE1gina no celular", caseImage(k, "celular").src, { x: c.m, y: phY, w: phW, h: phH, frame: "phone", focusY: spec.focus ?? 0 }),
      ...shift(block.layers, phY + (c.story ? 60 : 40)),
      ...footRow(c)
    ]);
  },
  // Uma ilustração da identidade, com título e uma frase
  ilustracao: (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? false, at);
    const art = ILLUSTRATIONS.find((i) => i.id === spec.illustration) ?? ILLUSTRATIONS[0];
    const wide = c.w - c.m * 2;
    const block = stack([
      ...spec.label ? [{ layer: label(c, spec.label, c.m, 0, wide), gap: 0 }] : [],
      { layer: title(c, spec.title ?? "Seu site tem *poucos segundos*.", { x: c.m, y: 0, w: wide, size: c.story ? 96 : 84, maxLines: 4 }), gap: 28 },
      ...spec.body ? [{ layer: support(c, spec.body, c.m, 0, wide - 60, 3), gap: 36 }] : []
    ], c.y0);
    const room = c.y1 - block.end - 80;
    const artH = Math.min(Math.round(wide * art.height / art.width), room, Math.round(c.h * 0.4));
    return slide(c, [
      ...metaRow(c),
      ...block.layers,
      image("Ilustra\xE7\xE3o", art.src, { x: c.m, y: c.y1 - artH, w: wide, h: artH, fit: "contain" }),
      ...footRow(c)
    ]);
  },
  // Foto gerada em tela cheia; um véu do fundo deixa o título ler no alto (claro) ou na base (escuro)
  "viral-capa": (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? false, at);
    const wide = c.w - c.m * 2;
    const veil = c.dark ? c.p.ink : c.p.paper;
    const block = stack([
      ...spec.label ? [{ layer: label(c, spec.label, c.m, 0, wide), gap: 0 }] : [],
      { layer: title(c, spec.title ?? "Como a marca *conquistou* todo mundo", { x: c.m, y: 0, w: wide, size: c.story ? 116 : 104, maxLines: 4 }), gap: 28 },
      ...spec.body ? [{ layer: support(c, spec.body, c.m, 0, Math.round(wide * 0.7), 3), gap: 32 }] : []
    ], 0);
    const top = c.dark ? c.y1 - 40 - block.end : c.y0;
    const cover = Math.min(c.h, Math.round(top + block.end + c.h * 0.16));
    return slide(c, [
      image("Foto de capa", "", { x: 0, y: 0, w: c.w, h: c.h, prompt: scene(spec, spec.title ?? "an empty, quiet room with soft daylight") }),
      ...c.dark ? [rect("V\xE9u do topo", { x: 0, y: 0, w: c.w, h: c.meta + 150, fill: alpha(c.p.ink, 0.62), fill2: alpha(c.p.ink, 0), angle: 180 })] : [],
      c.dark ? rect("V\xE9u", { x: 0, y: Math.round(top - c.h * 0.2), w: c.w, h: c.h - Math.round(top - c.h * 0.2), fill: alpha(veil, 0), fill2: alpha(veil, 0.95), angle: 180 }) : rect("V\xE9u", { x: 0, y: 0, w: c.w, h: cover, fill: alpha(veil, 0.95), fill2: alpha(veil, 0), angle: 180 }),
      ...metaRow(c, c.dark ? "rgba(255, 255, 255, 0.8)" : c.p.ink),
      ...shift(block.layers, top),
      ...c.dark ? footRow(c, true) : []
    ]);
  },
  // Foto em cima; embaixo o número no quadrado do acento, o título e uma frase
  "viral-foto": (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? false, at);
    const wide = c.w - c.m * 2;
    const imgH = Math.round(c.h * (c.story ? 0.44 : 0.46));
    const badge = c.story ? 64 : 56;
    const block = stack([
      { layer: title(c, spec.title ?? "O detalhe que *ningu\xE9m* percebeu", { x: c.m, y: 0, w: wide, size: c.story ? 76 : 64, lineHeight: 1.05, letterSpacing: -0.04, maxLines: 3 }), gap: 0 },
      ...spec.body ? [{ layer: support(c, spec.body, c.m, 0, wide - 60, 3), gap: 28 }] : []
    ], imgH + 56 + badge + 36);
    return slide(c, [
      image("Foto", "", { x: 0, y: 0, w: c.w, h: imgH, prompt: scene(spec, spec.title ?? "a candid editorial photograph") }),
      rect("V\xE9u do topo", { x: 0, y: 0, w: c.w, h: Math.round(c.meta + 120), fill: alpha(c.p.ink, 0.55), fill2: alpha(c.p.ink, 0), angle: 180 }),
      ...metaRow(c, "rgba(255, 255, 255, 0.85)"),
      rect("N\xFAmero (fundo)", { x: c.m, y: imgH + 56, w: badge, h: badge, fill: c.p.accent }),
      text(c, "N\xFAmero", spec.number ?? "01", { x: c.m, y: imgH + 56 + (badge - 36) / 2, w: badge, size: 28, weight: 600, align: "center", color: c.p.onAccent }),
      ...block.layers,
      ...footRow(c)
    ]);
  },
  // Fecho do carrossel: o que fazer com o post, numerado
  "viral-fecho": (brand, format, spec, at) => {
    const c = edOf(brand, format, spec.dark ?? true, at);
    const wide = c.w - c.m * 2;
    const items = spec.items?.length ? spec.items : ["Salve para consultar depois", "Envie para quem precisa ver", "Siga para ver o pr\xF3ximo"];
    const block = stack([
      { layer: label(c, spec.label ?? "Gostou?", c.m, 0, wide), gap: 0 },
      { layer: title(c, spec.title ?? "Isso vale *ouro*. N\xE3o deixe passar.", { x: c.m, y: 0, w: wide, size: c.story ? 104 : 92, maxLines: 3 }), gap: 28 }
    ], c.y0);
    const top = block.end + 72;
    return slide(c, [
      ...metaRow(c),
      ...block.layers,
      ...rows(c, items, top, Math.min(c.y1 - 90, top + items.length * 130)),
      ...spec.body ? [text(c, "Perfil", spec.body, { x: c.m, y: c.y1 - 40, w: wide, size: 26, weight: 500, color: c.muted })] : [],
      ...footRow(c)
    ]);
  }
};

// src/features/criativos/templates.ts
var ctxOf = (brand, format, dark) => {
  const p = paletteOf(brand);
  const { width: w, height: h } = sizeOf(format);
  const story = h / w > 1.7;
  return { brand, p, w, h, m: 84, top: story ? STORY_SAFE.top : 84, bottom: story ? STORY_SAFE.bottom : 84, story, dark, hi: dark ? p.accentOnDark : p.accentOnLight, fg: dark ? p.paper : p.ink, soft: dark ? "rgba(255,255,255,0.62)" : p.muted };
};
var text2 = (c, name, t, o) => ({
  id: uid(),
  type: "text",
  name,
  text: t,
  h: 0,
  font: c.brand.bodyFont,
  weight: 400,
  color: c.fg,
  align: "left",
  lineHeight: 1.15,
  letterSpacing: 0,
  emphasisColor: c.hi,
  emphasisFont: c.brand.emphasisFont,
  ...o
});
var title2 = (c, t, o) => {
  const { maxLines, ...rest } = o;
  return fit2(text2(c, "T\xEDtulo", t, { font: c.brand.headingFont, weight: 500, lineHeight: 0.98, letterSpacing: -0.05, emphasis: true, ...rest }), maxLines ?? 4);
};
function heightOf2(layer) {
  return measureText(layer).height;
}
function fit2(layer, maxLines, floor = 0.62) {
  let current = layer;
  const min = layer.size * floor;
  while (current.size > min && (measureText(current).lines.length > maxLines || widestLine(current) > current.w + 0.5)) current = { ...current, size: Math.round(current.size * 0.94) };
  return current;
}
var label2 = (c, t, o) => text2(c, "R\xF3tulo", t, { size: 24, weight: 600, letterSpacing: 0.16, upper: true, color: c.hi, ...o });
var rect2 = (name, o) => ({ id: uid(), type: "rect", name, radius: 0, ...o });
var image2 = (name, src, o) => ({ id: uid(), type: "image", name, src, fit: "cover", radius: 0, frame: "none", ...o });
var ring = (name, x, y, d, color, opacity) => ({ id: uid(), type: "ring", name, x, y, w: d, h: d, stroke: color, strokeWidth: 2, opacity });
var backdrop = (c, rings) => [
  ...c.dark ? [{ id: uid(), type: "dots", name: "Grade de pontos", x: 0, y: 0, w: c.w, h: c.h, color: "#ffffff", gap: 40, dot: 3, opacity: 0.07 }] : [],
  ...rings.flatMap(([x, y, d], i) => [ring(`Anel ${i + 1}a`, x, y, d, c.fg, 0.14), ring(`Anel ${i + 1}b`, x + d * 0.18, y + d * 0.18, d * 0.64, c.fg, 0.1)])
];
var square = (c, x, y, size) => rect2("Quadrado", { x, y, w: size, h: size, fill: c.hi, rotation: 45 });
var header = (c, tag) => {
  const src = c.dark ? c.brand.logoOnDark ?? c.brand.logoOnLight : c.brand.logoOnLight ?? c.brand.logoOnDark;
  const mark = src ? image2("Logo", src, { x: c.m, y: c.top - 4, w: 210, h: 60, fit: "contain" }) : text2(c, "Logo", c.brand.name, { x: c.m, y: c.top, w: 500, size: 36, weight: 600, font: c.brand.headingFont, letterSpacing: -0.04 });
  return tag ? [mark, label2(c, tag, { x: c.w - c.m - 560, y: c.top + 8, w: 560, align: "right" })] : [mark];
};
var slide2 = (background, layers) => ({ id: uid(), background, layers });
var bg = (c) => c.dark ? c.p.ink : c.p.paper;
var caseOf2 = (spec) => caseBySlug(spec.case ?? "") ?? caseBySlug("processbase");
var caseFoot = (c, name, place) => text2(c, "Rodap\xE9", `${name}${place ? ` \xB7 ${place}` : ""}`, { x: c.m, y: c.h - c.bottom - (c.story ? 40 : 30), w: c.w - c.m * 2, size: 28, weight: 500, color: c.soft });
var scrim = (c, from, color) => {
  const top = Math.round(c.h * from);
  return [rect2("Degrad\xEA", { x: 0, y: top, w: c.w, h: c.h - top, fill: alpha(color, 0), fill2: alpha(color, 0.94), angle: 180 })];
};
var scene2 = (spec, fallback) => spec.prompt?.trim() ? spec.prompt.trim() : `Editorial photograph, cinematic natural light, no text, no logos. Subject: ${fallback}`;
var swipe = (c, cue = "Arraste") => c.story ? [] : [
  text2(c, "Arraste", `${cue} \u2192`.trim(), { x: c.w - c.m - 360, y: c.h - c.bottom - 26, w: 360, size: 26, weight: 600, letterSpacing: 0.12, upper: true, align: "right", color: c.soft })
];
var BUILDERS = {
  // Foto em tela cheia com a manchete no alto, sobre o céu ou o espaço livre da imagem; rodapé com a frase do serviço
  "foto-manchete": (brand, format, spec) => {
    const c = ctxOf(brand, format, true);
    const head = title2(c, spec.title ?? "Seu projeto \xE9 *exclusivo*, seu site tamb\xE9m deveria ser.", { x: c.m, y: c.top + (c.story ? 130 : 96), w: Math.min(c.w - c.m * 2, c.story ? 900 : 780), size: c.story ? 104 : 80, letterSpacing: -0.04, lineHeight: 1.05, maxLines: 4 });
    const foot = c.h - c.bottom - (c.story ? 20 : 0);
    return slide2(c.p.ink, [
      image2("Foto", spec.photo ?? "", { x: 0, y: 0, w: c.w, h: c.h, ...spec.photo ? {} : { prompt: scene2(spec, spec.title ?? "a contemporary house, natural light, calm") } }),
      rect2("V\xE9u do topo", { x: 0, y: 0, w: c.w, h: Math.round(c.h * 0.52), fill: alpha(c.p.ink, 0.36), fill2: alpha(c.p.ink, 0), angle: 180 }),
      rect2("V\xE9u da base", { x: 0, y: Math.round(c.h * 0.82), w: c.w, h: c.h - Math.round(c.h * 0.82), fill: alpha(c.p.ink, 0), fill2: alpha(c.p.ink, 0.32), angle: 180 }),
      ...header(c),
      head,
      ...spec.body ? [rect2("Selo", { x: c.m, y: foot - 22, w: 10, h: 10, fill: c.hi }), text2(c, "Rodap\xE9", spec.body, { x: c.m + 26, y: foot - 36, w: c.w - c.m * 2 - 26, size: c.story ? 32 : 26, weight: 400, letterSpacing: -0.01, color: c.fg })] : []
    ]);
  },
  // Carrossel viral: foto grande, título pesado, número e dado em destaque
  "viral-capa": (brand, format, spec) => {
    const c = ctxOf(brand, format, true);
    const tall = c.h > 1500;
    const bottom = c.h - c.bottom - (c.story ? 24 : 96);
    const body = spec.body ? fit2(text2(c, "Apoio", spec.body, { x: c.m, y: 0, w: c.w - c.m * 2, size: 34, weight: 500, lineHeight: 1.28, color: "rgba(255,255,255,0.8)" }), 2, 0.8) : void 0;
    const bodyBox = body ? { ...body, y: bottom - heightOf2(body) } : void 0;
    const head = title2(c, spec.title ?? "Como a marca *conquistou* todo mundo", { x: c.m, y: 0, w: c.w - c.m * 2, size: tall ? 148 : 124, weight: 800, lineHeight: 0.96, letterSpacing: -0.028, color: "#ffffff", emphasisColor: c.hi, maxLines: 5 });
    const headBox = { ...head, y: (bodyBox ? bodyBox.y - 40 : bottom) - heightOf2(head) };
    return slide2(c.p.ink, [
      image2("Foto de capa", "", { x: 0, y: 0, w: c.w, h: c.h, prompt: scene2(spec, spec.title ?? "a person at work, candid portrait") }),
      ...scrim(c, 0.28, c.p.ink),
      rect2("Degrad\xEA do topo", { x: 0, y: 0, w: c.w, h: Math.round(c.h * 0.18), fill: alpha(c.p.ink, 0.55), fill2: alpha(c.p.ink, 0), angle: 180 }),
      rect2("Selo", { x: c.m, y: c.top, w: 16, h: 16, fill: c.p.accent }),
      text2(c, "R\xF3tulo", spec.label ?? "An\xE1lise", { x: c.m + 34, y: c.top - 6, w: c.w - c.m * 2 - 34, size: 26, weight: 700, letterSpacing: 0.16, upper: true, color: "#ffffff" }),
      headBox,
      ...bodyBox ? [bodyBox] : [],
      ...swipe(c)
    ]);
  },
  "viral-foto": (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? false);
    const limit = c.h - c.bottom - (c.story ? 24 : 96);
    const numH = 150;
    const head0 = title2(c, spec.title ?? "O detalhe que *ningu\xE9m* percebeu", { x: c.m, y: 0, w: c.w - c.m * 2, size: c.h > 1500 ? 84 : 74, weight: 800, lineHeight: 1, letterSpacing: -0.022, maxLines: 3 });
    const body0 = fit2(text2(c, "Apoio", spec.body ?? "Uma frase curta que explica o ponto e faz a pessoa querer ver o pr\xF3ximo slide.", { x: c.m, y: 0, w: c.w - c.m * 2, size: 34, weight: 400, lineHeight: 1.3, color: c.soft }), 3, 0.78);
    const textH = numH + 20 + heightOf2(head0) + 28 + heightOf2(body0);
    const imgH = Math.round(Math.min(c.h * 0.5, Math.max(c.h * 0.34, limit - textH - 56)));
    const numY = imgH + 44;
    const headY = numY + numH + 20;
    return slide2(bg(c), [
      image2("Foto", "", { x: 0, y: 0, w: c.w, h: imgH, prompt: scene2(spec, spec.title ?? "a candid editorial photograph") }),
      rect2("Faixa", { x: 0, y: imgH, w: c.w, h: 10, fill: c.p.accent }),
      text2(c, "N\xFAmero", spec.number ?? "01", { x: c.m, y: numY, w: 300, size: numH, weight: 800, letterSpacing: -0.04, lineHeight: 1, color: c.hi, font: c.brand.headingFont }),
      { ...head0, y: headY },
      { ...body0, y: headY + heightOf2(head0) + 28 },
      ...swipe(c, "")
    ]);
  },
  "viral-dado": (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? true);
    const tall = c.h > 1500;
    const numY = c.h * (tall ? 0.2 : 0.17);
    const numSize = tall ? 400 : 340;
    const head = title2(c, spec.title ?? "das pessoas decidem *em segundos*", { x: c.m, y: numY + numSize + 92, w: c.w - c.m * 2, size: tall ? 96 : 84, weight: 800, lineHeight: 1, letterSpacing: -0.022, maxLines: 4 });
    return slide2(bg(c), [
      ...backdrop(c, [[c.w - 460, -220, 800]]),
      text2(c, "R\xF3tulo", spec.label ?? "O n\xFAmero", { x: c.m, y: c.top, w: c.w - c.m * 2, size: 26, weight: 700, letterSpacing: 0.16, upper: true, color: c.hi }),
      text2(c, "Dado", spec.number ?? "73%", { x: c.m - 8, y: numY, w: c.w - c.m * 2 + 16, size: numSize, weight: 800, letterSpacing: -0.045, lineHeight: 0.95, color: c.hi, font: c.brand.headingFont }),
      rect2("Linha", { x: c.m, y: numY + numSize + 36, w: 140, h: 10, fill: c.fg }),
      head,
      ...spec.body ? [text2(c, "Fonte", spec.body, { x: c.m, y: c.h - c.bottom - 70, w: c.w - c.m * 2 - 360, size: 26, weight: 500, color: c.soft })] : [],
      ...swipe(c)
    ]);
  },
  "viral-frase": (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? false);
    const tall = c.h > 1500;
    const top = c.h * 0.22;
    const head = title2(c, spec.title ?? "Marca forte n\xE3o *explica*. Ela se faz lembrar.", { x: c.m + 56, y: top, w: c.w - c.m * 2 - 56, size: tall ? 120 : 100, weight: 800, lineHeight: 1.02, letterSpacing: -0.025, maxLines: 6 });
    const h = heightOf2(head);
    return slide2(bg(c), [
      rect2("Barra", { x: c.m, y: top, w: 14, h, fill: c.p.accent }),
      text2(c, "R\xF3tulo", spec.label ?? "O insight", { x: c.m + 56, y: top - 70, w: c.w - c.m * 2, size: 26, weight: 700, letterSpacing: 0.16, upper: true, color: c.hi }),
      head,
      ...spec.body ? [fit2(text2(c, "Fonte", spec.body, { x: c.m + 56, y: top + h + 44, w: c.w - c.m * 2 - 56, size: 34, weight: 500, lineHeight: 1.3, color: c.soft }), 3, 0.8)] : [],
      ...swipe(c)
    ]);
  },
  "viral-fecho": (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? true);
    const rows2 = spec.items?.length ? spec.items : ["Salve para consultar depois", "Envie para quem precisa ver", "Siga para ver o pr\xF3ximo"];
    const top = c.h * 0.5;
    return slide2(bg(c), [
      ...backdrop(c, [[-260, c.h - 560, 700]]),
      text2(c, "R\xF3tulo", spec.label ?? "Gostou?", { x: c.m, y: c.top, w: c.w - c.m * 2, size: 26, weight: 700, letterSpacing: 0.16, upper: true, color: c.hi }),
      title2(c, spec.title ?? "Isso vale *ouro*. N\xE3o deixe passar.", { x: c.m, y: c.h * 0.16, w: c.w - c.m * 2, size: c.h > 1500 ? 128 : 108, weight: 800, lineHeight: 0.98, letterSpacing: -0.028 }),
      ...rows2.slice(0, 4).flatMap((r, i) => [
        rect2(`Linha ${i + 1}`, { x: c.m, y: top + i * 130, w: c.w - c.m * 2, h: 2, fill: c.fg, opacity: 0.16 }),
        rect2(`Ponto ${i + 1}`, { x: c.m, y: top + i * 130 + 48, w: 22, h: 22, fill: c.hi }),
        text2(c, `Item ${i + 1}`, r, { x: c.m + 56, y: top + i * 130 + 34, w: c.w - c.m * 2 - 56, size: 46, weight: 600, letterSpacing: -0.02 })
      ]),
      text2(c, "Contato", spec.body ?? "@seuperfil", { x: c.m, y: c.h - c.bottom - 40, w: c.w - c.m * 2 - 120, size: 36, weight: 700, color: c.hi }),
      square(c, c.w - c.m - 70, c.h - c.bottom - 70, 48)
    ]);
  },
  manifesto: (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? true);
    const tall = c.h > 1500;
    return slide2(bg(c), [
      ...backdrop(c, [[c.w - 420, -160, 760], [-260, c.h - 520, 640]]),
      ...header(c, spec.label ?? c.brand.name),
      title2(c, spec.title ?? "Sites com *acabamento* de est\xFAdio.", { x: c.m, y: c.h * (tall ? 0.3 : 0.27), w: c.w - c.m * 2, size: tall ? 150 : 132 }),
      text2(c, "Apoio", spec.body ?? "Identidade, texto e movimento trabalhando juntos.", { x: c.m, y: c.h - c.bottom - 190, w: c.w - c.m * 2 - 220, size: 38, color: c.soft, lineHeight: 1.3 }),
      square(c, c.w - c.m - 70, c.h - c.bottom - 70, 48)
    ]);
  },
  "case-janela": (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? false);
    const k = caseOf2(spec);
    const view = spec.view ?? "pagina";
    const img = caseImage(k, view === "celular" ? "pagina" : view);
    const winW = c.w - c.m * 2;
    const winH = Math.min(Math.round(winW * (view === "capa" ? 0.64 : 0.74)), c.h - 520);
    return slide2(bg(c), [
      ...backdrop(c, [[c.w - 360, -200, 560]]),
      ...header(c, spec.label ?? `Case \xB7 ${k.segment}`),
      title2(c, spec.title ?? `${k.name}, *em tela cheia*.`, { x: c.m, y: c.top + 120, w: winW, size: c.h > 1500 ? 108 : 92 }),
      image2("Tela do case", img.src, { x: c.m, y: c.h - c.bottom - 60 - winH, w: winW, h: winH, frame: "browser", focusY: spec.focus ?? 0 }),
      caseFoot(c, k.name, k.place)
    ]);
  },
  "case-duo": (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? true);
    const k = caseOf2(spec);
    const page = caseImage(k, "pagina");
    const phone = caseImage(k, "celular");
    const winW = Math.round(c.w * 0.74);
    const winH = Math.round(winW * 0.7);
    const phW = Math.round(c.w * 0.3);
    const phH = Math.round(phW * 2.05);
    const baseY = c.h - c.bottom - 60;
    return slide2(bg(c), [
      ...backdrop(c, [[-280, c.h * 0.3, 700]]),
      ...header(c, spec.label ?? "Computador e celular"),
      title2(c, spec.title ?? `${k.name} nas *duas telas*.`, { x: c.m, y: c.top + 120, w: c.w - c.m * 2, size: c.h > 1500 ? 104 : 88 }),
      image2("Tela do computador", page.src, { x: c.m, y: baseY - winH - phH * 0.18, w: winW, h: winH, frame: "browser", focusY: spec.focus ?? 0 }),
      image2("Tela do celular", phone.src, { x: c.w - c.m - phW, y: baseY - phH, w: phW, h: phH, frame: "phone", focusY: spec.focus ?? 0 }),
      caseFoot(c, k.name, k.place)
    ]);
  },
  "case-capa": (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? false);
    const k = caseOf2(spec);
    const cover = caseImage(k, "capa");
    const imgH = Math.round(c.h * (c.story ? 0.42 : 0.52));
    return slide2(bg(c), [
      image2("Capa do case", cover.src, { x: 0, y: 0, w: c.w, h: imgH, focusY: 0 }),
      label2(c, spec.label ?? k.segment, { x: c.m, y: imgH + 70, w: c.w - c.m * 2 }),
      title2(c, spec.title ?? `${k.name}.`, { x: c.m, y: imgH + 120, w: c.w - c.m * 2, size: 140 }),
      text2(c, "Apoio", spec.body ?? k.summary, { x: c.m, y: c.h - c.bottom - 150, w: c.w - c.m * 2 - 100, size: 32, color: c.soft, lineHeight: 1.3 }),
      square(c, c.w - c.m - 56, c.h - c.bottom - 56, 36)
    ]);
  },
  ilustracao: (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? true);
    const art = ILLUSTRATIONS.find((i) => i.id === spec.illustration) ?? ILLUSTRATIONS[0];
    const artW = c.w - c.m * 2;
    const artH = Math.min(Math.round(artW * art.height / art.width), Math.round(c.h * 0.42));
    return slide2(bg(c), [
      ...backdrop(c, [[c.w - 300, c.h * 0.5, 600]]),
      ...header(c, spec.label),
      title2(c, spec.title ?? "Seu site tem *poucos segundos*.", { x: c.m, y: c.top + 120, w: c.w - c.m * 2, size: c.h > 1500 ? 112 : 96 }),
      image2("Ilustra\xE7\xE3o", art.src, { x: c.m, y: c.h - c.bottom - 150 - artH, w: artW, h: artH, fit: "contain" }),
      text2(c, "Apoio", spec.body ?? "", { x: c.m, y: c.h - c.bottom - 120, w: c.w - c.m * 2, size: 34, color: c.soft, lineHeight: 1.3 })
    ]);
  },
  lista: (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? false);
    const rows2 = spec.items?.length ? spec.items : ["O site n\xE3o aparece quando procuram.", "Quem chega no celular desiste.", "O WhatsApp quase n\xE3o toca."];
    const top = c.h * 0.4;
    const step = Math.min(200, (c.h - top - c.bottom - 40) / rows2.length);
    return slide2(bg(c), [
      ...backdrop(c, [[c.w - 380, -240, 620]]),
      ...header(c, spec.label ?? "Soa familiar?"),
      title2(c, spec.title ?? "Seu site *faz isso*?", { x: c.m, y: c.top + 120, w: c.w - c.m * 2, size: c.h > 1500 ? 120 : 104 }),
      ...rows2.slice(0, 4).flatMap((r, i) => [
        rect2(`Linha ${i + 1}`, { x: c.m, y: top + i * step, w: c.w - c.m * 2, h: 2, fill: c.fg, opacity: 0.16 }),
        rect2(`Ponto ${i + 1}`, { x: c.m, y: top + i * step + 62, w: 22, h: 22, fill: c.hi }),
        text2(c, `Item ${i + 1}`, r, { x: c.m + 66, y: top + i * step + 40, w: c.w - c.m * 2 - 66, size: 50, weight: 500, letterSpacing: -0.02 })
      ])
    ]);
  },
  cta: (brand, format, spec) => {
    const c = ctxOf(brand, format, spec.dark ?? true);
    const y = c.h * 0.3;
    return slide2(bg(c), [
      ...backdrop(c, [[c.w - 460, c.h - 560, 760], [-300, -200, 560]]),
      ...header(c, spec.label ?? "Pr\xF3ximo passo"),
      title2(c, spec.title ?? "Veja o site do seu neg\xF3cio *antes* de fechar.", { x: c.m, y, w: c.w - c.m * 2, size: c.h > 1500 ? 128 : 112 }),
      rect2("Bot\xE3o", { x: c.m, y: y + 520, w: 520, h: 104, fill: c.p.accent, radius: buttonRadiusOf(c.brand, 104) }),
      text2(c, "Bot\xE3o", spec.cta ?? "Pe\xE7a uma pr\xE9via", { x: c.m + 44, y: y + 520 + 30, w: 440, size: 38, weight: 600, color: c.p.onAccent }),
      text2(c, "Contato", spec.body ?? c.brand.name, { x: c.m, y: c.h - c.bottom - 40, w: c.w - c.m * 2, size: 34, color: c.soft }),
      square(c, c.w - c.m - 70, c.h - c.bottom - 70, 48)
    ]);
  }
};
var buildSlide = (spec, brand, format, at) => {
  const s = typeof spec === "string" ? { template: spec } : spec;
  if (brand.look === "editorial") return (EDITORIAL[s.template] ?? EDITORIAL.manifesto)(brand, format, s, at);
  return (BUILDERS[s.template] ?? BUILDERS.manifesto)(brand, format, s);
};
var buildPost = (model, brand, opts = {}) => ({
  id: uid(),
  name: model.name,
  format: model.format,
  caption: model.caption,
  slides: model.slides.map((s, index) => buildSlide(s, brand, model.format, { index, total: model.slides.length, series: opts.series }))
});

// src/features/criativos/svg.ts
var esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var n = (v) => (Math.round(v * 100) / 100).toString();
function paint(color) {
  const m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?\s*\)$/i.exec(color.trim());
  if (m) {
    const a = m[4] === void 0 ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { c: `rgb(${m[1]},${m[2]},${m[3]})`, o: a < 1 ? a : void 0 };
  }
  const h = /^#([0-9a-f]{6})([0-9a-f]{2})$/i.exec(color.trim());
  if (h) return { c: `#${h[1]}`, o: parseInt(h[2], 16) / 255 };
  if (color.trim() === "transparent") return { c: "#000", o: 0 };
  return { c: color };
}
var fillAttr = (color, name = "fill") => {
  const p = paint(color);
  return `${name}="${esc(p.c)}"${p.o !== void 0 ? ` ${name}-opacity="${n(p.o)}"` : ""}`;
};
var rectPath = (x, y, w, h, r) => {
  const [tl, tr, br, bl] = (Array.isArray(r) ? r : [r, r, r, r]).map((v) => Math.max(0, Math.min(v, w / 2, h / 2)));
  return `M${n(x + tl)},${n(y)}H${n(x + w - tr)}${tr ? `A${n(tr)},${n(tr)} 0 0 1 ${n(x + w)},${n(y + tr)}` : ""}V${n(y + h - br)}${br ? `A${n(br)},${n(br)} 0 0 1 ${n(x + w - br)},${n(y + h)}` : ""}H${n(x + bl)}${bl ? `A${n(bl)},${n(bl)} 0 0 1 ${n(x)},${n(y + h - bl)}` : ""}V${n(y + tl)}${tl ? `A${n(tl)},${n(tl)} 0 0 1 ${n(x + tl)},${n(y)}` : ""}Z`;
};
var Defs = class {
  items = [];
  i = 0;
  id(prefix) {
    return `${prefix}${++this.i}`;
  }
};
function textSvg(layer) {
  return placeText(layer).map((r) => {
    const p = paint(r.color);
    return `<text x="${n(r.x)}" y="${n(r.y)}" font-family="${esc(r.font)}" font-size="${n(r.size)}" font-weight="${r.weight}"${r.italic ? ' font-style="italic"' : ""}${r.letterSpacing ? ` letter-spacing="${n(r.letterSpacing)}"` : ""} fill="${esc(p.c)}"${p.o !== void 0 ? ` fill-opacity="${n(p.o)}"` : ""} xml:space="preserve">${esc(r.text)}</text>`;
  }).join("");
}
function shadow(defs, color, blur, dy) {
  const id = defs.id("s");
  const p = paint(color);
  defs.items.push(`<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="${n(dy)}" stdDeviation="${n(blur / 2)}" flood-color="${esc(p.c)}" flood-opacity="${n(p.o ?? 1)}"/></filter>`);
  return id;
}
function imageInBox(defs, img, layer, x, y, w, h, clip) {
  const id = defs.id("c");
  defs.items.push(`<clipPath id="${id}"><path d="${clip}"/></clipPath>`);
  if (!img) return `<path d="${clip}" fill="#d9d7d2"/>`;
  const scale = (layer.fit === "cover" ? Math.max : Math.min)(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = x + (w - dw) / 2;
  const dy = layer.fit === "cover" ? y + (h - dh) * (layer.focusY ?? 0) : y + (h - dh) / 2;
  return `<g clip-path="url(#${id})"><image href="${img.href}" x="${n(dx)}" y="${n(dy)}" width="${n(dw)}" height="${n(dh)}" preserveAspectRatio="none"/></g>`;
}
function imageSvg(defs, layer, image3) {
  const { x, y, w, h } = layer;
  const img = layer.src ? image3(layer.src) : void 0;
  if (!img && !layer.src && layer.prompt) {
    const id = defs.id("c");
    defs.items.push(`<clipPath id="${id}"><path d="${rectPath(x, y, w, h, layer.radius)}"/></clipPath>`);
    const stripes = [];
    for (let k = -h; k < w; k += 90) stripes.push(`<line x1="${n(x + k)}" y1="${n(y + h)}" x2="${n(x + k + h)}" y2="${n(y)}"/>`);
    const size = Math.max(24, Math.min(46, Math.round(w * 0.045)));
    return `<g clip-path="url(#${id})"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="#cfcfca"/><g stroke="#ffffff" stroke-opacity="0.35" stroke-width="36">${stripes.join("")}</g><text x="${n(x + w / 2)}" y="${n(y + h / 2 + size * 0.35)}" text-anchor="middle" font-family="Inter" font-weight="600" font-size="${size}" fill="#000" fill-opacity="0.55">${layer.genFailed ? "Imagem n\xE3o gerada" : "Foto a gerar no editor"}</text></g>`;
  }
  if (layer.frame === "browser") {
    const bar = Math.max(34, Math.round(w * 0.045));
    const radius = Math.round(w * 0.018);
    const s = shadow(defs, "rgba(0,0,0,0.28)", w * 0.06, w * 0.02);
    const dot = bar * 0.12;
    return [
      `<path d="${rectPath(x, y, w, h, radius)}" fill="#f3f3f1" filter="url(#${s})"/>`,
      `<path d="${rectPath(x, y, w, bar, [radius, radius, 0, 0])}" fill="#e4e3df"/>`,
      ...["#ff5f57", "#febc2e", "#28c840"].map((c, i) => `<circle cx="${n(x + bar * 0.5 + i * dot * 3)}" cy="${n(y + bar / 2)}" r="${n(dot)}" fill="${c}"/>`),
      imageInBox(defs, img, layer, x, y + bar, w, h - bar, rectPath(x, y + bar, w, h - bar, [0, 0, radius, radius]))
    ].join("");
  }
  if (layer.frame === "phone") {
    const bezel = Math.round(w * 0.035);
    const radius = Math.round(w * 0.14);
    const s = shadow(defs, "rgba(0,0,0,0.32)", w * 0.08, w * 0.03);
    const pw = w * 0.26;
    return [
      `<path d="${rectPath(x, y, w, h, radius)}" fill="#121212" filter="url(#${s})"/>`,
      imageInBox(defs, img, layer, x + bezel, y + bezel, w - bezel * 2, h - bezel * 2, rectPath(x + bezel, y + bezel, w - bezel * 2, h - bezel * 2, radius - bezel)),
      `<path d="${rectPath(x + (w - pw) / 2, y + w * 0.055, pw, w * 0.06, w * 0.03)}" fill="#121212"/>`
    ].join("");
  }
  return imageInBox(defs, img, layer, x, y, w, h, rectPath(x, y, w, h, layer.radius));
}
function shapeSvg(defs, layer) {
  let fill = fillAttr(layer.fill);
  if (layer.fill2) {
    const a = (layer.angle ?? 180) % 360 * Math.PI / 180;
    const cx = layer.x + layer.w / 2;
    const cy = layer.y + layer.h / 2;
    const half = (Math.abs(layer.w * Math.sin(a)) + Math.abs(layer.h * Math.cos(a))) / 2;
    const dx = Math.sin(a) * half;
    const dy = -Math.cos(a) * half;
    const id = defs.id("g");
    const s0 = paint(layer.fill);
    const s1 = paint(layer.fill2);
    defs.items.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n(cx - dx)}" y1="${n(cy - dy)}" x2="${n(cx + dx)}" y2="${n(cy + dy)}"><stop offset="0" stop-color="${esc(s0.c)}" stop-opacity="${n(s0.o ?? 1)}"/><stop offset="1" stop-color="${esc(s1.c)}" stop-opacity="${n(s1.o ?? 1)}"/></linearGradient>`);
    fill = `fill="url(#${id})"`;
  }
  const stroke = layer.stroke && layer.strokeWidth ? ` ${fillAttr(layer.stroke, "stroke")} stroke-width="${n(layer.strokeWidth)}"` : "";
  return `<path d="${rectPath(layer.x, layer.y, layer.w, layer.h, layer.radius)}" ${fill}${stroke}/>`;
}
function layerSvg(defs, layer, image3) {
  let body = "";
  if (layer.type === "text") body = textSvg(layer);
  else if (layer.type === "image") body = imageSvg(defs, layer, image3);
  else if (layer.type === "ring") body = `<ellipse cx="${n(layer.x + layer.w / 2)}" cy="${n(layer.y + layer.h / 2)}" rx="${n(layer.w / 2)}" ry="${n(layer.h / 2)}" fill="none" ${fillAttr(layer.stroke, "stroke")} stroke-width="${n(layer.strokeWidth)}"/>`;
  else if (layer.type === "dots") {
    const id = defs.id("p");
    const clip = defs.id("c");
    defs.items.push(`<pattern id="${id}" patternUnits="userSpaceOnUse" x="${n(layer.x)}" y="${n(layer.y)}" width="${n(layer.gap)}" height="${n(layer.gap)}"><rect x="${n(layer.gap / 2 - layer.dot / 2)}" y="${n(layer.gap / 2 - layer.dot / 2)}" width="${n(layer.dot)}" height="${n(layer.dot)}" ${fillAttr(layer.color)}/></pattern>`);
    defs.items.push(`<clipPath id="${clip}"><rect x="${n(layer.x)}" y="${n(layer.y)}" width="${n(layer.w)}" height="${n(layer.h)}"/></clipPath>`);
    body = `<rect x="${n(layer.x)}" y="${n(layer.y)}" width="${n(layer.w)}" height="${n(layer.h)}" fill="url(#${id})" clip-path="url(#${clip})"/>`;
  } else body = shapeSvg(defs, layer);
  const attrs = [];
  if ((layer.opacity ?? 1) < 1) attrs.push(`opacity="${n(layer.opacity ?? 1)}"`);
  if (layer.rotation) {
    const b = layerBox(layer);
    attrs.push(`transform="rotate(${n(layer.rotation)} ${n(b.x + b.w / 2)} ${n(b.y + b.h / 2)})"`);
  }
  return attrs.length ? `<g ${attrs.join(" ")}>${body}</g>` : body;
}
function slideToSvg(slide3, format, image3 = () => void 0) {
  const { width, height } = sizeOf(format);
  const defs = new Defs();
  const body = slide3.layers.filter((l) => !l.hidden).map((l) => layerSvg(defs, l, image3)).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${defs.items.join("")}</defs><rect width="${width}" height="${height}" ${fillAttr(slide3.background)}/>${body}</svg>`;
}
var slideImages = (slide3) => slide3.layers.filter((l) => l.type === "image" && !l.hidden && !!l.src).map((l) => l.src);

// src/features/criativos/indexMerge.ts
var same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function indexChanges(before, after) {
  const old = new Map(before.map((r) => [r.id, r]));
  const ids = new Set(after.map((r) => r.id));
  return {
    upserts: after.filter((r) => !same(old.get(r.id), r)),
    removed: [...old.keys()].filter((id) => !ids.has(id))
  };
}
function indexHolds(list, upserts, removed) {
  const byId = new Map(list.map((r) => [r.id, r]));
  return upserts.every((r) => {
    const now = byId.get(r.id);
    return !!now && (same(now, r) || (now.updatedAt ?? 0) > (r.updatedAt ?? 0));
  }) && removed.every((id) => !byId.has(id));
}
async function writeIndexSafely(read, write, change, tries = 3) {
  let list = await read() ?? [];
  let next = list;
  for (let i = 0; i < tries; i++) {
    next = change(list);
    const { upserts, removed } = indexChanges(list, next);
    if (!upserts.length && !removed.length) return list;
    await write(next);
    const after = await read() ?? [];
    if (indexHolds(after, upserts, removed)) return after;
    list = after;
  }
  return next;
}
function upsertRow(list, id, make) {
  const old = list.find((r) => r.id === id);
  return old ? list.map((r) => r.id === id ? make(r) : r) : [make(void 0), ...list];
}
export {
  buildPost,
  setMeasureContext,
  sizeOf,
  slideImages,
  slideToSvg,
  upsertRow,
  writeIndexSafely
};
