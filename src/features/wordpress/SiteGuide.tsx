import React, { useEffect, useRef, useState } from 'react'
import { Check, CloudDownload, Download, ExternalLink, Globe, Loader2, PlugZap } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useSpaceStore } from '@/store/spaceStore'
import { cn } from '@/lib/utils'
import { CONNECTOR_ZIP, openAdmin } from './autologin'
import { pingConnector } from './pluginPing'
import { syncSiteConfig } from './siteConfig'
import { useWordPressUi } from './uiStore'
import type { WordPressConnection } from './types'

/**
 * Guia de instalação de uma conta de cliente: conectar o site, subir o plugin e importar as páginas.
 * Cada passo reaproveita o que já existe (diálogo de conexão, envio de plugin do WordPress, importação)
 * e o guia confere sozinho o que já foi feito; a conta tem um site só.
 */

interface SiteGuideProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  connection: WordPressConnection | null
  /** Fecha o guia e abre a conexão; o guia volta quando ela fecha. */
  onConnect: () => void
}

const MIN_VERSION = '0.5'

const Step: React.FC<{ n: number; title: string; done: boolean; active: boolean; children: React.ReactNode }> = ({ n, title, done, active, children }) => (
  <li className={cn('flex gap-3 rounded-xl border p-3', active ? 'border-gray-300 bg-white' : 'border-transparent bg-zinc-50', !active && !done && 'opacity-60')}>
    <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold', done ? 'bg-emerald-500 text-white' : 'bg-zinc-200 text-gray-700')}>
      {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : n}
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {active && <div className="mt-2 grid gap-2 text-sm text-gray-600">{children}</div>}
    </div>
  </li>
)

export const SiteGuide: React.FC<SiteGuideProps> = ({ open, onOpenChange, projectId, connection, onConnect }) => {
  const pages = useSpaceStore((s) => s.pages)
  const [version, setVersion] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const synced = useRef(false)

  const imported = pages.some((p) => p.wordpress && connection && p.wordpress.siteUrl === connection.site.siteUrl)
  const pluginOk = !!version && version >= MIN_VERSION

  // Com o site conectado, procura o plugin a cada poucos segundos enquanto o guia está aberto e o plugin não apareceu
  useEffect(() => {
    if (!open || !connection || pluginOk) return
    let active = true
    const run = async () => {
      const found = await pingConnector(connection.site)
      if (!active) return
      setVersion(found)
      setChecked(true)
    }
    void run()
    const timer = setInterval(run, 4000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [open, connection, pluginOk])

  // Plugin novo no ar: grava a configuração da conta (painel Site e leads), uma vez
  useEffect(() => {
    if (!pluginOk || !connection || synced.current) return
    synced.current = true
    void syncSiteConfig(projectId, connection).then(
      (result) => {
        if (result.notes.length) toast.message('Plugin conectado', { description: result.notes.join(' ') })
        else toast.success('Plugin conectado e configurado')
      },
      () => toast.error('O plugin respondeu, mas não consegui gravar a configuração.')
    )
  }, [pluginOk, connection, projectId])

  const step = !connection ? 1 : !pluginOk ? 2 : 3
  const old = checked && version !== null && !pluginOk

  const openUpload = async () => {
    if (!connection) return
    try {
      await openAdmin(connection, 'plugin-install.php?tab=upload')
    } catch {
      toast.error('Não consegui abrir o painel do WordPress.')
    }
  }

  const startImport = () => {
    onOpenChange(false)
    useWordPressUi.getState().openImport()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Colocar o site do cliente na plataforma</DialogTitle>
          <DialogDescription>Três passos. A conta tem um site só; o guia confere o que já foi feito.</DialogDescription>
        </DialogHeader>
        <ol className="grid gap-2">
          <Step n={1} title="Conectar o WordPress" done={!!connection} active={step === 1}>
            <p>Digite o endereço do site e entre com um administrador. A plataforma pede a aprovação ao WordPress e volta sozinha.</p>
            <Button size="sm" className="w-fit gap-2" onClick={onConnect}>
              <Globe className="h-4 w-4" aria-hidden /> Conectar o site
            </Button>
          </Step>
          <Step n={2} title="Instalar o plugin Superelements Connector" done={pluginOk} active={step === 2}>
            <p>No painel do WordPress: Plugins › Adicionar novo › Enviar plugin, escolha o arquivo e ative. É ele que liga as visitas, os leads e a publicação de cabeçalho e rodapé.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" asChild className="gap-2">
                <a href={CONNECTOR_ZIP} download>
                  <Download className="h-4 w-4" aria-hidden /> 1. Baixar o plugin
                </a>
              </Button>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => void openUpload()}>
                <ExternalLink className="h-4 w-4" aria-hidden /> 2. Abrir o envio no WordPress
              </Button>
            </div>
            <p className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {old ? `O site tem o plugin ${version}, antigo. Envie este arquivo para atualizar.` : 'Esperando o plugin ficar ativo no site…'}
            </p>
          </Step>
          <Step n={3} title="Importar as páginas" done={imported} active={step === 3}>
            <p>Traz as páginas, o cabeçalho, o rodapé e as cores do site para o canvas.</p>
            <Button size="sm" className="w-fit gap-2" onClick={startImport}>
              <CloudDownload className="h-4 w-4" aria-hidden /> Importar o site
            </Button>
          </Step>
        </ol>
        {connection && pluginOk && imported && (
          <Button className="gap-2" onClick={() => onOpenChange(false)}>
            <PlugZap className="h-4 w-4" aria-hidden /> Tudo pronto
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
