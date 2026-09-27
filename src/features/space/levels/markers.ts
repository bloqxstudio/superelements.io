/**
 * Marcadores dos níveis de edição dentro da miniatura da seção: uma moldura
 * tracejada em cada peça que a camada mexe e uma etiqueta com o que ela
 * recebe. Ficam numa camada à parte no <body>, posicionada pelo offset dos
 * elementos (que ignora o transform das animações), para não mudar o layout.
 */

export type MarkerTone = 'active' | 'removed'

export interface Marker {
  id: string
  label: string
  tone?: MarkerTone
}

const TONES: Record<MarkerTone, string> = { active: '#7c3aed', removed: '#71717a' }

// A miniatura é a seção em 1440px reduzida a ~32%: a etiqueta precisa ser grande dentro do iframe
const SCRIPT = `
(function () {
  var marks = __MARKS__, tones = __TONES__;
  var layer = document.createElement('div');
  layer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:2147483647';
  document.body.appendChild(layer);
  function offset(el) { var x = 0, y = 0; while (el) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; } return { x: x, y: y }; }
  // Etiqueta que cairia em cima de outra vai para o lado dela (peças pequenas e coladas)
  function place(tag, placed) {
    var x = tag.offsetLeft, y = tag.offsetTop, w = tag.offsetWidth, h = tag.offsetHeight, moved = true;
    while (moved) {
      moved = false;
      for (var i = 0; i < placed.length; i++) {
        var p = placed[i];
        if (x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y) { x = p.x + p.w + 8; moved = true; }
      }
    }
    tag.style.left = x + 'px';
    placed.push({ x: x, y: y, w: w, h: h });
  }
  function draw() {
    layer.textContent = '';
    var placed = [];
    marks.forEach(function (m) {
      document.querySelectorAll('[data-id="' + CSS.escape(m.id) + '"]').forEach(function (el) {
        if (!el.offsetParent) return;
        var o = offset(el), color = tones[m.tone || 'active'];
        var box = document.createElement('div');
        box.style.cssText = 'position:absolute;box-sizing:border-box;border-radius:8px;left:' + o.x + 'px;top:' + o.y + 'px;width:' + el.offsetWidth + 'px;height:' + el.offsetHeight + 'px;border:4px dashed ' + color;
        var tag = document.createElement('div');
        tag.textContent = m.label;
        tag.style.cssText = 'position:absolute;left:' + (o.x + 10) + 'px;top:' + (o.y + 10) + 'px;padding:6px 16px;border-radius:999px;font:600 30px/1.2 system-ui,sans-serif;white-space:nowrap;color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.25);background:' + color + (m.tone === 'removed' ? ';text-decoration:line-through' : '');
        layer.appendChild(box);
        layer.appendChild(tag);
        place(tag, placed);
      });
    });
  }
  draw();
  addEventListener('load', draw);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  new ResizeObserver(draw).observe(document.body);
})();`

const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c')

/** Documento do motor com os marcadores. `replay` muda o documento para o iframe recarregar e rever as animações. */
export function withMarkers(document: string, markers: Marker[], replay = 0): string {
  const script = markers.length ? `<script>${SCRIPT.replace('__MARKS__', () => json(markers)).replace('__TONES__', () => json(TONES))}</script>` : ''
  return document.replace('</body>', () => `${script}<!--se-replay:${replay}--></body>`)
}
