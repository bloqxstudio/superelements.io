import { CHAT_IMAGE_MAX_SIDE, type ChatImageUpload } from './protocol'

/**
 * Imagens anexadas no chat (botão, Ctrl+V ou arrastar): a aba reduz para no
 * máximo `CHAT_IMAGE_MAX_SIDE` no lado maior, o tamanho que os agentes
 * enxergam bem, e faz uma miniatura para a conversa. Foto vira JPEG; imagem
 * com transparência (logo, recorte) continua PNG, para poder ir para a página.
 */

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
/** Arquivo maior que isto nem é aberto (uma foto de celular tem uns 5 MB). */
const MAX_FILE = 40 * 1024 * 1024
const PREVIEW_SIDE = 360

export const isChatImage = (file: File) => ACCEPTED.includes(file.type)

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('O navegador não conseguiu abrir essa imagem.'))
    image.src = src
  })

/** O xadrez de quem edita imagem: um logo branco recortado aparece na miniatura. */
const checker = (ctx: CanvasRenderingContext2D, width: number, height: number, size = 8) => {
  ctx.fillStyle = '#f3f4f6'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#d1d5db'
  for (let y = 0; y < height; y += size) for (let x = (y / size) % 2 ? size : 0; x < width; x += size * 2) ctx.fillRect(x, y, size, size)
}

const draw = (image: HTMLImageElement, side: number, background?: 'checker') => {
  const scale = Math.min(1, side / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('O navegador não conseguiu ler a imagem.')
  if (background) checker(ctx, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return { canvas, ctx }
}

const hasTransparency = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const { data } = ctx.getImageData(0, 0, width, height)
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true
  return false
}

export async function readChatImage(file: File): Promise<ChatImageUpload> {
  if (!isChatImage(file)) throw new Error(`${file.name || 'Esse arquivo'}: use PNG, JPG, WebP ou GIF.`)
  if (file.size > MAX_FILE) throw new Error(`${file.name}: a imagem passa de 40 MB.`)
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    const { canvas, ctx } = draw(image, CHAT_IMAGE_MAX_SIDE)
    const alpha = file.type !== 'image/jpeg' && hasTransparency(ctx, canvas.width, canvas.height)
    const data = alpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.88)
    // A miniatura é JPEG: o recorte vai sobre o xadrez, e não sobre o preto
    const preview = draw(image, PREVIEW_SIDE, alpha ? 'checker' : undefined).canvas.toDataURL('image/jpeg', 0.8)
    const name = file.name && !/^image\.(png|jpe?g)$/i.test(file.name) ? file.name : `imagem colada.${alpha ? 'png' : 'jpg'}`
    return { name, data, preview, width: canvas.width, height: canvas.height }
  } finally {
    URL.revokeObjectURL(url)
  }
}
