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

type PredictionHistoryRecord = {
  id: string
  created_at: string
  chromosome: string | null
  variant_position: string | number | null
  reference: string | null
  alternative: string | null
  prediction: string | null
  delta_score: string | number | null
  final_interpretation: Record<string, unknown> | null
}

type PredictionHistoryRow = Record<string, unknown>

/** Columns we actually render, with fallbacks for older history schemas. */
const HISTORY_BASE_COLUMNS =
  'id, created_at, chromosome, variant_position, prediction, delta_score, final_interpretation'
const HISTORY_MINIMAL_COLUMNS =
  'id, created_at, chromosome, variant_position, prediction, delta_score'
const HISTORY_COLUMN_SETS = [
  `${HISTORY_BASE_COLUMNS}, reference, alternative`,
  `${HISTORY_BASE_COLUMNS}, reference_allele, alternative_allele`,
  `${HISTORY_BASE_COLUMNS}, variant_reference, variant_alternative`,
  `${HISTORY_BASE_COLUMNS}, ref, alt`,
  HISTORY_BASE_COLUMNS,
  `${HISTORY_MINIMAL_COLUMNS}, reference, alternative`,
  `${HISTORY_MINIMAL_COLUMNS}, reference_allele, alternative_allele`,
  `${HISTORY_MINIMAL_COLUMNS}, variant_reference, variant_alternative`,
  `${HISTORY_MINIMAL_COLUMNS}, ref, alt`,
  HISTORY_MINIMAL_COLUMNS,
] as const

/** Maximum number of rows shown on the dashboard. */
const DASHBOARD_HISTORY_LIMIT = 50

function formatDeltaScore(value: string | number | null) {
  const score = Number(value)

  if (!Number.isFinite(score)) {
    return ''
  }

  return score.toFixed(5)
}

function readInterpretationLevel(value: Record<string, unknown> | null) {
  return typeof value?.level === 'string' ? value.level : ''
}

function isPathogenicPrediction(value: string | null) {
  return value?.toLowerCase().includes('pathogenic') ?? false
}

function isMissingColumnError(error: { message?: string } | null | undefined) {
  const message = error?.message ?? ''

  return (
    /column .* does not exist/i.test(message) ||
    /could not find .* column .* schema cache/i.test(message)
  )
}

function readString(row: PredictionHistoryRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key]

    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }

    if (typeof value === 'number' || typeof value === 'bigint') {
      return String(value)
    }
  }

  return null
}

function readRecord(row: PredictionHistoryRow, key: string) {
  const value = row[key]

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return null
}

function toPredictionHistoryRecord(row: PredictionHistoryRow): PredictionHistoryRecord {
  const createdAt = readString(row, ['created_at']) ?? new Date(0).toISOString()
  const variantPosition = readString(row, ['variant_position', 'position'])

  return {
    id: readString(row, ['id']) ?? `${createdAt}-${variantPosition ?? 'unknown'}`,
    created_at: createdAt,
    chromosome: readString(row, ['chromosome']),
    variant_position: variantPosition,
    reference: readString(row, [
      'reference',
      'reference_allele',
      'variant_reference',
      'ref',
    ]),
    alternative: readString(row, [
      'alternative',
      'alternative_allele',
      'variant_alternative',
      'alt',
    ]),
    prediction: readString(row, ['prediction']),
    delta_score: readString(row, ['delta_score']),
    final_interpretation: readRecord(row, 'final_interpretation'),
  }
}

async function fetchPredictionHistory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  let lastMissingColumnError: { message: string } | null = null

  for (const columns of HISTORY_COLUMN_SETS) {
    const { data, error } = await supabase
      .from('prediction_history')
      .select(columns as string)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(DASHBOARD_HISTORY_LIMIT)

    if (!error) {
      return {
        data: Array.isArray(data)
          ? (data as unknown as PredictionHistoryRow[])
          : [],
        error: null,
      }
    }

    if (!isMissingColumnError(error)) {
      return { data: null, error }
    }

    lastMissingColumnError = error
  }

  return { data: null, error: lastMissingColumnError }
}

export async function HistoryTable({ userId }: { userId: string }) {
  const supabase = await createClient()

  const { data: history, error } = await fetchPredictionHistory(supabase, userId)

  if (error) {
    console.error("Error fetching history:", error.message)
    return <div className="text-red-400 p-4">Error loading history records.</div>
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Activity className="mx-auto h-12 w-12 opacity-20 mb-4" />
        <p>You haven&apos;t run any predictions yet.</p>
        <Link href="/" className="text-phosphor hover:underline mt-2 inline-block">
          Go analyze your first variant &rarr;
        </Link>
      </div>
    )
  }

  const records = history.map(toPredictionHistoryRecord)

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border/50 hover:bg-transparent">
            <TableHead>Date</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Variant</TableHead>
            <TableHead>Prediction</TableHead>
            <TableHead>Interpretation</TableHead>
            <TableHead className="text-right">Evo2 Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.id} className="border-border/40 border-b transition-colors hover:bg-muted/50">
              <TableCell className="font-medium text-muted-foreground">
                {new Date(record.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <span className="text-phosphor">{record.chromosome ?? 'chr?'}</span>:
                {record.variant_position ?? '?'}
              </TableCell>
              <TableCell>
                <span className="bg-muted px-2 py-1 rounded text-xs font-mono">
                  {record.reference ?? '?'}&gt;{record.alternative ?? '?'}
                </span>
              </TableCell>
              <TableCell>
                {isPathogenicPrediction(record.prediction) ? (
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
              <TableCell className="capitalize">
                {readInterpretationLevel(record.final_interpretation) || 'pending'}
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {formatDeltaScore(record.delta_score)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
