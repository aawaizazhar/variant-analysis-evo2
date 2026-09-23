"use client";

import { useState } from "react";

const previewViews = [
  {
    id: "variant",
    label: "Variant explorer",
    eyebrow: "ClinVar context",
    title: "Start with the variant, not a blank prompt.",
    description:
      "Move from a gene to a reviewable variant record while keeping its coordinates and clinical significance visible.",
  },
  {
    id: "prediction",
    label: "Evo2 prediction",
    eyebrow: "Model output",
    title: "Inspect the signal without hiding uncertainty.",
    description:
      "Prediction, confidence, and model context are presented as research evidence rather than a clinical conclusion.",
  },
  {
    id: "evidence",
    label: "Evidence view",
    eyebrow: "Qualified interpretation",
    title: "See what supports the next research step.",
    description:
      "Curated evidence and eligible disease hypotheses remain visually separate from the computational prediction.",
  },
] as const;

type PreviewId = (typeof previewViews)[number]["id"];

export function ProductPreview() {
  const [activeId, setActiveId] = useState<PreviewId>("variant");
  const activeIndex = previewViews.findIndex((view) => view.id === activeId);
  const active = previewViews[activeIndex] ?? previewViews[0];

  return (
    <div className="product-preview-shell">
      <div className="border-border/70 flex items-center justify-between border-b px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2" aria-hidden="true">
          <span className="bg-border h-2 w-2 rounded-full" />
          <span className="bg-border h-2 w-2 rounded-full" />
          <span className="bg-phosphor/70 h-2 w-2 rounded-full" />
        </div>
        <span className="text-muted-foreground font-mono text-[10px] tracking-[0.18em] uppercase">
          Product preview
        </span>
      </div>

      <div className="grid min-h-[27rem] lg:grid-cols-[10rem_1fr]">
        <div
          className="border-border/70 flex gap-2 overflow-x-auto border-b p-3 lg:flex-col lg:border-r lg:border-b-0"
          role="tablist"
          aria-label="Product preview views"
        >
          {previewViews.map((view, index) => {
            const selected = view.id === activeId;
            return (
              <button
                key={view.id}
                id={`preview-tab-${view.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`preview-panel-${view.id}`}
                onClick={() => setActiveId(view.id)}
                className={`product-preview-tab group ${selected ? "product-preview-tab-active" : ""}`}
              >
                <span className="text-muted-foreground group-hover:text-phosphor font-mono text-[10px] transition-colors">
                  0{index + 1}
                </span>
                <span className="text-xs font-medium whitespace-nowrap lg:text-left lg:whitespace-normal">
                  {view.label}
                </span>
              </button>
            );
          })}
        </div>

        <div
          key={active.id}
          id={`preview-panel-${active.id}`}
          role="tabpanel"
          aria-labelledby={`preview-tab-${active.id}`}
          className="product-preview-panel p-4 sm:p-6"
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-phosphor font-mono text-[10px] tracking-[0.18em] uppercase">
                {active.eyebrow}
              </p>
              <p className="mt-2 max-w-sm text-sm leading-snug font-medium">
                {active.title}
              </p>
            </div>
            <span className="border-phosphor/25 bg-phosphor/8 text-phosphor shrink-0 rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase">
              Research
            </span>
          </div>

          <div className="border-border/70 bg-background/75 relative min-h-56 overflow-hidden rounded-xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-5">
            <div className="product-preview-grid" aria-hidden="true" />
            {active.id === "variant" && <VariantExplorerPreview />}
            {active.id === "prediction" && <PredictionPreview />}
            {active.id === "evidence" && <EvidencePreview />}
          </div>

          <p className="text-muted-foreground mt-4 max-w-lg text-xs leading-relaxed">
            {active.description}
          </p>
        </div>
      </div>

      <div className="border-border/70 flex items-center justify-between gap-4 border-t px-4 py-3 sm:px-5">
        <p className="text-muted-foreground text-[10px] leading-relaxed">
          Illustrative interface preview. Not a clinical result.
        </p>
        <div className="flex gap-1.5" aria-hidden="true">
          {previewViews.map((view) => (
            <span
              key={view.id}
              className={`h-1 rounded-full transition-[width,background-color] duration-300 ${
                view.id === activeId ? "bg-phosphor w-5" : "bg-border w-1.5"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function VariantExplorerPreview() {
  return (
    <div className="relative space-y-3">
      <div className="border-border/70 bg-card/90 flex items-center justify-between rounded-lg border px-3 py-2.5">
        <div>
          <p className="text-muted-foreground font-mono text-[9px] tracking-wider uppercase">
            Selected gene
          </p>
          <p className="mt-1 text-sm font-semibold">BRCA1</p>
        </div>
        <p className="text-muted-foreground font-mono text-[10px]">chr17</p>
      </div>
      <div className="border-phosphor/25 bg-card/95 rounded-lg border p-3 transition-transform duration-300 hover:-translate-y-0.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-foreground font-mono text-[10px] font-medium">
              NM_007294.4:c.3306T&gt;A
            </p>
            <p className="text-muted-foreground mt-1 text-[10px]">
              Position 43,092,225
            </p>
          </div>
          <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[9px] font-medium text-amber-600 dark:text-amber-300">
            Uncertain
          </span>
        </div>
        <div
          className="mt-4 grid grid-cols-10 gap-1.5"
          aria-label="DNA sequence preview"
        >
          {"ACTGTAGCTA".split("").map((base, index) => (
            <span
              key={`${base}-${index}`}
              className={`flex h-6 min-w-0 items-center justify-center rounded font-mono text-[9px] ${
                index === 5
                  ? "bg-phosphor text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {base}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PredictionPreview() {
  return (
    <div className="relative grid gap-3 sm:grid-cols-[1fr_0.72fr]">
      <div className="border-border/70 bg-card/95 rounded-lg border p-4">
        <p className="text-muted-foreground font-mono text-[9px] tracking-wider uppercase">
          Evo2 assessment
        </p>
        <div className="mt-6 flex items-end gap-2">
          <span className="text-3xl font-semibold tracking-tight">VUS</span>
          <span className="text-muted-foreground pb-1 text-xs">uncertain</span>
        </div>
        <div className="bg-muted mt-6 h-1.5 overflow-hidden rounded-full">
          <div className="product-preview-meter bg-phosphor h-full w-[58%] rounded-full" />
        </div>
        <div className="text-muted-foreground mt-2 flex justify-between font-mono text-[9px]">
          <span>benign</span>
          <span>pathogenic</span>
        </div>
      </div>
      <div className="grid gap-3">
        <PreviewMetric label="Model signal" value="0.58" />
        <PreviewMetric label="Evidence state" value="Review" />
      </div>
    </div>
  );
}

function EvidencePreview() {
  const rows = [
    ["Curated record", "Available"],
    ["Model prediction", "Uncertain"],
    ["Disease ranking", "Opt-in"],
  ];

  return (
    <div className="border-border/70 bg-card/95 relative rounded-lg border">
      {rows.map(([label, value], index) => (
        <div
          key={label}
          className="border-border/60 flex items-center justify-between gap-4 border-b px-4 py-3 last:border-b-0"
          style={{ animationDelay: `${index * 70}ms` }}
        >
          <div className="flex items-center gap-3">
            <span className="border-phosphor/25 bg-phosphor/8 text-phosphor flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[9px]">
              {index + 1}
            </span>
            <span className="text-xs font-medium">{label}</span>
          </div>
          <span className="text-muted-foreground font-mono text-[9px] uppercase">
            {value}
          </span>
        </div>
      ))}
      <div className="border-border/60 bg-muted/35 text-muted-foreground border-t px-4 py-3 text-[10px] leading-relaxed">
        Sources remain distinct so a hypothesis is never presented as a
        diagnosis.
      </div>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/70 bg-card/95 rounded-lg border p-3 transition-transform duration-300 hover:-translate-y-0.5">
      <p className="text-muted-foreground font-mono text-[8px] tracking-wider uppercase">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}
