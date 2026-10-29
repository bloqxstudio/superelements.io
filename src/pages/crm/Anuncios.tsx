import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AdsArea } from '@/features/crm/InstagramAds'
import { useCrm } from '@/features/crm/crmStore'
import { Page } from '@/features/crm/ui'

/** Anúncios da Meta (CRM › Anúncios): as campanhas da conta de anúncios, antes uma aba do Instagram. */
const AnunciosPage: React.FC = () => {
  const { team } = useCrm()
  const [params] = useSearchParams()
  const manager = team?.role === 'owner' || team?.role === 'admin'
  return (
    <Page wide>
      {team ? (
        <AdsArea teamId={team.id} manager={manager} initialAccount={params.get('conta') ?? undefined} />
      ) : (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Abrindo os anúncios da equipe…
        </p>
      )}
    </Page>
  )
}

export default AnunciosPage
