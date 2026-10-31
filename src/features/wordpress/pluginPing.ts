import { restUrl } from './rest'
import type { WordPressSite } from './rest'

/** Versão do Connector no site (rota pública `ping`, do 0.5), ou null se ele não está instalado e ativo. */
export async function pingConnector(site: WordPressSite): Promise<string | null> {
  try {
    const response = await fetch(restUrl(site.restRoot, 'superelements/v1/ping'), { headers: { Accept: 'application/json' }, cache: 'no-store' })
    if (!response.ok) return null
    const data = (await response.json()) as { plugin?: string; version?: string }
    return data.plugin === 'superelements-connector' ? (data.version ?? '') : null
  } catch {
    return null
  }
}
