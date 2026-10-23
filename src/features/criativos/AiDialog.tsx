import React, { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { generatePosts, type AiForm } from './ai'
import { AiFields, EMPTY_AI } from './AiFields'
import { useEditor } from './store'

/** "Gerar com IA" dentro do editor: acrescenta posts novos ao conjunto aberto. */
export const AiDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [form, setForm] = useState<AiForm>(EMPTY_AI)
  const [busy, setBusy] = useState(false)
  const controller = useRef<AbortController | null>(null)

  const run = async () => {
    const set = useEditor.getState().set
    if (!set) return
    setBusy(true)
    controller.current = new AbortController()
    try {
      const posts = await generatePosts(form, set.brand, controller.current.signal)
      useEditor.getState().edit((s) => ({ ...s, posts: [...s.posts, ...posts] }))
      useEditor.getState().selectPost(posts[0].id)
      void useEditor.getState().ensureAssets()
      toast.success(posts.length === 1 ? 'Post criado.' : `${posts.length} posts criados.`)
      onClose()
    } catch (err) {
      if ((err as Error).name !== 'AbortError') toast.error(err instanceof Error ? err.message : 'A IA não conseguiu montar o post.')
    } finally {
      setBusy(false)
    }
  }

  const close = () => {
    controller.current?.abort()
    setBusy(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar posts com IA</DialogTitle>
          <DialogDescription>A IA escolhe os modelos, escreve os textos e a legenda e usa as telas dos cases. Você ajusta tudo no editor. Leva cerca de 1 minuto.</DialogDescription>
        </DialogHeader>
        <AiFields form={form} onChange={setForm} disabled={busy} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>{busy ? 'Parar' : 'Cancelar'}</Button>
          <Button onClick={() => void run()} disabled={busy || !form.brief.trim()} className="gap-1.5">
            <Sparkles className="h-4 w-4" /> {busy ? 'Montando…' : 'Gerar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
