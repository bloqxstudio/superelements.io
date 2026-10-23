import { lookup } from 'node:dns/promises'
import net from 'node:net'

/**
 * Baixa uma imagem da web para o conjunto (a foto de uma página de outro
 * projeto, por exemplo). Roda no computador de quem usa, sem as travas de CORS
 * do navegador. Só aceita https/http públicos e imagens de até 8 MB: endereços
 * da rede local ou do próprio computador são recusados, também depois de
 * redirecionamentos.
 */

const MAX_BYTES = 8 * 1024 * 1024
const MAX_REDIRECTS = 4

const privateIp = (ip: string) => {
  if (net.isIPv6(ip)) return ip === '::1' || /^f[cd]/i.test(ip) || /^fe80/i.test(ip) || ip.startsWith('::ffff:127.') || ip.startsWith('::ffff:10.') || ip.startsWith('::ffff:192.168.')
  const [a, b] = ip.split('.').map(Number)
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
}

async function assertPublic(url: URL) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Só endereços http e https.')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (!host.includes('.') && !net.isIP(host)) throw new Error('Endereço da rede local recusado.')
  const addresses = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  if (!addresses.length || addresses.some((a) => privateIp(a.address))) throw new Error('Endereço da rede local ou do próprio computador recusado.')
}

export async function downloadImage(rawUrl: string, signal?: AbortSignal): Promise<{ data: string; type: string }> {
  let url = new URL(rawUrl)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url)
    const res = await fetch(url, { redirect: 'manual', signal, headers: { accept: 'image/*', 'user-agent': 'Mozilla/5.0 (Superelements criativos)' } })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location')!, url)
      continue
    }
    if (!res.ok) throw new Error(`A imagem respondeu ${res.status}.`)
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(type)) throw new Error('O endereço não é uma imagem PNG, JPG, WebP ou GIF.')
    const length = Number(res.headers.get('content-length') ?? 0)
    if (length > MAX_BYTES) throw new Error('A imagem passa de 8 MB.')
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > MAX_BYTES) throw new Error('A imagem passa de 8 MB.')
    return { data: `data:${type};base64,${buf.toString('base64')}`, type }
  }
  throw new Error('Redirecionamentos demais.')
}
