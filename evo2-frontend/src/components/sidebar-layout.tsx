'use client'

import { useState } from 'react'
import { Sidebar } from '~/components/sidebar'
import { usePathname } from 'next/navigation'
import { isPublicPage } from '~/lib/public-site'

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()

  if (isPublicPage(pathname)) return <>{children}</>

  return (
    <div className="flex min-h-screen">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <main
        className={`flex-1 w-full flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:pl-[72px]' : 'lg:pl-64'
        }`}
      >
        {children}
      </main>
    </div>
  )
}
