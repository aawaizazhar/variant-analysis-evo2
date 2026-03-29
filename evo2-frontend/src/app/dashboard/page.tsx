import { redirect } from 'next/navigation'
import { Activity, Loader2 } from 'lucide-react'
import { Suspense } from 'react'
import { HistoryTable } from '~/components/history-table'
import { createClient } from '~/utils/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()

  // 1. Verify user is logged in
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  // 2. Fetch user's profile to get their plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan_type')
    .eq('id', user.id)
    .single()

  const planType = profile?.plan_type || 'student'

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Analysis Dashboard</h1>
            <p className="text-muted-foreground">
              View and export your history of genomic variant predictions.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 shadow-xl overflow-hidden min-h-[400px]">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Predictions</h2>
              <Suspense fallback={
                <div className="flex flex-col items-center justify-center py-24 space-y-4">
                  <Loader2 className="h-8 w-8 text-phosphor animate-spin opacity-50" />
                  <p className="text-sm text-muted-foreground animate-pulse">Retrieving prediction history...</p>
                </div>
              }>
                <HistoryTable />
              </Suspense>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
