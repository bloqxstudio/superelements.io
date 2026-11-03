import React, { useCallback, useEffect, useState } from 'react'
import { Copy, Loader2, Plug, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { supabase } from '@/integrations/supabase/client'
import { currentUserId } from '@/features/projects/storage'

/**
 * Conectar sua IA: a chave pessoal do MCP da Sinfy (`supabase/functions/sinfy-mcp`). A pessoa cria
 * uma chave por IA (Claude, ChatGPT, Cursor…), vê o endereço uma vez só e revoga quando quiser.
 * O servidor guarda só o hash (`crm_mcp_keys`); a IA age em nome de quem criou a chave.
 */

const db = supabase as unknown as SupabaseClient
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '') || 'https://nfmfcpcwyavutntnrxqq.supabase.co'
export const mcpUrl = (token: string) => `${SUPABASE_URL}/functions/v1/sinfy-mcp/${token}`

interface KeyRow { id: string; user_id: string; name: string; prefix: string; created_at: string; last_used_at: string | null; revoked_at: string | null }

const copy = (text: string) =>
  navigator.clipboard.writeText(text).then(
    () => toast.success('Copiado'),
    () => toast.error('Não consegui copiar')
  )

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'nunca')

export const McpDialog: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void; teamId: string; teamName: string }> = ({ open, onOpenChange, teamId, teamName }) => {
  const [keys, setKeys] = useState<KeyRow[] | null>(null)
  const [me, setMe] = useState<string>()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('Claude')
  const [busy, setBusy] = useState(false)
  const [fresh, setFresh] = useState<{ name: string; url: string } | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const { data, error: e } = await db.from('crm_mcp_keys').select('id, user_id, name, prefix, created_at, last_used_at, revoked_at').eq('team_id', teamId).is('revoked_at', null).order('created_at', { ascending: false })
    if (e) return setError(e.code === '42P01' || e.code === 'PGRST205' ? 'Falta aplicar a migração 20261103120000_crm_mcp.sql no Supabase.' : e.message)
    setKeys((data ?? []) as KeyRow[])
  }, [teamId])

  useEffect(() => {
    if (!open) return
    setFresh(null)
    void load()
    void currentUserId().then(setMe, () => undefined)
  }, [open, load])

  const create = async () => {
    setBusy(true)
    try {
      const { data, error: e } = await db.rpc('crm_mcp_key_create', { p_team: teamId, p_name: name.trim() || 'IA' })
      if (e) throw new Error(e.message)
      const row = (Array.isArray(data) ? data[0] : data) as { token: string }
      setFresh({ name: name.trim() || 'IA', url: mcpUrl(row.token) })
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (k: KeyRow) => {
    if (!window.confirm(`Desconectar "${k.name}"? A IA que usa esse endereço perde o acesso na hora.`)) return
    const { error: e } = await db.rpc('crm_mcp_key_revoke', { p_id: k.id })
    if (e) return void toast.error(e.message)
    toast.success('Desconectada')
    void load()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Conectar sua IA à Sinfy</DialogTitle>
          <DialogDescription>
            Use o Claude, o ChatGPT, o Cursor ou outra IA com MCP na conta {teamName}: ela lê quem vocês são e o Plano, cria conteúdos e criativos na marca e analisa site, anúncios, Instagram e funil. Ela age em seu nome; aprovar e publicar continuam sendo na Sinfy.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-rose-700" role="alert">{error}</p>
        ) : (
          <div className="grid gap-5">
            {fresh ? (
              <div className="rounded-lg bg-emerald-50 p-3 ring-1 ring-inset ring-emerald-200">
                <p className="text-xs font-medium text-emerald-900">Endereço de "{fresh.name}". Copie agora: ele não aparece de novo.</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-md bg-white px-2.5 py-2 text-xs ring-1 ring-inset ring-emerald-200">{fresh.url}</code>
                  <Button type="button" variant="outline" size="icon" onClick={() => void copy(fresh.url)} aria-label="Copiar o endereço">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-emerald-900">Quem tiver esse endereço entra na conta como você. Não mande em grupo nem cole em lugar público.</p>
              </div>
            ) : (
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void create()
                }}
              >
                <label className="grid flex-1 gap-1 text-xs font-medium text-gray-800">
                  Nome da conexão
                  <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Claude, ChatGPT, Cursor…" />
                </label>
                <Button type="submit" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />} Gerar endereço
                </Button>
              </form>
            )}

            <div className="text-sm text-gray-700">
              <p className="font-medium text-gray-900">Como ligar</p>
              <ul className="mt-1.5 grid list-disc gap-1 pl-5 text-xs text-gray-600 marker:text-gray-400">
                <li><strong>Claude</strong> (claude.ai ou app): Configurações › Conectores › Adicionar conector personalizado › cole o endereço.</li>
                <li><strong>ChatGPT</strong>: Configurações › Conectores (modo desenvolvedor) › Criar › cole o endereço, sem autenticação.</li>
                <li><strong>Claude Code</strong>: <code>claude mcp add --transport http sinfy &lt;endereço&gt;</code></li>
                <li><strong>Cursor e outros</strong>: servidor MCP do tipo HTTP (Streamable HTTP) com o endereço.</li>
              </ul>
              <p className="mt-2 text-xs text-gray-600">Depois peça, por exemplo: "Leia a Sinfy e crie 3 carrosséis do Plano desta semana" ou "Analise os anúncios e o site dos últimos 30 dias e me diga o que fazer".</p>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-800">Conexões ativas</p>
              {!keys ? (
                <p className="mt-2 flex items-center gap-2 text-xs text-gray-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Abrindo…</p>
              ) : !keys.length ? (
                <p className="mt-2 text-xs text-gray-500">Nenhuma ainda.</p>
              ) : (
                <ul className="mt-2 divide-y divide-gray-100 rounded-md ring-1 ring-inset ring-gray-200">
                  {keys.map((k) => (
                    <li key={k.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-gray-900">{k.name}</span>
                        <span className="ml-2 font-mono text-gray-400">{k.prefix}…</span>
                        {k.user_id !== me && <span className="ml-2 text-gray-500">(de outra pessoa)</span>}
                        <span className="block text-gray-500">Último uso: {when(k.last_used_at)}</span>
                      </span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => void revoke(k)} aria-label={`Desconectar ${k.name}`}>
                        <Trash2 className="h-3.5 w-3.5" /> Desconectar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {fresh && (
                <button type="button" className="mt-2 text-xs text-gray-500 hover:text-gray-900" onClick={() => setFresh(null)}>
                  Gerar outro endereço
                </button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
