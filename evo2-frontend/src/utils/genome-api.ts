/* eslint-disable */

export interface GenomeAssemblyFromSearch {
  id: string;
  name: string;
  sourceName: string;
  active: boolean;
}

export interface ChromosomeFromSeach {
  name: string;
  size: number;
}

export interface GeneFromSearch {
  symbol: string;
  name: string;
  chrom: string;
  description: string;
  gene_id?: string;
}

export interface GeneDetailsFromSearch {
  genomicinfo?: {
    chrstart: number;
    chrstop: number;
    strand?: string;
  }[];
  summary?: string;
  organism?: {
    scientificname: string;
    commonname: string;
  };
}

export interface GeneBounds {
  min: number;
  max: number;
}

export interface ClinvarVariant {
  clinvar_id: string;
  title: string;
  variation_type: string;
  classification: string;
  gene_sort: string;
  chromosome: string;
  location: string;
  evo2Result?: {
    position: number;
    reference: string;
    alternative: string;
    prediction: string;
    delta_score: number;
    classification_confidence: number;
  };
  analysisResult?: VariantAnalysisResult;
  isAnalyzing?: boolean;
  evo2Error?: string;
}

export interface AnalysisResult {
  position: number;
  reference: string;
  alternative: string;
  delta_score: number;
  prediction: string;
  classification_confidence: number;
  variant_key?: string;
  cached?: boolean;
}

export interface DiseaseAssociationInput {
  variant_position: number;
  reference: string;
  alternative: string;
  genome: string;
  chromosome: string;
  gene?: string;
  gene_symbol?: string;
  rsid?: string;
  clinvar_variation_id?: string;
  hgvs_g?: string;
  transcript_id?: string;
  source?: string;
  evo2?: Evo2Analysis;
  explore_disease_associations?: boolean;
}

export interface CanonicalVariant {
  assembly: string;
  chromosome: string;
  position: number;
  ref: string;
  alt: string;
  variant_type: string;
  hgvs_g: string;
  rsid?: string | null;
  clinvar_variation_id?: string | null;
  gene_symbol?: string | null;
  transcript_id?: string | null;
  source: string;
  malformed_fields: string[];
  variant_key: string;
}

export type Evo2Prediction =
  | "pathogenic"
  | "likely_pathogenic"
  | "uncertain"
  | "likely_benign"
  | "benign";

export interface Evo2Analysis {
  prediction: Evo2Prediction;
  classification: string;
  score: number | null;
  confidence: number | null;
  delta_score: number | null;
  cached: boolean;
  raw_prediction?: string | null;
}

export interface NormalizedVariant {
  variant_key: string;
  assembly: string;
  gene: string | null;
  chrom: string;
  pos: number;
  ref: string;
  alt: string;
  rsid: string | null;
  clinvar_variation_id: string | null;
  hgvs_g: string;
  transcript_id: string | null;
  source: string;
}

export interface ClinvarDiseaseEvidence {
  last_evaluated?: string | null;
  disease_name: string;
  disease_id: string | null;
  clinical_significance: string | null;
  sig_group: string | null;
  review_status: string | null;
  review_score: number | null;
  variation_id?: string | null;
  rsid?: string | null;
  source: string;
}

export interface DiseaseModelRanking {
  disease_name: string;
  association_score: number;
  source: "custom_ml_model";
}

export interface FinalInterpretation {
  level: "strong" | "conflicting" | "possible" | "low" | "insufficient";
  message: string;
  confidence_explanation: string;
  warning: string;
  ranking_policy?: import("~/lib/disease-ranking-policy").RankingPolicy;
  ranking_policy_version?: number;
  ranking_status?: DiseaseAssociationStatus;
}

export type DiseaseAssociationStatus =
  | "plan_locked"
  | "available"
  | "skipped_benign"
  | "skipped_uncertain"
  | "exploratory_uncertain"
  | "unsupported_gene"
  | "no_evidence_found"
  | "model_unavailable";

export interface DiseaseAssociationResult {
  status: DiseaseAssociationStatus;
  clinvar_evidence: ClinvarDiseaseEvidence[];
  disease_model_ranking: DiseaseModelRanking[];
  final_interpretation: FinalInterpretation | null;
  model_version: string | null;
  warnings: string[];
}

