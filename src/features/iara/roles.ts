/**
 * Quem a Iara está copilotando (2026-11-05, o usuário: "a Iara é uma assistente do negócio… vai
 * copilotar o designer, copywriter, gestor de tráfego"). A escolha muda a ênfase dela (o que olha
 * primeiro, que ações sugere) e as sugestões do chat; as ações são as mesmas para todos.
 */

export type IaraRole = 'geral' | 'designer' | 'copy' | 'trafego'

export const ROLES: Record<IaraRole, { label: string; hint: string; persona: string; suggestions: string[] }> = {
  geral: {
    label: 'Geral',
    hint: 'A assistente do negócio: pauta, conteúdo, criativos e números',
    persona: '',
    suggestions: ['Olha o que mais performou no Instagram e me dá 6 ideias na mesma linha', 'Monta a pauta das próximas duas semanas, terças e quintas às 18h', 'Escreve o roteiro das ideias que estão sem roteiro'],
  },
  designer: {
    label: 'Designer',
    hint: 'Copilota quem faz os criativos: conjuntos, layout, padrão visual, fotos e 3D',
    persona:
      'Agora você copilota o DESIGNER. Pense como diretora de arte: comece olhando o conjunto (ver_conjunto) e o padrão aprendido, critique com franqueza (hierarquia, contraste, respiro, recorte, consistência), proponha variações a partir de um post de exemplo (criar_parecidos), use orquestrar_criativo para peças novas caprichadas e grave as preferências com aprender_padrao.',
    suggestions: ['Estuda o conjunto mais recente e me diz o que melhorar no padrão visual', 'Usa o post 1 de exemplo e faz mais 3 variações', 'Monta uma equipe para um carrossel novo com foto e um objeto 3D'],
  },
  copy: {
    label: 'Copy',
    hint: 'Copilota quem escreve: roteiros, legendas, ganchos e tom de voz',
    persona:
      'Agora você copilota o COPYWRITER. Pense como redatora sênior: ganchos fortes na primeira linha, uma ideia por slide, chamada clara, o tom do Plano, nada genérico. Leia as legendas que mais performaram (ler_dados instagram) antes de propor, escreva roteiros (editar_conteudo) e legendas (legenda) e ofereça 2 ou 3 versões quando pedirem texto.',
    suggestions: ['Escreve 3 ganchos para o próximo post da pauta', 'Revisa as legendas desta semana e deixa mais diretas', 'Que tipo de legenda performou melhor no Instagram?'],
  },
  trafego: {
    label: 'Tráfego',
    hint: 'Copilota o gestor de tráfego: campanhas, site, leads e criativos de anúncio',
    persona:
      'Agora você copilota o GESTOR DE TRÁFEGO. Comece pelos números (ler_dados anuncios e site): gasto, resultados, custo por resultado, CTR, quais anúncios e campanhas trazem visitas que viram contato. Aponte o que pausar, o que escalar e que criativo testar a seguir, e crie as variações de anúncio com criar_parecidos a partir do anúncio que funciona. Não invente números: só os que os dados trouxerem.',
    suggestions: ['Como estão as campanhas nos últimos 7 dias?', 'Quais anúncios trazem visitas que viram contato no site?', 'Cria 3 variações do anúncio que mais converteu'],
  },
}

const KEY = 'iara-papel'

export const readRole = (): IaraRole => {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'designer' || v === 'copy' || v === 'trafego' ? v : 'geral'
  } catch {
    return 'geral'
  }
}

export const writeRole = (r: IaraRole) => {
  try {
    localStorage.setItem(KEY, r)
  } catch {
    // vale até recarregar
  }
}
