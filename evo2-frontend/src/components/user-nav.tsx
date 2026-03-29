"use client"

import * as React from "react"
import { useTransition } from "react"
import { useAuth } from "~/providers/auth-provider"
import { logout } from "~/app/auth/signout/logout-action"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Button } from "~/components/ui/button"
import { LogOut, User as UserIcon, Shield } from "lucide-react"
import { useRouter } from "next/navigation"

interface UserNavProps {
  user: any
  profile: any
  isCollapsed?: boolean
}

export function UserNav({ user, profile, isCollapsed }: UserNavProps) {
  const [showLogoutDialog, setShowLogoutDialog] = React.useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  
  const initials = user.email ? user.email.charAt(0).toUpperCase() : "U"
  const planType = profile?.plan_type || 'student'

  return (
    <>
      <div className={`flex flex-col gap-2 ${isCollapsed ? 'items-center' : ''}`}>
        {!isCollapsed && (
            <div className="flex items-center gap-2 px-2 py-1 mb-1 rounded-full bg-phosphor/10 border border-phosphor/20 w-fit">
                <Shield className="h-3 w-3 text-phosphor" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-phosphor">{planType} Plan</span>
            </div>
        )}
        
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <button className="flex items-center w-full transition-all outline-none focus:outline-none">
                <Avatar className={`border border-white/10 hover:border-phosphor/50 transition-colors ${isCollapsed ? 'mx-auto' : ''}`}>
                <AvatarFallback className="bg-phosphor/10 text-phosphor font-bold">
                    {initials}
                </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                <div className="ml-3 text-left overflow-hidden">
                    <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">{planType} Account</p>
                </div>
                )}
            </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" side={isCollapsed ? "right" : "bottom"} forceMount>
            <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.email}</p>
                <p className="text-xs leading-none text-muted-foreground uppercase tracking-tighter">
                    {planType} PLAN
                </p>
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer group">
                <UserIcon className="mr-2 h-4 w-4 text-muted-foreground group-hover:text-phosphor" />
                <span>Profile Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
                className="cursor-pointer text-red-400 focus:text-red-400 group"
                onClick={() => setShowLogoutDialog(true)}
            >
                <LogOut className="mr-2 h-4 w-4 text-red-500 group-hover:text-red-400" />
                <span>Log out</span>
            </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out? Your current session will be ended.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowLogoutDialog(false)}
              className="border-white/10 hover:bg-white/5 transition-all active:scale-[0.98]"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    await logout()
                  } finally {
                    setShowLogoutDialog(false)
                  }
                })
              }}
              className="bg-red-500 hover:bg-red-600 text-white transition-all active:scale-[0.98]"
            >
              {isPending ? "Logging out..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
