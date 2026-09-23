"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GeneViewer from "~/components/gene-viewer";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Skeleton } from "~/components/ui/skeleton";
import {
  type ClinvarVariant,
  type GeneFromSearch,
  type GenomeAssemblyFromSearch,
  type GeneSearchResult,
  getAvailableGenomes,
  getGenomeChromosomes,
  searchGenes,
  fetchChromosomeGenes,
} from "~/utils/genome-api";
import { useDebounce } from "~/hooks/use-debounce";
import {
  formatAllowedGenomes,
  isGenomeAllowedForPlan,
  planAllowsAllGenomes,
} from "~/lib/plans";
import { ACTIVE_ACCESS_PLAN } from "~/lib/app-access";

type Mode = "browse" | "search";

const CardSkeleton = () => (
  <Card className="border-border/50 bg-card/95 gap-0 border">
    <CardHeader className="pb-0">
      <Skeleton className="h-5 w-40" />
    </CardHeader>
    <CardContent className="space-y-3 pb-6">
      {Array.from({ length: 3 }).map((_, idx) => (
        <Skeleton key={idx} className="h-10 w-full" />
      ))}
    </CardContent>
  </Card>
);

const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-3">
    <Skeleton className="h-4 w-48" />
    <div className="border-border/50 bg-muted rounded-lg border">
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="border-border/60 grid grid-cols-3 gap-4 border-b px-4 py-3 last:border-b-0"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  </div>
);

