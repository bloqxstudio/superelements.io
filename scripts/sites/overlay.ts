/**
 * O script que entra na prévia do site (`astro dev` desta máquina, num iframe do
 * produto), pela integração que o `preview.ts` põe só na prévia: nada vai para o
 * repositório. Fala com a aba por `postMessage`:
 *
 *   prévia → aba  { se: 'ready', path, title }      página carregada
 *                 { se: 'picked', el }               elemento escolhido (PickedElement + rect)
 *                 { se: 'text', el, after }          texto editado na própria página
 *                 { se: 'rect', rect }               o escolhido mudou de lugar (rolagem)
 *   aba → prévia  { se: 'mode', edit }               ligar/desligar a edição
 *                 { se: 'select', file, loc }        escolher de novo (depois de recarregar)
 *                 { se: 'clear' }
 *
 * Fora de um iframe não faz nada. A barra de ferramentas do Astro (ligada só para
 * ter as marcas de arquivo e posição) fica escondida.
 */
export const OVERLAY_JS = String.raw`(() => {
  if (window.parent === window || window.__seEditor) return
  window.__seEditor = true
  const COLOR = '#8B5CF6'
  const SKIP = new Set(['SCRIPT', 'STYLE', 'SVG', 'TEMPLATE', 'NOSCRIPT'])
  let edit = true
  let selected = null
  let editing = null

  // A barra do Astro tira as marcas de arquivo e posição do DOM quando abre (apps/audit): copiamos
  // cada marca para atributos nossos assim que o elemento entra na página, antes dela.
  const copyMark = (el) => {
    const f = el.getAttribute('data-astro-source-file')
    if (!f) return
    el.setAttribute('data-se-file', f)
    el.setAttribute('data-se-loc', el.getAttribute('data-astro-source-loc') || '')
  }
  const scan = (node) => {
    if (!node || node.nodeType !== 1) return
    copyMark(node)
    node.querySelectorAll('[data-astro-source-file]').forEach(copyMark)
  }
  scan(document.documentElement)
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'attributes') copyMark(m.target)
      else m.addedNodes.forEach(scan)
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-astro-source-file'] })

  const style = document.createElement('style')
  style.textContent = 'astro-dev-toolbar{display:none!important}' +
    '.se-box{position:fixed;pointer-events:none;z-index:2147483646;border:1.5px solid ' + COLOR + ';border-radius:2px;transition:all .08s ease-out}' +
    '.se-box.hover{border-style:dashed;opacity:.8}' +
    '.se-tag{position:absolute;left:-1.5px;bottom:100%;margin-bottom:2px;background:' + COLOR + ';color:#fff;font:600 11px/1.6 Inter,system-ui,sans-serif;padding:0 6px;border-radius:3px;white-space:nowrap}' +
    '.se-box.flip .se-tag{bottom:auto;top:100%;margin:2px 0 0}' +
    '[data-se-editing]{outline:2px solid ' + COLOR + '!important;outline-offset:2px;cursor:text!important;caret-color:' + COLOR + '}' +
    'html.se-edit *{cursor:default}'
  document.documentElement.appendChild(style)
  document.documentElement.classList.add('se-edit')

  const box = (cls) => {
    const el = document.createElement('div')
    el.className = 'se-box ' + cls
    el.style.display = 'none'
    const tag = document.createElement('span')
    tag.className = 'se-tag'
    el.appendChild(tag)
    document.documentElement.appendChild(el)
    return el
  }
  const hoverBox = box('hover')
  const pickBox = box('pick')

  const post = (data) => window.parent.postMessage(Object.assign({ seEditor: 1 }, data), '*')
  const fileOf = (el) => el && el.getAttribute && (el.getAttribute('data-se-file') || el.getAttribute('data-astro-source-file'))
  const locOf = (el) => el.getAttribute('data-se-loc') || el.getAttribute('data-astro-source-loc')
  const short = (file) => (file || '').split('/').pop()
  const annotated = (el) => {
    while (el && el.nodeType === 1 && !fileOf(el)) el = el.parentElement
    return el && el.nodeType === 1 ? el : null
  }
  const target = (node) => {
    let el = node && node.nodeType === 1 ? node : node && node.parentElement
    if (!el) return null
    const svg = el.closest('svg')
    if (svg) el = svg
    return annotated(el)
  }

  const norm = (s) => s.replace(/[ \t\n\r\f]+/g, ' ').trim()
  const segments = (el) => {
    const file = fileOf(el)
    const out = []
    const visit = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) {
          const t = norm(child.nodeValue || '')
          if (t) out.push(t)
        } else if (child.nodeType === 1) {
          if (SKIP.has(child.tagName.toUpperCase())) continue
          const f = fileOf(child)
          if (f && f !== file) continue
          visit(child)
        }
      }
    }
    visit(el)
    return out
  }
  const attrs = (el) => {
    const out = {}
    for (const name of ['href', 'src', 'alt', 'title', 'target', 'aria-label', 'placeholder']) if (el.hasAttribute(name)) out[name] = el.getAttribute(name)
    return out
  }
  const chain = (el) => {
    const files = []
    for (let p = el; p; p = p.parentElement) {
      const f = fileOf(p)
      if (f && files[files.length - 1] !== f) files.push(f)
    }
    return files
  }
  const rectOf = (el) => {
    const r = el.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height }
  }
  const describe = (el) => ({
    file: fileOf(el),
    loc: locOf(el),
    tag: el.tagName.toLowerCase(),
    segments: segments(el),
    attrs: attrs(el),
    chain: chain(el),
    rect: rectOf(el),
    text: norm(el.innerText || '').slice(0, 300),
  })

  const place = (b, el, label) => {
    if (!el || !el.isConnected) return void (b.style.display = 'none')
    const r = el.getBoundingClientRect()
    Object.assign(b.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' })
    b.classList.toggle('flip', r.top < 22)
    b.firstChild.textContent = label
  }
  const label = (el) => el.tagName.toLowerCase() + ' · ' + short(fileOf(el))
  const refresh = () => {
    if (selected) {
      place(pickBox, selected, label(selected))
      post({ se: 'rect', rect: rectOf(selected) })
    }
  }

  const select = (el, quiet) => {
    selected = el
    place(pickBox, el, label(el))
    if (!quiet) post({ se: 'picked', el: describe(el) })
  }

  const stopEditing = (commit) => {
    if (!editing) return
    const { el, before, html } = editing
    editing = null
    el.removeAttribute('contenteditable')
    el.removeAttribute('data-se-editing')
    if (!commit) return void (el.innerHTML = html)
    const after = segments(el)
    if (after.join('\u0000') === before.segments.join('\u0000')) return
    post({ se: 'text', el: before, after })
  }

  const startEditing = (el) => {
    if (editing) stopEditing(true)
    const info = describe(el)
    if (!info.segments.length) return
    editing = { el, before: info, html: el.innerHTML }
    try {
      el.contentEditable = 'plaintext-only'
    } catch (e) {
      el.contentEditable = 'true'
    }
    if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true'
    el.setAttribute('data-se-editing', '')
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
  }

  document.addEventListener('mousemove', (e) => {
    if (!edit || editing) return void (hoverBox.style.display = 'none')
    const el = target(e.target)
    if (!el || el === selected) return void (hoverBox.style.display = 'none')
    place(hoverBox, el, label(el))
  }, true)
  document.addEventListener('mouseleave', () => (hoverBox.style.display = 'none'))

  const block = (e) => {
    if (!edit) return
    if (editing && editing.el.contains(e.target)) return
    e.preventDefault()
    e.stopPropagation()
  }
  for (const type of ['mousedown', 'pointerdown', 'submit', 'auxclick']) document.addEventListener(type, block, true)
  document.addEventListener('click', (e) => {
    if (!edit) return
    if (editing && editing.el.contains(e.target)) return
    e.preventDefault()
    e.stopPropagation()
    if (editing) stopEditing(true)
    const el = target(e.target)
    if (el) select(el)
  }, true)
  document.addEventListener('dblclick', (e) => {
    if (!edit) return
    e.preventDefault()
    e.stopPropagation()
    const el = target(e.target)
    if (!el) return
    select(el)
    startEditing(el)
  }, true)
  document.addEventListener('keydown', (e) => {
    if (!editing) return
    if (e.key === 'Escape') {
      e.preventDefault()
      stopEditing(false)
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      stopEditing(true)
    }
  }, true)
  document.addEventListener('focusout', (e) => {
    if (editing && e.target === editing.el) stopEditing(true)
  }, true)
  addEventListener('scroll', refresh, true)
  addEventListener('resize', refresh)

  addEventListener('message', (e) => {
    if (e.source !== window.parent || !e.data || typeof e.data.se !== 'string') return
    const m = e.data
    if (m.se === 'mode') {
      edit = !!m.edit
      document.documentElement.classList.toggle('se-edit', edit)
      if (!edit) {
        stopEditing(true)
        hoverBox.style.display = 'none'
        pickBox.style.display = 'none'
      } else if (selected) place(pickBox, selected, label(selected))
    } else if (m.se === 'select') {
      const el = document.querySelector('[data-se-file="' + CSS.escape(m.file) + '"][data-se-loc="' + CSS.escape(m.loc) + '"]')
      if (el) {
        select(el, false)
        if (m.scroll) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      } else {
        selected = null
        pickBox.style.display = 'none'
        post({ se: 'lost' })
      }
    } else if (m.se === 'clear') {
      selected = null
      pickBox.style.display = 'none'
    } else if (m.se === 'edit-text' && selected) {
      startEditing(selected)
    }
  })

  const ready = () => post({ se: 'ready', path: location.pathname + location.search, title: document.title, annotated: !!document.querySelector('[data-se-file]') })
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready)
  else ready()
  // Transições de página do Astro (ClientRouter) trocam a página sem recarregar
  document.addEventListener('astro:page-load', ready)
})()`
