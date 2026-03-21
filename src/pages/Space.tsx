import React from 'react'
import { SpaceCanvas } from '@/features/space/SpaceCanvas'
import { SpaceToolbar } from '@/features/space/SpaceToolbar'

const Space: React.FC = () => {
  return (
    <div className="relative w-full overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>
      <SpaceToolbar />
      <SpaceCanvas />
    </div>
  )
}

export default Space
