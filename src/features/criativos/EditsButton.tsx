import React, { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Clapperboard, FolderDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useMcpEvent } from '@/features/mcp/live'
import { canSaveToFolder, EDITS_PATH, editsFolder, exportToEdits, useEditsExport, type PackOptions } from './edits'
import { useCreativeLink } from './link'
import type { CodeScene, CreativeSet } from './types'
import { videoSupported } from './video'

type Input = PackOptions['sceneInput']

/**
 * "Levar ao Edits" nos estúdios de vídeo (`edits.ts`). Também começa sozinho quando:
 *   - o endereço traz `?edits=1` (o link que `sinfy_video_edits` devolve);
 *   - a IA conectada chama `sinfy_video_edits` para este vídeo com a tela aberta (aviso ao vivo do MCP).
 */
export const EditsButton: React.FC<{ set: CreativeSet; scene: CodeScene; sceneInput?: Input; disabled?: boolean }> = ({ set, scene, sceneInput, disabled }) => {
  const running = useEditsExport((s) => s.running)
  const step = useEditsExport((s) => s.step)
  const progress = useEditsExport((s) => s.progress)
  useCreativeLink((s) => s.connected)
  const folder = canSaveToFolder()
  useEditsTrigger(set, scene, sceneInput)

  const run = (zip?: boolean) => void exportToEdits(scene, set, { sceneInput, zip })
  const label = running ? `${step ?? 'Gerando'}${progress !== undefined ? ` ${Math.round(progress * 100)}%` : '…'}` : 'Levar ao Edits'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 min-w-0 max-w-[16rem] gap-1.5 bg-white" disabled={disabled || running || !videoSupported()} title={videoSupported() ? 'Exportar as camadas do vídeo para editar e publicar no Edits' : 'Use o Chrome ou o Edge atualizados'}>
          {running ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Clapperboard className="h-4 w-4 shrink-0" />}
          <span className="truncate">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-16px)]">
        <DropdownMenuLabel className="text-xs font-normal text-gray-600">
          Vídeo sem a música de fundo, a versão sem legenda, voz e efeitos em WAV, legenda em SRT, capa, texto do post e o manifesto com as cenas. A música você põe no Edits.
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!folder} onSelect={() => run(false)} className="flex-col items-start gap-0.5">
          <span className="flex items-center gap-1.5 font-medium"><Clapperboard className="h-4 w-4" /> Gravar na pasta do Edits</span>
          <span className="text-[11px] text-gray-500">{folder ? `${EDITS_PATH}/${editsFolder(scene)}` : 'Abra o conector neste computador para gravar direto na pasta.'}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run(true)} className="flex-col items-start gap-0.5">
          <span className="flex items-center gap-1.5 font-medium"><FolderDown className="h-4 w-4" /> Baixar o ZIP</span>
          <span className="text-[11px] text-gray-500">Os mesmos arquivos, num ZIP.</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Começa o pacote pelo link (`?edits=1`) ou quando a IA conectada pede este vídeo pelo MCP. */
function useEditsTrigger(set: CreativeSet, scene: CodeScene, sceneInput?: Input) {
  const [query, setQuery] = useSearchParams()
  const ref = useRef({ set, scene, sceneInput })
  ref.current = { set, scene, sceneInput }
  const started = useRef<string>()

  const start = (zip?: boolean) => {
    const { set: s, scene: sc, sceneInput: si } = ref.current
    // Dá um instante para as imagens e o logo da cena entrarem no mapa do editor
    setTimeout(() => void exportToEdits(sc, s, { sceneInput: si, zip }), 1200)
  }

  const wanted = query.get('edits')
  useEffect(() => {
    if (!wanted || started.current === scene.id) return
    started.current = scene.id
    setQuery((q) => {
      const n = new URLSearchParams(q)
      n.delete('edits')
      return n
    }, { replace: true })
    start(wanted === 'zip')
  }, [wanted, scene.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useMcpEvent((e) => {
    if (e.tool !== 'sinfy_video_edits' || e.phase !== 'done' || e.ok === false) return
    const { set: s, scene: sc } = ref.current
    if (e.onde.id !== s.id) return
    const asked = typeof e.onde.video === 'string' ? e.onde.video : ''
    const target = asked ? (s.scenes ?? []).find((x) => x.id === asked || x.name.trim().toLowerCase() === asked.trim().toLowerCase()) : sc
    // Só o vídeo aberto nesta tela (a outra cena precisa do estúdio dela aberto)
    if (target?.id !== sc.id) return
    start()
  })
}
