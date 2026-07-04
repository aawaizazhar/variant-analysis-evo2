"use client";

import type { GeneBounds, GeneDetailsFromSearch } from "~/utils/genome-api";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { getNucleotideColorClass } from "~/utils/coloring-utils";

type SequenceLine = {
  startPos: number;
  chunk: string;
};

const BASES_PER_LINE = 200;
const LINE_HEIGHT_PX = 20;
const VIRTUAL_BUFFER = 6;

export function GeneSequence({
  geneBounds,
  geneDetail,
  startPosition,
  endPosition,
  onStartPositionChange,
  onEndPositionChange,
  sequenceData,
  sequenceRange,
  isLoading,
  error,
  onSequenceLoadRequest,
  onSequenceClick,
  maxViewRange,
}: {
  geneBounds: GeneBounds | null;
  geneDetail: GeneDetailsFromSearch | null;
  startPosition: string;
  endPosition: string;
  onStartPositionChange: (value: string) => void;
  onEndPositionChange: (value: string) => void;
  sequenceData: string;
  sequenceRange: { start: number; end: number } | null;
  isLoading: boolean;
  error: string | null;
  onSequenceLoadRequest: () => void;
  onSequenceClick: (position: number, nucleotide: string) => void;
  maxViewRange: number;
}) {
  const [sliderValues, setSliderValues] = useState({ start: 60, end: 70 });
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [isDraggingRange, setIsDraggingRange] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef<{
    x: number;
    startPos: number;
    endPos: number;
  } | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [mousePosition, setMousePosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);
  const [sequenceLines, setSequenceLines] = useState<SequenceLine[]>([]);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });

  const currentRangeSize = useMemo(() => {
    const start = parseInt(startPosition);
    const end = parseInt(endPosition);
    return isNaN(start) || isNaN(end) || end < start ? 0 : end - start + 1;
  }, [startPosition, endPosition]);

  useEffect(() => {
    if (!geneBounds) return;

    const minBound = Math.min(geneBounds.min, geneBounds.max);
    const maxBound = Math.max(geneBounds.min, geneBounds.max);
    const totalSize = maxBound - minBound;

    const startNum = parseInt(startPosition);
    const endNum = parseInt(endPosition);

    if (isNaN(startNum) || isNaN(endNum) || totalSize <= 0) {
      setSliderValues({ start: 0, end: 100 });
      return;
    }

    const startPercent = ((startNum - minBound) / totalSize) * 100;
    const endPercent = ((endNum - minBound) / totalSize) * 100;

    setSliderValues({
      start: Math.max(0, Math.min(startPercent, 100)),
      end: Math.max(0, Math.min(endPercent, 100)),
    });
  }, [startPosition, endPosition, geneBounds]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingStart && !isDraggingEnd && !isDraggingRange) return;
      if (!sliderRef.current || !geneBounds) return;

      const sliderRect = sliderRef.current.getBoundingClientRect();
      const relativeX = e.clientX - sliderRect.left;
      const sliderWidth = sliderRect.width;
      let newPercent = (relativeX / sliderWidth) * 100;
      newPercent = Math.max(0, Math.min(newPercent, 100));

      const minBound = Math.min(geneBounds.min, geneBounds.max);
      const maxBound = Math.max(geneBounds.min, geneBounds.max);
      const geneSize = maxBound - minBound;

      const newPosition = Math.round(minBound + (geneSize * newPercent) / 100);
      const currentStartNum = parseInt(startPosition);
      const currentEndNum = parseInt(endPosition);

      if (isDraggingStart) {
        if (!isNaN(currentEndNum)) {
          if (currentEndNum - newPosition + 1 > maxViewRange) {
            onStartPositionChange(String(currentEndNum - maxViewRange + 1));
          } else if (newPosition < currentEndNum) {
            onStartPositionChange(String(newPosition));
          }
        }
      } else if (isDraggingEnd) {
        if (!isNaN(currentStartNum)) {
          if (newPosition - currentStartNum + 1 > maxViewRange) {
            onEndPositionChange(String(currentStartNum + maxViewRange - 1));
          } else if (newPosition > currentStartNum) {
            onEndPositionChange(String(newPosition));
          }
        }
      } else if (isDraggingRange) {
        if (!dragStartX.current) return;
        const pixelsPerBase = sliderWidth / geneSize;
        const dragDeltaPixels = relativeX - dragStartX.current.x;
        const dragDeltaBases = Math.round(dragDeltaPixels / pixelsPerBase);

        let newStart = dragStartX.current.startPos + dragDeltaBases;
        let newEnd = dragStartX.current.endPos + dragDeltaBases;
        const rangeSize =
          dragStartX.current.endPos - dragStartX.current.startPos;

        if (newStart < minBound) {
          newStart = minBound;
          newEnd = minBound + rangeSize;
        }
        if (newEnd > maxBound) {
          newEnd = maxBound;
          newStart = maxBound - rangeSize;
        }

        onStartPositionChange(String(newStart));
        onEndPositionChange(String(newEnd));
      }
    };

    const handleMouseUp = () => {
      if (
        (isDraggingStart || isDraggingEnd || isDraggingRange) &&
        startPosition &&
        endPosition
      ) {
        onSequenceLoadRequest();
      }
      setIsDraggingStart(false);
      setIsDraggingEnd(false);
      setIsDraggingRange(false);
      dragStartX.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isDraggingStart,
    isDraggingEnd,
    isDraggingRange,
    geneBounds,
    startPosition,
    endPosition,
    onStartPositionChange,
    onEndPositionChange,
    maxViewRange,
    onSequenceLoadRequest,
  ]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, handle: "start" | "end") => {
      e.preventDefault();
      if (handle === "start") setIsDraggingStart(true);
      else setIsDraggingEnd(true);
    },
    [],
  );

  const handleRangeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      if (!sliderRef.current) return;

      const startNum = parseInt(startPosition);
      const endNum = parseInt(endPosition);
      if (isNaN(startNum) || isNaN(endNum)) return;

      setIsDraggingRange(true);
      const sliderRect = sliderRef.current.getBoundingClientRect();
      const relativeX = e.clientX - sliderRect.left;
      dragStartX.current = {
        x: relativeX,
        startPos: startNum,
        endPos: endNum,
      };
    },
    [startPosition, endPosition],
  );

  const determineLinesPerViewport = useCallback(() => {
    const container = scrollContainerRef.current;
    const height = container?.clientHeight ?? 256;
    return Math.ceil(height / LINE_HEIGHT_PX) + VIRTUAL_BUFFER * 2;
  }, []);

  useEffect(() => {
    if (!sequenceData || !sequenceRange) {
      setSequenceLines([]);
      setVisibleRange({ start: 0, end: 0 });
      return;
    }

    startTransition(() => {
      const start = sequenceRange.start;
      const lines: SequenceLine[] = [];
      for (let i = 0; i < sequenceData.length; i += BASES_PER_LINE) {
        lines.push({
          startPos: start + i,
          chunk: sequenceData.substring(i, i + BASES_PER_LINE),
        });
      }
      setSequenceLines(lines);
      const nextEnd = Math.min(lines.length, determineLinesPerViewport());
      setVisibleRange({ start: 0, end: nextEnd });
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    });
  }, [sequenceData, sequenceRange, determineLinesPerViewport]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !sequenceLines.length) return;

    const updateRange = () => {
      const linesPerViewport = determineLinesPerViewport();
      const startLine = Math.max(
        0,
        Math.floor(container.scrollTop / LINE_HEIGHT_PX) - VIRTUAL_BUFFER,
      );
      const endLine = Math.min(
        sequenceLines.length,
        startLine + linesPerViewport,
      );
      setVisibleRange({
        start: startLine,
        end: endLine,
      });
    };

    const handleScroll = () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = window.requestAnimationFrame(updateRange);
    };

    container.addEventListener("scroll", handleScroll);
    updateRange();

    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [determineLinesPerViewport, sequenceLines.length]);

  const totalLines = sequenceLines.length;
  const visibleLines = sequenceLines.slice(
    visibleRange.start,
    visibleRange.end,
  );
  const totalVirtualHeight = totalLines * LINE_HEIGHT_PX;
  const translateY = visibleRange.start * LINE_HEIGHT_PX;

  return (
    <Card variant="glass" className="gap-0 border-border/50 border">
      <CardHeader className="pt-4 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-normal">
          Gene Sequence
        </CardTitle>
      </CardHeader>

      <CardContent className="pb-4">
        {geneBounds && (
          <div className="mb-4 flex flex-col">
            <div className="text-muted-foreground mb-2 flex flex-col items-center justify-between text-xs sm:flex-row">
              <span className="flex items-center gap-1">
                <p className="sm:hidden">From: </p>
                <p>
                  {Math.min(geneBounds.min, geneBounds.max).toLocaleString()}
                </p>
              </span>
              <span className="opacity-80">
                Selected: {parseInt(startPosition || "0").toLocaleString()} -{" "}
                {parseInt(endPosition || "0").toLocaleString()} (
                {currentRangeSize.toLocaleString()} bp)
              </span>
              <span className="flex items-center gap-1">
                <p className="sm:hidden">To: </p>
                <p>
                  {Math.max(geneBounds.min, geneBounds.max).toLocaleString()}
                </p>
              </span>
            </div>

            {/* Slider component */}
            <div className="space-y-4">
              <div className="relative">
                <div
                  ref={sliderRef}
                  className="relative h-6 w-full cursor-pointer"
                >
                  {/* Track background */}
                  <div className="bg-muted absolute top-1/2 h-2 w-full -translate-y-1/2 rounded-full"></div>

                  {/* Selected range */}
                  <div
                    className="bg-primary absolute top-1/2 h-2 -translate-y-1/2 cursor-grab rounded-full active:cursor-grabbing"
                    style={{
                      left: `${sliderValues.start}%`,
                      width: `${sliderValues.end - sliderValues.start}%`,
                    }}
                    onMouseDown={handleRangeMouseDown}
                  ></div>

                  {/* Start handle */}
                  <div
                    className="border-phosphor bg-background absolute top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 shadow active:cursor-grabbing"
                    style={{ left: `${sliderValues.start}%` }}
                    onMouseDown={(e) => handleMouseDown(e, "start")}
                  >
                    <div className="bg-primary h-3 w-1 rounded-full"></div>
                  </div>

                  {/* End handle */}
                  <div
                    className="border-phosphor bg-background absolute top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 shadow active:cursor-grabbing"
                    style={{ left: `${sliderValues.end}%` }}
                    onMouseDown={(e) => handleMouseDown(e, "end")}
                  >
                    <div className="bg-primary h-3 w-1 rounded-full"></div>
                  </div>
                </div>
              </div>

              {/* Position controls */}
              <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">Start:</span>
                  <Input
                    value={startPosition}
                    onChange={(e) => onStartPositionChange(e.target.value)}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="border-border/50 h-7 w-full text-xs sm:w-28"
                  />
                </div>
                <Button
                  size="sm"
                  disabled={isLoading}
                  onClick={onSequenceLoadRequest}
                  className="h-7 w-full cursor-pointer text-xs sm:w-auto"
                >
                  {isLoading ? "Loading..." : "Load sequence"}
                </Button>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">End:</span>
                  <Input
                    value={endPosition}
                    onChange={(e) => onEndPositionChange(e.target.value)}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="border-border/50 h-7 w-full text-xs sm:w-28"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="text-muted-foreground mb-2 flex items-center justify-between text-xs opacity-80">
          <span>
            {geneDetail?.genomicinfo?.[0]?.strand === "+"
              ? "Forward strand (5' -> 3')"
              : geneDetail?.genomicinfo?.[0]?.strand === "-"
                ? "Reverse strand (3' <- 5')"
                : "Strand information not available"}
          </span>
          <span>
            Maximum window size: {maxViewRange.toLocaleString()} bp
          </span>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="border-border/40 bg-muted/50 rounded-md border p-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="border-muted-foreground border-t-phosphor h-5 w-5 animate-spin rounded-full border-2"></div>
            </div>
          ) : sequenceLines.length ? (
            <div
              ref={scrollContainerRef}
              className="h-64 overflow-x-auto overflow-y-auto"
            >
              <div
                style={{ height: totalVirtualHeight, position: "relative" }}
                className="font-mono text-xs leading-relaxed"
              >
                <div
                  style={{ transform: `translateY(${translateY}px)` }}
                  className="absolute top-0 right-0 left-0"
                >
                  {visibleLines.map((line) => (
                    <div key={line.startPos} className="flex whitespace-nowrap">
                      <div className="text-muted-foreground mr-2 w-20 text-right text-[11px] select-none">
                        {line.startPos.toLocaleString()}
                      </div>
                      <div className="flex-1 tracking-wide">
                        {Array.from(line.chunk).map((nucleotide, idx) => {
                          const nucleotidePosition = line.startPos + idx;
                          const color = getNucleotideColorClass(nucleotide);
                          return (
                            <span
                              key={`${line.startPos}-${idx}`}
                              onClick={() =>
                                onSequenceClick(nucleotidePosition, nucleotide)
                              }
                              onMouseEnter={(e) => {
                                setHoverPosition(nucleotidePosition);
                                setMousePosition({
                                  x: e.clientX,
                                  y: e.clientY,
                                });
                              }}
                              onMouseLeave={() => {
                                setHoverPosition(null);
                                setMousePosition(null);
                              }}
                              className={`${color} group relative cursor-pointer`}
                            >
                              {nucleotide}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-center text-sm">
              {error ? "Error loading sequence" : "No sequence data loaded."}
            </p>
          )}
        </div>

        {hoverPosition !== null && mousePosition !== null && (
          <div
            className="bg-popover border-border/50 pointer-events-none fixed z-50 rounded border px-2 py-1 text-xs text-popover-foreground shadow-md"
            style={{
              top: mousePosition.y - 30,
              left: mousePosition.x,
              transform: "translateX(-50%)",
            }}
          >
            Position: {hoverPosition.toLocaleString()}
          </div>
        )}

        <div className="text-muted-foreground mt-3 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-red-500"></div>
            <span>A</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-blue-500"></div>
            <span>T</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-green-500"></div>
            <span>G</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-amber-500"></div>
            <span>C</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