export interface VariantAnalysisResult {
  variant_key: string;
  gene: string | null;
  normalized_variant: NormalizedVariant;
  evo2: Evo2Analysis;
  disease_association: DiseaseAssociationResult;
  clinvar_evidence: ClinvarDiseaseEvidence[];
  disease_model_ranking: DiseaseModelRanking[];
  final_interpretation: FinalInterpretation | null;
  model_version: string | null;
  warnings: string[];
}

export async function getAvailableGenomes() {
  const apiUrl = "https://api.genome.ucsc.edu/list/ucscGenomes";
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error("Failed to fetch genome list from UCSC API");
  }

  const genomeData = await response.json();
  if (!genomeData.ucscGenomes) {
    throw new Error("UCSC API error: missing ucscGenomes");
  }

  const genomes = genomeData.ucscGenomes;
  const structuredGenomes: Record<string, GenomeAssemblyFromSearch[]> = {};

  for (const genomeId in genomes) {
    const genomeInfo = genomes[genomeId];
    const organism = genomeInfo.organism || "Other";

    if (!structuredGenomes[organism]) structuredGenomes[organism] = [];
    structuredGenomes[organism].push({
      id: genomeId,
      name: genomeInfo.description || genomeId,
      sourceName: genomeInfo.sourceName || genomeId,
      active: !!genomeInfo.active,
    });
  }

  return { genomes: structuredGenomes };
}

export async function getGenomeChromosomes(genomeId: string) {
  const apiUrl = `https://api.genome.ucsc.edu/list/chromosomes?genome=${genomeId}`;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error("Failed to fetch chromosome list from UCSC API");
  }

  const chromosomeData = await response.json();
  if (!chromosomeData.chromosomes) {
    throw new Error("UCSC API error: missing chromosomes");
  }

  const chromosomes: ChromosomeFromSeach[] = [];
  for (const chromId in chromosomeData.chromosomes) {
    if (
      chromId.includes("_") ||
      chromId.includes("Un") ||
      chromId.includes("random")
    )
      continue;
    chromosomes.push({
      name: chromId,
      size: chromosomeData.chromosomes[chromId],
    });
  }

  // chr1, chr2, ... chrX, chrY
  chromosomes.sort((a, b) => {
    const anum = a.name.replace("chr", "");
    const bnum = b.name.replace("chr", "");
    const isNumA = /^\d+$/.test(anum);
    const isNumB = /^\d+$/.test(bnum);
    if (isNumA && isNumB) return Number(anum) - Number(bnum);
    if (isNumA) return -1;
    if (isNumB) return 1;
    return anum.localeCompare(bnum);
  });

  return { chromosomes };
}

// Valid gene types to include (protein-coding and functional RNA genes)
const VALID_GENE_TYPES = new Set([
  "protein-coding",
  "ncRNA",
  "rRNA",
  "tRNA",
  "snRNA",
  "snoRNA",
  "misc_RNA",
]);

// Gene types to exclude (non-functional or regulatory elements)
const EXCLUDED_GENE_TYPES = new Set([
  "pseudo",
  "pseudogene",
  "unknown",
  "other",
]);

export interface GeneSearchResult {
  genes: GeneFromSearch[];
  totalCount: number;
  hasMore: boolean;
}

