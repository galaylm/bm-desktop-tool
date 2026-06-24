import { Coffee } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge, Card } from '../../shared/components'
import { createDefaultProfilePageData, loadProfilePageData } from './api'
import type { ProfilePageData } from './types'

export function ProfilePage() {
  const [pageData, setPageData] = useState<ProfilePageData>(() => createDefaultProfilePageData())

  useEffect(() => {
    let active = true

    const syncProfile = async () => {
      const data = await loadProfilePageData()
      if (!active) return
      setPageData(data)
    }

    void syncProfile()

    return () => {
      active = false
    }
  }, [])

  const projectInfo = pageData.project

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      {/* About Project Section */}
      <Card
        title="关于本项目"
        actions={<Coffee className="h-4 w-4 text-[var(--color-text-muted)]" />}
        className="rounded-[24px]"
        padding="lg"
      >
        <div className="space-y-4 text-[15px] leading-8 text-[var(--color-text-secondary)]">
          <p>
            <Badge className="mr-1 rounded-xl px-3 py-1">{projectInfo.introBadge}</Badge>
            {projectInfo.introText}
          </p>
          <div className="flex flex-wrap gap-2">
            {projectInfo.techStack.map((item: string) => (
              <Badge key={item} className="rounded-xl px-3 py-1">
                {item}
              </Badge>
            ))}
          </div>
          <p>{projectInfo.description}</p>
        </div>
      </Card>
    </div>
  )
}
