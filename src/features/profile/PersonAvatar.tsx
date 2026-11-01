import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { initialsOf } from './profile'

/** Foto da pessoa, ou as iniciais quando não há foto (ou ela não carrega). */
export const PersonAvatar: React.FC<{ name: string; url?: string; size?: number; className?: string }> = ({ name, url, size = 32, className }) => {
  const [broken, setBroken] = useState<string>()
  const showPhoto = url && broken !== url
  return (
    <span
      className={cn('inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-gray-900 font-semibold text-white', className)}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) }}
      aria-hidden
    >
      {showPhoto ? <img src={url} alt="" className="h-full w-full object-cover" onError={() => setBroken(url)} /> : initialsOf(name)}
    </span>
  )
}