export async function searchGenes(
  query: string,
  genome: string,
  chromosomeFilter?: string,
  options?: {
    maxResults?: number;
    proteinCodingOnly?: boolean;
  },
) {
  const url = "https://clinicaltables.nlm.nih.gov/api/ncbi_genes/v3/search";
  const params = new URLSearchParams({
    terms: query,
    df: "chromosome,Symbol,description,map_location,type_of_gene",
    ef: "chromosome,Symbol,description,map_location,type_of_gene,GenomicInfo,GeneID",
    maxList: "1000", // Fetch more results for better filtering
  });
  const response = await fetch(`${url}?${params}`);
  if (!response.ok) {
    throw new Error("NCBI API Error");
  }

  const data = await response.json();
  const results: GeneFromSearch[] = [];
  const maxResults = options?.maxResults || 100;
  const proteinCodingOnly = options?.proteinCodingOnly ?? false;

  if (data[0] > 0) {
    const fieldMap = data[2];
    const geneIds = fieldMap.GeneID || [];
    const typeOfGene = fieldMap.type_of_gene || [];

    for (let i = 0; i < Math.min(1000, data[0]); ++i) {
      if (i < data[3].length) {
        try {
          const display = data[3][i];
          let chrom = display[0];
          if (chrom && !chrom.startsWith("chr")) {
            chrom = `chr${chrom}`;
          }

          // Apply chromosome filter if provided
          if (chromosomeFilter && chrom !== chromosomeFilter) {
            continue;
          }

          // Get gene type and filter out non-gene features
          const geneType = typeOfGene[i]?.toLowerCase() || "unknown";

          // Skip if it's an excluded type or contains excluded keywords
          if (
            EXCLUDED_GENE_TYPES.has(geneType) ||
            geneType.includes("pseudo")
          ) {
            continue;
          }

          // If protein-coding only mode, be more strict
          if (proteinCodingOnly) {
            if (!geneType.includes("protein")) {
              continue;
            }
          } else {
            // Only include if it's a valid gene type OR if it's protein-coding
            if (
              !VALID_GENE_TYPES.has(geneType) &&
              !geneType.includes("protein")
            ) {
              continue;
            }
          }

          results.push({
            symbol: display[2],
            name: display[3],
            chrom,
            description: display[3],
            gene_id: geneIds[i] || "",
          });

          // Stop if we've reached the maximum
          if (results.length >= maxResults) {
            break;
          }
        } catch {
          continue;
        }
      }
    }
  }

  return { query, genome, results };
}

/**
 * Fetch genes for a specific chromosome with TRUE server-side pagination using NCBI E-utilities
 * Returns protein-coding genes only for chromosome browsing
 */
export async function fetchChromosomeGenes(
  chromosome: string,
  genome: string,
  offset: number = 0,
  limit: number = 50,
): Promise<GeneSearchResult> {
  const chromNumber = chromosome.replace(/^chr/i, "");

  // Step 1: Search for gene IDs on this chromosome using NCBI E-utilities
  const searchUrl =
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";

  // Build search term for protein-coding genes on specific chromosome
  // Using NCBI Entrez query syntax
  const searchTerm = `${chromNumber}[Chromosome] AND Homo sapiens[Organism] AND alive[property] AND genetype protein coding[Properties]`;

  const searchParams = new URLSearchParams({
    db: "gene",
    term: searchTerm,
    retmax: String(limit),
    retstart: String(offset),
    retmode: "json",
    sort: "Name",
  });

  const searchResponse = await fetch(`${searchUrl}?${searchParams.toString()}`);

  if (!searchResponse.ok) {
    throw new Error("NCBI Gene search failed: " + searchResponse.statusText);
  }

  const searchData = await searchResponse.json();
  const totalCount = parseInt(searchData.esearchresult?.count || "0");

  if (
    !searchData.esearchresult ||
    !searchData.esearchresult.idlist ||
    searchData.esearchresult.idlist.length === 0
  ) {
    return { genes: [], totalCount: 0, hasMore: false };
  }

  const geneIds = searchData.esearchresult.idlist;

  // Step 2: Fetch details for these gene IDs
  const summaryUrl =
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";
  const summaryParams = new URLSearchParams({
    db: "gene",
    id: geneIds.join(","),
    retmode: "json",
  });

  const summaryResponse = await fetch(
    `${summaryUrl}?${summaryParams.toString()}`,
  );

  if (!summaryResponse.ok) {
    throw new Error(
      "Failed to fetch gene details: " + summaryResponse.statusText,
    );
  }

  const summaryData = await summaryResponse.json();
  const genes: GeneFromSearch[] = [];

  if (summaryData.result && summaryData.result.uids) {
    for (const id of summaryData.result.uids) {
      const gene = summaryData.result[id];

      // Extract chromosome from genomicinfo
      let geneChrom = "";
      if (gene.genomicinfo && gene.genomicinfo.length > 0) {
        const genomicInfo = gene.genomicinfo[0];
        geneChrom = genomicInfo.chrloc;
        if (geneChrom && !geneChrom.startsWith("chr")) {
          geneChrom = `chr${geneChrom}`;
        }
      }

      genes.push({
        symbol: gene.name || "",
        name: gene.description || "",
        chrom: geneChrom || chromosome,
        description: gene.description || "",
        gene_id: id,
      });
    }
  }

  const hasMore = offset + genes.length < totalCount;

  return {
    genes,
    totalCount,
    hasMore,
  };
}

