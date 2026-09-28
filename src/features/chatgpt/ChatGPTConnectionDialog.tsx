import React, { useEffect, useRef, useState } from 'react'
import { Bot, Check, Copy, ExternalLink, FlaskConical, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProject } from '@/features/projects/projectStore'

const CHATGPT_PLUGINS_URL = 'https://chatgpt.com/plugins'
const LOCAL_MCP_URL = 'http://127.0.0.1:8787/mcp'

const mcpUrl = () => (import.meta.env.VITE_CHATGPT_MCP_URL as string | undefined)?.trim() || LOCAL_MCP_URL
const isLocalUrl = (url: string) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(url)
const projectKey = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase()

const copyValue = async (value: string, input: HTMLInputElement | null) => {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    input?.focus()
    input?.select()
    return document.execCommand('copy')
  }
}

interface ChatGPTConnectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectName: string
}

const ChatGPTConnectionDialog: React.FC<ChatGPTConnectionDialogProps> = ({ open, onOpenChange, projectName }) => {
  const endpoint = mcpUrl()
  const local = isLocalUrl(endpoint)
  const inputRef = useRef<HTMLInputElement>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>()
  const [copied, setCopied] = useState(false)

  useEffect(() => () => clearTimeout(copiedTimer.current), [])

  const copyEndpoint = async () => {
    const success = await copyValue(endpoint, inputRef.current)
    if (!success) {
      toast.error('Não foi possível copiar automaticamente', { description: 'Selecione o endereço e copie com Ctrl+C.' })
      return false
    }
    setCopied(true)
    clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopied(false), 1800)
    return true
  }

  const openChatGPT = () => {
    void copyEndpoint().then((success) => {
      if (success) {
        toast.success('Endereço do MCP copiado', { description: 'No ChatGPT, clique em + e cole o endereço na conexão.' })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-[520px]">
        <div className="border-b bg-gray-50 px-6 py-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-950 text-white shadow-sm">
              <Bot className="h-5 w-5" strokeWidth={2} aria-hidden />
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
              <FlaskConical className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              POC local
            </span>
          </div>
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle>Levar {projectName} ao ChatGPT</DialogTitle>
            <DialogDescription>
              Conecte o chat à base da marca e crie rascunhos Elementor sem publicar no WordPress.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid gap-5 px-6 py-5">
          <div className="grid gap-2">
            <Label htmlFor="chatgpt-mcp-url">Endereço da conexão MCP</Label>
            <div className="flex gap-2">
              <Input ref={inputRef} id="chatgpt-mcp-url" value={endpoint} readOnly className="min-w-0 font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 active:scale-[0.96] transition-transform"
                onClick={() => void copyEndpoint()}
                aria-label={copied ? 'Endereço copiado' : 'Copiar endereço do MCP'}
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              </Button>
            </div>
            {local && (
              <p className="text-xs leading-5 text-amber-700">
                Este endereço funciona somente neste computador. Para um cliente conectar, publique o MCP em HTTPS e configure <code className="rounded bg-amber-100 px-1 font-mono">VITE_CHATGPT_MCP_URL</code>.
              </p>
            )}
          </div>

          <ol className="grid gap-3 text-sm text-gray-700">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">1</span>
              <span className="pt-0.5">Ative o modo Developer em Settings → Security and login.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">2</span>
              <span className="pt-0.5">Em Plugins, clique em <strong>+</strong>, cole o endereço e confirme a conexão.</span>
            </li>
          </ol>

          <div className="flex gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            <p>A POC consulta a ProcessBase e cria arquivos locais. Ela não acessa nem publica no WordPress.</p>
          </div>
        </div>

        <DialogFooter className="border-t bg-gray-50 px-6 py-4 sm:justify-between sm:space-x-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button asChild className="active:scale-[0.96] transition-transform">
            <a href={CHATGPT_PLUGINS_URL} target="_blank" rel="noopener noreferrer" onClick={openChatGPT}>
              Copiar e abrir ChatGPT
              <ExternalLink className="h-4 w-4" strokeWidth={2} aria-hidden />
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** A POC é exclusiva da ProcessBase; outros projetos não anunciam uma conexão que ainda não existe. */
export const ProjectChatGPTButton: React.FC<{ projectId: string }> = ({ projectId }) => {
  const project = useProject(projectId)
  const [open, setOpen] = useState(false)
  if (!project || projectKey(project.name) !== 'processbase') return null

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 px-2.5 text-gray-600 active:scale-[0.96] transition-transform"
        onClick={() => setOpen(true)}
        title="Conectar este projeto ao ChatGPT"
      >
        <Bot className="h-4 w-4" strokeWidth={2} aria-hidden />
        <span className="hidden sm:inline">ChatGPT</span>
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-label="(POC)" />
      </Button>
      <ChatGPTConnectionDialog open={open} onOpenChange={setOpen} projectName={project.name} />
    </>
  )
}
