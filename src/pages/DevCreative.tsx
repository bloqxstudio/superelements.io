import '@/styles/product.css'
import { CreativeEditor } from '@/features/criativos/Editor'
import { useSinfyTheme } from '@/lib/sinfyTheme'

/** Só no `npm run dev`: o editor de Criativos com o conjunto de exemplo, sem login (ver features/criativos/devSet.ts). */
export default function DevCreative() {
  useSinfyTheme()
  return (
    <div className="se-product min-h-dvh bg-[#f1f2ed]">
      <CreativeEditor />
    </div>
  )
}
