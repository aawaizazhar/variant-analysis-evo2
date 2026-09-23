import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Loader2, LockKeyhole } from 'lucide-react'
import { Suspense } from 'react'
import { ExportPredictionsButton } from '~/components/export-predictions-button'
import { HistoryTable } from '~/components/history-table'
import { Button } from '~/components/ui/button'
import { getPlanLimits } from '~/lib/plans'
import { ACTIVE_ACCESS_PLAN } from '~/lib/app-access'
import { createClient } from '~/utils/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()

  // 1. Verify user is logged in
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  const planLimits = getPlanLimits(ACTIVE_ACCESS_PLAN)

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

          <div className="rounded-xl border border-border/50 bg-card shadow-xl overflow-hidden min-h-[400px]">
            <div className="p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <h2 className="text-xl font-semibold">Recent Predictions</h2>
                {planLimits.csvExport ? <ExportPredictionsButton /> : null}
              </div>

              {planLimits.predictionHistory ? (
                <Suspense fallback={
                  <div className="flex flex-col items-center justify-center py-24 space-y-4">
                    <Loader2 className="h-8 w-8 text-phosphor animate-spin opacity-50" />
                    <p className="text-sm text-muted-foreground animate-pulse">Retrieving prediction history...</p>
                  </div>
                }>
                  <HistoryTable userId={user.id} />
                </Suspense>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="border-border/50 bg-muted/60 mb-4 rounded-full border p-3">
                    <LockKeyhole className="h-7 w-7 text-phosphor" />
                  </div>
                  <h3 className="text-lg font-semibold">History is locked on Student</h3>
                  <p className="text-muted-foreground mt-2 max-w-md text-sm">
                    Prediction history and CSV export are included in the
                    Researcher plan. Your Student quota is still tracked
                    securely for daily usage limits.
                  </p>
                  <Button asChild className="mt-5">
                    <Link href="/settings">Open Settings Plan</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
