/**
 * Imagens de uma página do Elementor. O Elementor não importa mídia ao colar
 * de outro site: a imagem fica apontando para a URL de origem e o `id` é o do
 * anexo no site de origem, que no destino pode ser outra imagem.
 */

type JsonObject = Record<string, unknown>

export interface MediaReplacement {
  id: number
  url: string
}

const isObject = (value: unknown): value is JsonObject => !!value && typeof value === 'object' && !Array.isArray(value)

/**
 * Controle de mídia do Elementor: { url, id, alt, source, size }. Links também
 * têm `url`, mas não têm `id`/`alt`/`source`.
 */
const isMediaValue = (value: JsonObject): value is JsonObject & { url: string } =>
  typeof value.url === 'string' && value.url !== '' && ('id' in value || 'alt' in value || 'source' in value)

function walkSettings(value: unknown, visit: (media: JsonObject & { url: string }) => void) {
  if (Array.isArray(value)) {
    value.forEach((item) => walkSettings(item, visit))
    return
  }
  if (!isObject(value)) return
  if (isMediaValue(value)) visit(value)
  for (const child of Object.values(value)) walkSettings(child, visit)
}

function walkElements(elements: unknown[], visit: (media: JsonObject & { url: string }) => void) {
  for (const el of elements) {
    if (!isObject(el)) continue
    walkSettings(el.settings, visit)
    if (Array.isArray(el.elements)) walkElements(el.elements, visit)
  }
}

/** URLs de imagem usadas na página, sem repetição. */
export function collectImageUrls(elements: unknown[]): string[] {
  const urls = new Set<string>()
  walkElements(elements, (media) => urls.add(media.url))
  return [...urls]
}

/** Imagem que só existe nesta máquina: nenhum servidor WordPress consegue baixá-la. */
export function isLocalUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url, window.location.href)
    if (protocol === 'data:' || protocol === 'blob:') return true
    return ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(hostname) || hostname.endsWith('.local')
  } catch {
    return true
  }
}

/**
 * Troca as imagens enviadas para o site de destino pelo anexo novo e tira o
 * `id` das demais: sem id, o Elementor usa a URL em vez de um anexo errado.
 * Altera os elementos recebidos.
 */
export function applyMediaReplacements(elements: unknown[], replacements: Map<string, MediaReplacement>) {
  walkElements(elements, (media) => {
    const uploaded = replacements.get(media.url)
    if (uploaded) {
      media.id = uploaded.id
      media.url = uploaded.url
      media.source = 'library'
    } else if ('id' in media) {
      // `0` também: o editor só deixa de consultar o servidor com o id vazio
      media.id = ''
    }
  })
  return elements
}

/**
 * Tamanho de imagem `custom` sai como `full`. No editor, o Elementor só desenha
 * o recorte `custom` depois de pedir a imagem ao servidor e, quando ela chega,
 * redesenha apenas o widget aberto no painel: a imagem colada fica em branco até
 * alguém clicar nela. O recorte das seções já é feito por CSS (aspect-ratio e
 * object-fit), e no site o Elementor já usa a URL original quando não há anexo.
 * Altera os elementos recebidos.
 */
export function dropCustomImageSizes(elements: unknown[]) {
  for (const el of elements) {
    if (!isObject(el)) continue
    const { settings } = el
    if (isObject(settings)) {
      for (const [key, value] of Object.entries(settings)) {
        // Group_Control_Image_Size: `<nome>_size` e `<nome>_custom_dimension`
        if (value !== 'custom' || !key.endsWith('_size')) continue
        settings[key] = 'full'
        delete settings[`${key.slice(0, -'_size'.length)}_custom_dimension`]
      }
    }
    if (Array.isArray(el.elements)) dropCustomImageSizes(el.elements)
  }
  return elements
}