export async function fetchGeneDetails(geneId: string): Promise<{
  geneDetails: GeneDetailsFromSearch | null;
  geneBounds: GeneBounds | null;
  initialRange: { start: number; end: number } | null;
}> {
  try {
    const detailUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gene&id=${geneId}&retmode=json`;
    const detailsResponse = await fetch(detailUrl);

    if (!detailsResponse.ok) {
      console.error(
        `Failed to fetch gene details: ${detailsResponse.statusText}`,
      );
      return { geneDetails: null, geneBounds: null, initialRange: null };
    }

    const detailData = await detailsResponse.json();

    if (detailData.result && detailData.result[geneId]) {
      const detail = detailData.result[geneId];

      if (detail.genomicinfo && detail.genomicinfo.length > 0) {
        const info = detail.genomicinfo[0];

        const minPos = Math.min(info.chrstart, info.chrstop);
        const maxPos = Math.max(info.chrstart, info.chrstop);
        const bounds = { min: minPos, max: maxPos };

        const geneSize = maxPos - minPos;
        const seqStart = minPos;
        const seqEnd = geneSize > 10000 ? minPos + 10000 : maxPos;
        const range = { start: seqStart, end: seqEnd };

        return { geneDetails: detail, geneBounds: bounds, initialRange: range };
      }
    }

    return { geneDetails: null, geneBounds: null, initialRange: null };
  } catch (err) {
    return { geneDetails: null, geneBounds: null, initialRange: null };
  }
}

export async function fetchGeneSequence(
  chrom: string,
  start: number,
  end: number,
  genomeId: string,
): Promise<{
  sequence: string;
  actualRange: { start: number; end: number };
  error?: string;
}> {
  try {
    const chromosome = chrom.startsWith("chr") ? chrom : `chr${chrom}`;

    const apiStart = start - 1;
    const apiEnd = end;

    const apiUrl = `https://api.genome.ucsc.edu/getData/sequence?genome=${genomeId};chrom=${chromosome};start=${apiStart};end=${apiEnd}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    const actualRange = { start, end };

    if (data.error || !data.dna) {
      return { sequence: "", actualRange, error: data.error };
    }

    const sequence = data.dna.toUpperCase();

    return { sequence, actualRange };
  } catch (err) {
    return {
      sequence: "",
      actualRange: { start, end },
      error: "Internal error in fetch gene sequence",
    };
  }
}

export interface ClinvarFetchResult {
  variants: ClinvarVariant[];
  totalCount: number;
  hasMore: boolean;
}

export async function fetchClinvarVariants(
  chrom: string,
  geneBound: GeneBounds,
  genomeId: string,
  retstart: number = 0,
  retmax: number = 100,
): Promise<ClinvarFetchResult> {
  const chromFormatted = chrom.replace(/^chr/i, "");

  const minBound = Math.min(geneBound.min, geneBound.max);
  const maxBound = Math.max(geneBound.min, geneBound.max);

  const positionField = genomeId === "hg19" ? "chrpos37" : "chrpos38";
  const searchTerm = `${chromFormatted}[chromosome] AND ${minBound}:${maxBound}[${positionField}]`;

  const searchUrl =
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
  const searchParams = new URLSearchParams({
    db: "clinvar",
    term: searchTerm,
    retmode: "json",
    retmax: String(retmax),
    retstart: String(retstart),
  });

  const searchResponse = await fetch(`${searchUrl}?${searchParams.toString()}`);

  if (!searchResponse.ok) {
    throw new Error("ClinVar search failed: " + searchResponse.statusText);
  }

  const searchData = await searchResponse.json();

  const totalCount = parseInt(searchData.esearchresult?.count || "0");

  if (
    !searchData.esearchresult ||
    !searchData.esearchresult.idlist ||
    searchData.esearchresult.idlist.length === 0
  ) {
    console.log("No ClinVar variants found");
    return { variants: [], totalCount: 0, hasMore: false };
  }

  const variantIds = searchData.esearchresult.idlist;

  const summaryUrl =
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";
  const summaryParams = new URLSearchParams({
    db: "clinvar",
    id: variantIds.join(","),
    retmode: "json",
  });

  const summaryResponse = await fetch(
    `${summaryUrl}?${summaryParams.toString()}`,
  );

  if (!summaryResponse.ok) {
    throw new Error(
      "Failed to fetch variant details: " + summaryResponse.statusText,
    );
  }

  const summaryData = await summaryResponse.json();
  const variants: ClinvarVariant[] = [];

  if (summaryData.result && summaryData.result.uids) {
    for (const id of summaryData.result.uids) {
      const variant = summaryData.result[id];
      variants.push({
        clinvar_id: id,
        title: variant.title,
        variation_type: (variant.obj_type || "Unknown")
          .split(" ")
          .map(
            (word: string) =>
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
          )
          .join(" "),
        classification:
          variant.germline_classification.description || "Unknown",
        gene_sort: variant.gene_sort || "",
        chromosome: chromFormatted,
        location: variant.location_sort
          ? parseInt(variant.location_sort).toLocaleString()
          : "Unknown",
      });
    }
  }

  const hasMore = retstart + variants.length < totalCount;

  return { variants, totalCount, hasMore };
}

