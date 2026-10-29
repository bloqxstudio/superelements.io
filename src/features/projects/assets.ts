import { supabase } from '@/integrations/supabase/client'

/** Imagens na pasta privada do projeto, com as mesmas permissões do documento. */
export async function uploadProjectImage(projectId: string, file: Blob) {
  if (!['image/webp', 'image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) throw new Error('Formato de imagem não permitido.')
  const { data: project, error } = await supabase.from('space_projects').select('owner_id').eq('id', projectId).single()
  if (error || !project) throw error ?? new Error('Projeto não encontrado.')
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('')
  const ext = ({ 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg' } as Record<string, string>)[file.type]
  const path = `${project.owner_id}/${projectId}/images/${hash}.${ext}`
  const bucket = supabase.storage.from('space-projects')
  const { error: uploadError } = await bucket.upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false })
  if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) throw uploadError
  const { data: saved, error: readError } = await bucket.download(path)
  if (readError || !saved || saved.size !== file.size) throw readError ?? new Error('Falha ao verificar a imagem salva.')
  return { path, hash, bytes: file.size, verified: true }
}
