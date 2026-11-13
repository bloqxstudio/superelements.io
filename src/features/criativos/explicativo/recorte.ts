import type { ImageSegmenter } from '@mediapipe/tasks-vision'

/**
 * O recorte da pessoa (2026-11-09; o usuário, vendo o reel "20 video effects in 20 seconds": "podemos fazer
 * esse tipo de coisa? Como máscaras avançadas, como After Effects", e "texto cinético… pra abrir no fundo").
 *
 * O MediaPipe Image Segmenter roda neste navegador (WASM do jsDelivr, modelo do Google, baixados uma vez e
 * guardados no cache) e devolve, para cada quadro do vídeo da pessoa, uma máscara em que o alfa é a pessoa.
 * A máscara vai ao worker da cena junto com o quadro (`env.mask`), e o motor desenha em camadas: o fundo,
 * o que passa atrás, a pessoa recortada e o que vai na frente. Nada sai do computador.
 */

const VERSION = '1.1.1'
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`
/** O multiclasse separa melhor cabelo e roupa; o canal 0 é o fundo. */
const MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite'
/** A largura em que a máscara é calculada: o motor a estica com suavidade até o tamanho do quadro. */
const MASK_W = 512

let loading: Promise<ImageSegmenter | undefined> | undefined

function segmenter(): Promise<ImageSegmenter | undefined> {
  loading ??= (async () => {
    try {
      const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision')
      const files = await FilesetResolver.forVisionTasks(WASM)
      const make = (delegate: 'GPU' | 'CPU') => ImageSegmenter.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false })
      return await make('GPU').catch(() => make('CPU'))
    } catch (e) {
      console.warn('[recorte] o MediaPipe não abriu:', e)
      return undefined
    }
  })()
  return loading
}

/**
 * A máscara da pessoa no quadro: um ImageBitmap do mesmo formato do quadro (MASK_W de largura), branco
 * com o alfa = chance de ser a pessoa. Sem MediaPipe, devolve undefined e o motor desenha sem recorte.
 */
export async function personMask(frame: ImageBitmap): Promise<ImageBitmap | undefined> {
  const seg = await segmenter()
  if (!seg) return undefined
  const w = Math.min(MASK_W, frame.width)
  const h = Math.round((frame.height * w) / frame.width)
  const small = await createImageBitmap(frame, { resizeWidth: w, resizeHeight: h, resizeQuality: 'medium' })
  try {
    const result = seg.segment(small)
    const masks = result.confidenceMasks ?? []
    if (!masks.length) return undefined
    // Multiclasse: 0 = fundo (pessoa = 1 − fundo); modelo de uma classe: 0 = pessoa
    const multi = masks.length > 1
    const conf = masks[0].getAsFloat32Array()
    const mw = masks[0].width, mh = masks[0].height
    const px = new Uint8ClampedArray(mw * mh * 4)
    for (let i = 0; i < conf.length; i++) {
      const p = multi ? 1 - conf[i] : conf[i]
      // Curva que firma o miolo e deixa a borda macia (sem halo do fundo)
      const a = p <= 0.25 ? 0 : p >= 0.75 ? 1 : (p - 0.25) / 0.5
      const o = i * 4
      px[o] = px[o + 1] = px[o + 2] = 255
      px[o + 3] = Math.round(a * a * (3 - 2 * a) * 255)
    }
    for (const m of masks) m.close()
    return await createImageBitmap(new ImageData(px, mw, mh))
  } catch (e) {
    console.warn('[recorte] falhou neste quadro:', e)
    return undefined
  } finally {
    small.close()
  }
}