export default function HomePage() {
  const [selectedGenome, setSelectedGenome] = useState<string>("hg38");
  const [selectedChromosome, setSelectedChromosome] = useState<string>("");
  const [selectedGene, setSelectedGene] = useState<GeneFromSearch | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeneFromSearch[]>([]);
  const [isGeneSearchLoading, setIsGeneSearchLoading] = useState(false);
  const [isLoadingMoreGenes, setIsLoadingMoreGenes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("search");
  const [geneTotalCount, setGeneTotalCount] = useState(0);
  const [geneHasMore, setGeneHasMore] = useState(false);
  const lastSearchRef = useRef("");
  const debouncedQuery = useDebounce(searchQuery, 400);

  // ── Analysis results cache ──────────────────────────────────
  // Persists full analysis data across GeneViewer unmount/remount cycles
  // so that when a user navigates back to a gene, previously-analyzed
  // variants still show their results instead of being lost.
  const analysisCacheRef = useRef<Map<string, ClinvarVariant["analysisResult"]>>(
    new Map(),
  );

  const onAnalysisComplete = useCallback(
    (clinvarId: string, result: ClinvarVariant["analysisResult"]) => {
      if (result) {
        analysisCacheRef.current.set(clinvarId, result);
      }
    },
    [],
  );

  const {
    data: genomeResponse,
    isFetching: isGenomesFetching,
    error: genomesError,
    refetch: refetchGenomes,
  } = useQuery({
    queryKey: ["genomes"],
    queryFn: getAvailableGenomes,
    staleTime: 1000 * 60 * 60,
  });

  const {
    data: chromosomeResponse,
    isFetching: isChromosomesFetching,
    error: chromosomesError,
    refetch: refetchChromosomes,
  } = useQuery({
    queryKey: ["chromosomes", selectedGenome],
    queryFn: () => getGenomeChromosomes(selectedGenome),
    enabled: Boolean(selectedGenome),
    staleTime: 1000 * 60 * 15,
  });

  const planType = ACTIVE_ACCESS_PLAN;
  const chromosomes = useMemo(
    () => chromosomeResponse?.chromosomes ?? [],
    [chromosomeResponse],
  );
  const allHumanGenomes = useMemo<GenomeAssemblyFromSearch[]>(
    () => genomeResponse?.genomes?.Human ?? [],
    [genomeResponse],
  );
  const genomes = useMemo(
    () =>
      planAllowsAllGenomes(planType)
        ? allHumanGenomes
        : allHumanGenomes.filter((genome) =>
            isGenomeAllowedForPlan(planType, genome.id),
          ),
    [allHumanGenomes, planType],
  );

  useEffect(() => {
    if (isGenomeAllowedForPlan(planType, selectedGenome)) return;
    handleGenomeChange("hg38");
  }, [planType, selectedGenome]);

  useEffect(() => {
    if (!chromosomes.length) return;
    if (
      !selectedChromosome ||
      !chromosomes.some((c) => c.name === selectedChromosome)
    ) {
      setSelectedChromosome(chromosomes[0]!.name);
    }
  }, [chromosomes, selectedChromosome]);

  const performGeneSearch = useCallback(
    async (query: string, genome: string, chromosomeFilter?: string) => {
      try {
        setIsGeneSearchLoading(true);
        const data = await searchGenes(query, genome, chromosomeFilter);
        setSearchResults(data.results);
        setGeneTotalCount(0);
        setGeneHasMore(false);
      } catch {
        setError("Failed to search genes");
      } finally {
        setIsGeneSearchLoading(false);
      }
    },
    [],
  );

  const fetchChromosomeGenesWithPagination = useCallback(
    async (chromosome: string, genome: string, append = false, offset = 0) => {
      try {
        if (append) {
          setIsLoadingMoreGenes(true);
        } else {
          setIsGeneSearchLoading(true);
          setSearchResults([]);
        }
        setError(null);

        const result: GeneSearchResult = await fetchChromosomeGenes(
          chromosome,
          genome,
          offset,
          100, // Load 100 genes per batch
        );

        if (append) {
          setSearchResults((prev) => [...prev, ...result.genes]);
        } else {
          setSearchResults(result.genes);
        }

        setGeneTotalCount(result.totalCount);
        setGeneHasMore(result.hasMore);
      } catch {
        setError("Failed to fetch genes for chromosome");
        if (!append) {
          setSearchResults([]);
        }
      } finally {
        setIsGeneSearchLoading(false);
        setIsLoadingMoreGenes(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedChromosome || mode !== "browse") return;
    void fetchChromosomeGenesWithPagination(
      selectedChromosome,
      selectedGenome,
      false,
    );
  }, [
    fetchChromosomeGenesWithPagination,
    selectedChromosome,
    selectedGenome,
    mode,
  ]);

  const handleGenomeChange = (value: string) => {
    setSelectedGenome(value);
    setSearchResults([]);
    setSelectedGene(null);
    setSelectedChromosome("");
  };

  const handleRetry = () => {
    if (mode === "search" && searchQuery.trim()) {
      void performGeneSearch(searchQuery, selectedGenome);
      return;
    }
    if (mode === "browse" && selectedChromosome) {
      void fetchChromosomeGenesWithPagination(
        selectedChromosome,
        selectedGenome,
        false,
      );
      return;
    }
    if (genomesError) {
      void refetchGenomes();
      return;
    }
    if (chromosomesError) {
      void refetchChromosomes();
    }
  };

  const switchMode = (newMode: Mode) => {
    if (newMode === mode) return;

    setSearchResults([]);
    setSelectedGene(null);
    setError(null);
    setGeneTotalCount(0);
    setGeneHasMore(false);

    if (newMode === "browse" && selectedChromosome) {
      void fetchChromosomeGenesWithPagination(
        selectedChromosome,
        selectedGenome,
        false,
      );
    }

    setMode(newMode);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    lastSearchRef.current = searchQuery.trim();
    void performGeneSearch(searchQuery, selectedGenome);
  };

  const loadBRCA1Example = () => {
    setMode("search");
    setSearchQuery("BRCA1");
    lastSearchRef.current = "BRCA1";
    void performGeneSearch("BRCA1", selectedGenome);
  };

  useEffect(() => {
    if (mode !== "search") return;
    const trimmed = debouncedQuery.trim();
    if (!trimmed || trimmed === lastSearchRef.current) return;
    lastSearchRef.current = trimmed;
    void performGeneSearch(trimmed, selectedGenome);
  }, [debouncedQuery, mode, performGeneSearch, selectedGenome]);

  const baseLoading =
    isGenomesFetching || (isChromosomesFetching && !chromosomes.length);
  const isInitialLoading =
    baseLoading && searchResults.length === 0 && !selectedGene;
  const derivedError =
    error ??
    (genomesError instanceof Error ? genomesError.message : null) ??
    (chromosomesError instanceof Error ? chromosomesError.message : null);

  return (
    <div className="bg-background text-foreground min-h-screen">
      <main className="container mx-auto p-4 pt-6 md:p-6 lg:p-8 xl:p-12">
        <div className="section-stack">
          <div>
            <h1 className="heading-1">DNAAnalyzer</h1>
          </div>
          <div>
            {selectedGene ? (
              <GeneViewer
                gene={selectedGene}
                genomeId={selectedGenome}
                planType={planType}
                onClose={() => setSelectedGene(null)}
                analysisCache={analysisCacheRef.current}
                onAnalysisComplete={onAnalysisComplete}
              />
            ) : (
              <div className="section-stack">
                {isInitialLoading ? (
                  <>
                    <CardSkeleton />
                    <CardSkeleton />
                    <TableSkeleton />
                  </>
                ) : (
                  <>
                    <Card className="border-border/50 bg-card/95 gap-0 border">
                      <CardHeader className="pb-0">
                        <div className="flex items-center justify-between">
                          <CardTitle className="heading-4 text-muted-foreground">
                            Genome Assembly
                          </CardTitle>
                          <div className="text-muted-foreground text-xs font-medium">
                            Organism:{" "}
                            <span className="text-foreground">Human</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-6">
                        <Select
                          value={selectedGenome}
                          onValueChange={handleGenomeChange}
                          disabled={baseLoading}
                        >
                          <SelectTrigger className="border-border h-10 w-full">
                            <SelectValue placeholder="Select genome assembly" />
                          </SelectTrigger>
                          <SelectContent>
                            {genomes.map((genome) => (
                              <SelectItem key={genome.id} value={genome.id}>
                                {genome.id} - {genome.name}
                                {genome.active ? " (active)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedGenome && (
                          <p className="text-muted-foreground mt-3 text-sm">
                            {
                              genomes.find(
                                (genome) => genome.id === selectedGenome,
                              )?.sourceName
                            }
                          </p>
                        )}
                        {planType === "student" ? (
                          <p className="mt-3 text-sm text-amber-300">
                            Student is limited to hg38. Upgrade to
                            Researcher Demo in Settings to use{" "}
                            {formatAllowedGenomes("researcher").toLowerCase()}.
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-card/95 gap-0 border">
                      <CardHeader className="pb-0">
                        <CardTitle className="heading-4 text-muted-foreground">
                          Browse
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pb-6">
                        <Tabs
                          value={mode}
                          onValueChange={(value) => switchMode(value as Mode)}
                        >
                          <TabsList className="bg-muted mb-4">
                            <TabsTrigger
                              className="data-[state=active]:bg-card data-[state=active]:text-foreground"
                              value="search"
                            >
                              Search Genes
                            </TabsTrigger>
                            <TabsTrigger
                              className="data-[state=active]:bg-card data-[state=active]:text-foreground"
                              value="browse"
                            >
                              Browse Chromosomes
                            </TabsTrigger>
                          </TabsList>

                          <TabsContent value="search" className="mt-0">
                            <div className="space-y-4">
                              <form
                                onSubmit={handleSearch}
                                className="flex flex-col gap-4 sm:flex-row"
                              >
                                <div className="relative flex-1">
                                  <Input
                                    type="text"
                                    placeholder="Enter gene symbol or name"
                                    value={searchQuery}
                                    onChange={(e) =>
                                      setSearchQuery(e.target.value)
                                    }
                                    className="border-border h-10 pr-12"
                                  />
                                  <Button
                                    type="submit"
                                    className="bg-primary text-primary-foreground hover:bg-primary/90 absolute top-0 right-0 h-full cursor-pointer rounded-l-none"
                                    size="icon"
                                    disabled={
                                      isGeneSearchLoading || !searchQuery.trim()
                                    }
                                  >
                                    <Search className="h-4 w-4" />
                                    <span className="sr-only">Search</span>
                                  </Button>
                                </div>
                              </form>
                              <Button
                                variant="link"
                                className="text-accent hover:text-accent/80 h-auto cursor-pointer p-0"
                                onClick={loadBRCA1Example}
                              >
                                Try BRCA1 example
                              </Button>
                            </div>
                          </TabsContent>

                          <TabsContent value="browse" className="mt-0">
                            <div className="max-h-[150px] overflow-y-auto pr-1">
                              <div className="flex flex-wrap gap-2">
                                {chromosomes.map((chrom) => (
                                  <Button
                                    key={chrom.name}
                                    variant="outline"
                                    size="sm"
                                    className={`border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground bg-card h-9 cursor-pointer text-sm font-medium ${selectedChromosome === chrom.name ? "bg-muted text-foreground border-phosphor/30" : ""}`}
                                    onClick={() =>
                                      setSelectedChromosome(chrom.name)
                                    }
                                  >
                                    {chrom.name}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>

                        {derivedError && (
                          <div className="mt-4 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4" />
                              <span>{derivedError}</span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-3"
                              onClick={handleRetry}
                            >
                              Retry
                            </Button>
                          </div>
                        )}

                        {isGeneSearchLoading && searchResults.length === 0 ? (
                          <TableSkeleton />
                        ) : (
                          <>
                            {searchResults.length > 0 && (
                              <div className="section-stack">
                                <div>
                                  <h4 className="muted-label">
                                    {mode === "search" ? (
                                      <>
                                        Search Results:{" "}
                                        <span className="text-phosphor font-medium">
                                          {searchResults.length} genes
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        Protein-coding Genes on{" "}
                                        {selectedChromosome}:{" "}
                                        <span className="text-foreground font-semibold">
                                          {geneTotalCount > 0
                                            ? `Showing ${searchResults.length} of ${geneTotalCount.toLocaleString()}`
                                            : `${searchResults.length} found`}
                                        </span>
                                      </>
                                    )}
                                  </h4>
                                </div>

                                <div>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Symbol</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Location</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {searchResults.map((gene, index) => (
                                        <TableRow
                                          key={`${gene.symbol}-${index}`}
                                          className="cursor-pointer"
                                          onClick={() => setSelectedGene(gene)}
                                        >
                                          <TableCell className="font-medium">
                                            {gene.symbol}
                                          </TableCell>
                                          <TableCell className="font-medium">
                                            {gene.name}
                                          </TableCell>
                                          <TableCell className="font-medium">
                                            {gene.chrom}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>

                                {/* Load More Button for Browse Mode */}
                                {mode === "browse" && geneHasMore && (
                                  <div className="flex justify-center">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        void fetchChromosomeGenesWithPagination(
                                          selectedChromosome,
                                          selectedGenome,
                                          true,
                                          searchResults.length,
                                        )
                                      }
                                      disabled={isLoadingMoreGenes}
                                      className="border-border/50 bg-card text-foreground hover:bg-muted h-10 cursor-pointer px-5 text-sm"
                                    >
                                      {isLoadingMoreGenes ? (
                                        <>
                                          <span className="border-muted-foreground border-t-phosphor mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2"></span>
                                          Loading more genes...
                                        </>
                                      ) : (
                                        `Load More Genes (${(geneTotalCount - searchResults.length).toLocaleString()} remaining)`
                                      )}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}

                        {!baseLoading &&
                          !isGeneSearchLoading &&
                          !error &&
                          searchResults.length === 0 && (
                            <div className="border-border/50 bg-muted/60 text-muted-foreground flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center">
                              <Search className="text-muted-foreground mb-4 h-10 w-10" />
                              <p className="text-sm leading-relaxed">
                                {mode === "search"
                                  ? "Start by entering a gene symbol (e.g., BRCA1) or try the example above."
                                  : selectedChromosome
                                    ? `No genes found on ${selectedChromosome}. Pick another chromosome or switch back to Search.`
                                    : "Select a chromosome to browse protein-coding genes."}
                              </p>
                            </div>
                          )}
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
