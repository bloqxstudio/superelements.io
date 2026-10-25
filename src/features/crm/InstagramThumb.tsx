import React, { useState } from 'react'
import { Clapperboard, GalleryHorizontalEnd, Image as ImageIcon, CircleDashed } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatOf, type IgFormat, type IgMedia } from './instagram'

export const FORMAT_ICON: Record<IgFormat, React.ElementType> = { reels: Clapperboard, carrossel: GalleryHorizontalEnd, foto: ImageIcon, story: CircleDashed }

/**
 * A capa do post. Os endereços de imagem da Meta expiram em alguns dias: o que
 * não abre vira um quadro com o ícone do formato até a próxima atualização.
 */
export const MediaThumb: React.FC<{ media: IgMedia; className?: string; badge?: boolean }> = ({ media, className, badge }) => {
  const [broken, setBroken] = useState(false)
  const format = formatOf(media)
  const Icon = FORMAT_ICON[format]
  const src = media.thumbnail
  return (
    <div className={cn('relative overflow-hidden bg-zinc-100', className)}>
      {src && !broken ? (
        <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-gray-400">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
      )}
      {badge && format !== 'foto' && (
        <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-black/55 text-white" aria-hidden>
          <Icon className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  )
}
