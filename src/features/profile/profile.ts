import { supabase } from '@/integrations/supabase/client'

/**
 * O perfil da pessoa (2026-10-31): nome e foto que ela mesma escolhe em /perfil.
 * A foto fica no bucket público `avatars`, em `<usuário>/<carimbo>.<ext>`;
 * o nome substitui o que antes saía do e-mail.
 */

export const AVATAR_BUCKET = 'avatars'
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
export const NAME_MAX = 80

export const avatarUrlOf = (path: string | null | undefined) =>
  path ? supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl : undefined

/** Nome a mostrar: o que a pessoa escreveu, ou o que sai do e-mail ("igor.nascimento@" → "Igor Nascimento"). */
export const displayName = (fullName: string | null | undefined, email: string | null | undefined) => {
  const name = fullName?.trim()
  if (name) return name
  const words = (email?.split('@')[0] ?? '').split(/[._\-+]+/).filter(Boolean)
  if (!words.length) return email || 'Alguém'
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export const initialsOf = (label: string) =>
  label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || '?'

/** Lado mínimo da foto, em px: abaixo disso ela fica borrada até no menu. */
export const AVATAR_MIN_SIDE = 200
/** Lado da foto salva (o perfil mostra até 88 px, 176 px em tela retina). */
export const AVATAR_OUT = 512

/** O quadrado escolhido no enquadramento, em px da imagem original. */
export interface AvatarCrop {
  x: number
  y: number
  side: number
}

/** Abre a imagem escolhida e recusa as pequenas demais, explicando. */
export async function openAvatarImage(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha uma imagem (JPG, PNG ou WebP).')
  if (file.size > 15 * 1024 * 1024) throw new Error('A imagem passa de 15 MB.')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('Este navegador não abre essa imagem. Tente JPG ou PNG.')
  }
  const side = Math.min(bitmap.width, bitmap.height)
  if (side < AVATAR_MIN_SIDE) {
    bitmap.close()
    throw new Error(`Essa imagem tem só ${bitmap.width} × ${bitmap.height} px e ficaria borrada. Escolha uma de pelo menos ${AVATAR_MIN_SIDE} px, como uma foto do celular.`)
  }
  return bitmap
}

/** Recorta o quadrado escolhido e salva em WebP de até 512 px. */
async function renderAvatar(bitmap: ImageBitmap, crop: AvatarCrop): Promise<Blob> {
  const out = Math.round(Math.min(AVATAR_OUT, crop.side))
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = out
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Este navegador não consegue preparar a foto.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, crop.x, crop.y, crop.side, crop.side, 0, 0, out, out)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.92))
  if (!blob) throw new Error('Não deu para preparar a foto.')
  return blob
}

export async function updateProfile(userId: string, patch: { full_name?: string | null; phone?: string | null; avatar_path?: string | null }) {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
  if (error) throw new Error(error.message)
}

/** Sobe a nova foto, grava no perfil e apaga a anterior. */
export async function uploadAvatar(userId: string, bitmap: ImageBitmap, crop: AvatarCrop, previous?: string | null): Promise<string> {
  const blob = await renderAvatar(bitmap, crop)
  if (blob.size > AVATAR_MAX_BYTES) throw new Error('A foto ficou maior que 2 MB.')
  const path = `${userId}/${Date.now()}.webp`
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false })
  if (error) throw new Error(error.message)
  await updateProfile(userId, { avatar_path: path })
  if (previous && previous !== path) void supabase.storage.from(AVATAR_BUCKET).remove([previous])
  return path
}

export async function removeAvatar(userId: string, previous: string | null | undefined) {
  await updateProfile(userId, { avatar_path: null })
  if (previous) void supabase.storage.from(AVATAR_BUCKET).remove([previous])
}

/** Mesmo critério do Supabase Auth do projeto, explicado à pessoa. */
export const PASSWORD_MIN = 8
export function passwordProblem(password: string, confirm: string): string | undefined {
  if (password.length < PASSWORD_MIN) return `Use pelo menos ${PASSWORD_MIN} caracteres.`
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return 'Misture letras e números.'
  if (password !== confirm) return 'As duas senhas não são iguais.'
  return undefined
}

export const authErrorText = (message: string | undefined) => {
  const m = (message ?? '').toLowerCase()
  if (m.includes('reauthentication') || m.includes('nonce')) return 'Por segurança, confirme com o código enviado ao seu e-mail.'
  if (m.includes('same') && m.includes('password')) return 'A nova senha precisa ser diferente da atual.'
  if (m.includes('weak') || m.includes('pwned')) return 'Essa senha é fraca ou já vazou em outro site. Escolha outra.'
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'A senha atual não confere.'
  if (m.includes('already') && m.includes('registered')) return 'Esse e-mail já é de outra conta.'
  if (m.includes('rate') || m.includes('too many') || m.includes('security purposes')) return 'Muitas tentativas. Espere um minuto e tente de novo.'
  if (m.includes('invalid') && m.includes('email')) return 'Esse e-mail não parece válido.'
  return message || 'Algo deu errado. Tente de novo.'
}
