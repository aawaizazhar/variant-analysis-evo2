import { createClient } from '~/utils/supabase/server'
import { Activity } from 'lucide-react'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'

export async function HistoryTable() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: history, error } = await supabase
    .from('prediction_history')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error("Error fetching history:", error.message)
    return <div className="text-red-400 p-4">Error loading history records.</div>
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Activity className="mx-auto h-12 w-12 opacity-20 mb-4" />
        <p>You haven't run any predictions yet.</p>
        <Link href="/" className="text-phosphor hover:underline mt-2 inline-block">
          Go analyze your first variant &rarr;
        </Link>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead>Date</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Variant</TableHead>
            <TableHead>Prediction</TableHead>
            <TableHead className="text-right">Evo2 Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((record: any) => (
            <TableRow key={record.id} className="border-white/5 border-b transition-colors hover:bg-white/5">
              <TableCell className="font-medium text-muted-foreground">
                {new Date(record.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <span className="text-phosphor">{record.chromosome}</span>:{record.variant_position}
              </TableCell>
              <TableCell>
                <span className="bg-white/10 px-2 py-1 rounded text-xs font-mono">
                  &rarr; {record.alternative}
                </span>
              </TableCell>
              <TableCell>
                {record.prediction === 'Likely pathogenic' ? (
                  <span className="text-red-400 font-medium flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span> 
                    Pathogenic
                  </span>
                ) : (
                  <span className="text-green-400 font-medium flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                    Benign
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {Number(record.delta_score).toFixed(5)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