export async function analyzeVariantWithAPI({
  position,
  alternative,
  genomeId,
  chromosome,
  reference,
  geneSymbol,
  clinvarVariationId,
  rsid,
  hgvsG,
  transcriptId,
  source,
}: {
  position: number;
  alternative: string;
  genomeId: string;
  chromosome: string;
  reference?: string;
  geneSymbol?: string;
  clinvarVariationId?: string;
  rsid?: string;
  hgvsG?: string;
  transcriptId?: string;
  source?: string;
}): Promise<AnalysisResult> {
  const buildPayload = (nextAlternative: string) => ({
    variant_position: position,
    alternative: nextAlternative,
    genome: genomeId,
    chromosome,
    reference,
    gene_symbol: geneSymbol,
    clinvar_variation_id: clinvarVariationId,
    rsid,
    hgvs_g: hgvsG,
    transcript_id: transcriptId,
    source,
  });

  const requestAnalysis = (nextAlternative: string) =>
    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(nextAlternative)),
    });

  const response = await requestAnalysis(alternative);

  if (!response.ok && source === "clinvar") {
    const errorText = await response.text();
    const sameReferenceError =
      /Alternative base must be different from the reference base/i.test(
        errorText,
      );
    const complementedAlternative = complementBase(alternative);

    if (
      sameReferenceError &&
      complementedAlternative &&
      complementedAlternative !== alternative.toUpperCase()
    ) {
      const retryResponse = await requestAnalysis(complementedAlternative);

      if (retryResponse.ok) {
        return (await retryResponse.json()) as AnalysisResult;
      }

      throw new Error(
        await parseApiError(retryResponse, "Failed to analyze variant"),
      );
    }

    throw new Error(parseErrorText(errorText, "Failed to analyze variant"));
  }

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to analyze variant"));
  }

  return (await response.json()) as AnalysisResult;
}

function complementBase(base: string) {
  const complements: Record<string, string> = {
    A: "T",
    T: "A",
    C: "G",
    G: "C",
  };

  return complements[base.toUpperCase()] ?? null;
}

function parseErrorText(errorText: string, fallback: string) {
  try {
    const payload = JSON.parse(errorText);
    if (payload && typeof payload.error === "string") {
      return payload.error;
    }
  } catch {
    // Keep the raw text fallback below.
  }

  return errorText || fallback;
}

async function parseApiError(response: Response, fallback: string) {
  return parseErrorText(await response.text(), fallback);
}

export async function analyzeVariantPipelineWithAPI(
  input: DiseaseAssociationInput,
): Promise<VariantAnalysisResult> {
  const response = await fetch("/api/variant-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Failed to analyze variant"));
  }

  return (await response.json()) as VariantAnalysisResult;
}

export async function predictDiseaseAssociationWithAPI(
  input: DiseaseAssociationInput,
): Promise<VariantAnalysisResult> {
  const response = await fetch("/api/disease-association", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(
      await parseApiError(response, "Failed to predict disease association"),
    );
  }

  return (await response.json()) as VariantAnalysisResult;
}
