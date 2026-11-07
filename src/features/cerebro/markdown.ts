import { Marked, type Tokens } from 'marked'
import { expandWikilinks, folderNote, isVideo, resolveLink, slugify, type Vault } from './vault'

/**
 * Markdown de uma nota em HTML. Os links viram navegação dentro do cérebro (`data-nota`), arquivos do
 * cofre (`data-midia`, o endereço sai depois por `mediaUrl`) ou links da web. HTML cru da nota nunca é desenhado: aparece como texto (comentários somem).
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const plain = (html: string) => html.replace(/<[^>]+>/g, '')

export function renderMarkdown(vault: Vault, path: string, content: string): string {
  const md = new Marked({ gfm: true, breaks: true })
  md.use({
    renderer: {
      html({ text }: Tokens.HTML | Tokens.Tag) {
        return text.trim().startsWith('<!--') ? '' : esc(text)
      },
      heading({ tokens, depth }: Tokens.Heading) {
        const inner = this.parser.parseInline(tokens)
        return `<h${depth} id="h-${slugify(plain(inner))}">${inner}</h${depth}>\n`
      },
      link({ href, tokens }: Tokens.Link) {
        const inner = this.parser.parseInline(tokens)
        const t = resolveLink(vault, path, href)
        switch (t.kind) {
          case 'note':
            return `<a href="?nota=${encodeURIComponent(t.path)}" data-nota="${esc(t.path)}">${inner}</a>`
          case 'folder': {
            const readme = folderNote(vault, t.path)
            return readme
              ? `<a href="?nota=${encodeURIComponent(readme)}" data-nota="${esc(readme)}">${inner}</a>`
              : `<a href="?pasta=${encodeURIComponent(t.path)}" data-pasta="${esc(t.path)}">${inner}</a>`
          }
          case 'media':
            return isVideo(t.path)
              ? `<video data-midia="${esc(t.path)}" controls preload="metadata" playsinline></video>`
              : `<a href="#" data-midia-abrir="${esc(t.path)}">${inner}</a>`
          case 'app':
            return `<a href="${esc(t.route)}" data-rota="${esc(t.route)}">${inner}</a>`
          case 'web':
            return `<a href="${esc(t.url)}" target="_blank" rel="noopener noreferrer" class="cb-web">${inner}</a>`
          default:
            return `<span class="cb-missing" title="Ainda não existe: ${esc(t.path)}">${inner}</span>`
        }
      },
      image({ href, text }: Tokens.Image) {
        const t = resolveLink(vault, path, href)
        if (t.kind === 'media') {
          return isVideo(t.path)
            ? `<video data-midia="${esc(t.path)}" controls preload="metadata" playsinline></video>`
            : `<img data-midia="${esc(t.path)}" alt="${esc(text)}" loading="lazy">`
        }
        if (t.kind === 'web') return `<img src="${esc(t.url)}" alt="${esc(text)}" loading="lazy">`
        return `<span class="cb-missing">Imagem não encontrada: ${esc(text || href)}</span>`
      },
    },
  })
  return md.parse(expandWikilinks(content), { async: false }) as string
}
