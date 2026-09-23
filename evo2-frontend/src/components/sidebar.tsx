'use client'

import { useState, useEffect, memo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, LayoutDashboard, LogIn, Menu, X, Activity, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAuth } from '~/providers/auth-provider'
import { UserNav } from '~/components/user-nav'
import { Button } from '~/components/ui/button'

const routes = [
  { name: 'Home', path: '/', icon: Home },
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
]

interface SidebarProps {
  isCollapsed: boolean
  setIsCollapsed: (value: boolean) => void
}

export const Sidebar = memo(function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const { user, profile, loading } = useAuth()

  // Prevent scrolling when mobile menu is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [isMobileOpen])

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  // Improved loading logic: Only show a full skeleton if we have NO user and we are loading.
  // If we have a user, show the content immediately even if loading is true (background profile fetch).
  if (loading && !user) {
    return (
        <aside 
            className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar/95 backdrop-blur-xl border-r border-sidebar-border ${isCollapsed ? 'w-[72px]' : 'w-64'} animate-pulse`}
            aria-hidden="true"
        >
             <div className="h-16 border-b border-sidebar-border" />
             <div className="flex-1 p-4 space-y-4">
                 {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 bg-muted rounded" />)}
             </div>
        </aside>
    )
  }

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 left-4 z-50 rounded-md bg-sidebar/95 border border-sidebar-border p-2 text-foreground lg:hidden focus:outline-none focus:ring-2 focus:ring-phosphor backdrop-blur-md"
        aria-label="Open Navigation Menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar/95 backdrop-blur-xl border-r border-sidebar-border shadow-2xl transition-all duration-300 ease-in-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'w-[72px]' : 'w-64'}`}
        aria-label="Sidebar Navigation"
      >
        {/* Header / Logo */}
        <div className={`flex h-16 items-center border-b border-sidebar-border ${isCollapsed ? 'justify-center px-0' : 'justify-between px-6'}`}>
          <Link href="/" className="flex items-center gap-2 group transition-colors hover:text-phosphor focus:outline-none focus:ring-2 focus:ring-phosphor rounded-sm">
            <Activity className={`text-phosphor transition-all ${isCollapsed ? 'h-8 w-8' : 'h-6 w-6'}`} />
            {!isCollapsed && (
              <span className="font-bold text-lg tracking-tight text-foreground group-hover:text-phosphor transition-colors whitespace-nowrap overflow-hidden">
                DNAAnalyzer
              </span>
            )}
          </Link>
          
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-phosphor rounded-sm"
            aria-label="Close Navigation Menu"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-2 px-3 py-6 overflow-y-auto overflow-x-hidden">
          {routes.filter((route) => {
            // Hide Dashboard link when user is not authenticated
            if (route.path === '/dashboard' && !user) return false
            return true
          }).map((route) => {
            const isActive = pathname === route.path
            const Icon = route.icon

            return (
              <Link
                key={route.path}
                href={route.path}
                title={isCollapsed ? route.name : undefined}
                className={`flex items-center rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-phosphor ${
                  isCollapsed ? 'justify-center py-3' : 'gap-3 px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-phosphor/15 text-phosphor border border-phosphor/30 shadow-[0_0_15px_rgba(10,255,150,0.15)]'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-phosphor' : 'text-muted-foreground group-hover:text-foreground'}`} />
                {!isCollapsed && (
                  <span className="text-sm font-medium whitespace-nowrap">{route.name}</span>
                )}
              </Link>
            )
          })}
          
          {!user && (
            <Link
              href="/login"
              title={isCollapsed ? 'Login' : undefined}
              className={`flex items-center rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-phosphor ${
                isCollapsed ? 'justify-center py-3' : 'gap-3 px-3 py-2.5'
              } ${
                pathname === '/login'
                  ? 'bg-phosphor/15 text-phosphor border border-phosphor/30 shadow-[0_0_15px_rgba(10,255,150,0.15)]'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
              }`}
            >
              <LogIn className={`h-5 w-5 flex-shrink-0 ${pathname === '/login' ? 'text-phosphor' : 'text-muted-foreground'}`} />
              {!isCollapsed && <span className="text-sm font-medium whitespace-nowrap">Login / Sign Up</span>}
            </Link>
          )}
        </nav>

        {/* Footer Area */}
        <div className={`p-4 border-t border-sidebar-border flex flex-col gap-4 ${isCollapsed ? 'items-center' : ''}`}>
          <Link href="/product" className="text-xs text-muted-foreground hover:text-phosphor focus-visible:outline-2 focus-visible:outline-phosphor" title="Product, pricing and policies">
            {isCollapsed ? 'Info' : 'Product, pricing & policies'}
          </Link>
          {/* User Nav / Login State */}
          <div className="w-full">
            {user ? (
              <UserNav user={user} profile={profile} isCollapsed={isCollapsed} />
            ) : (
                <div className={`${isCollapsed ? 'hidden' : 'rounded-lg bg-phosphor/5 p-4 border border-phosphor/20'}`}>
                    <p className="text-xs text-phosphor font-medium mb-1">Collaborate securely</p>
                    <p className="text-xs text-muted-foreground mb-3">Save history and export.</p>
                    <Link href="/login">
                        <Button size="sm" className="w-full bg-phosphor text-void hover:bg-phosphor/90 h-8 text-xs font-bold">
                            Get Started
                        </Button>
                    </Link>
                </div>
            )}
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`hidden lg:flex items-center justify-center p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${
              !isCollapsed && 'self-end'
            }`}
            aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        </div>
      </aside>
    </>
  )
})
