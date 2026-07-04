"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "~/components/ui/button";

const EXPORT_ENDPOINT = "/api/export/predictions";

function fallbackFilename() {
  const date = new Date().toISOString().slice(0, 10);

  return `dna-analyzer-prediction-history-${date}.csv`;
}

function getFilename(contentDisposition: string | null) {
  if (!contentDisposition) {
    return fallbackFilename();
  }

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  const asciiMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
  const filename = utf8Match?.[1] ?? asciiMatch?.[1];

  if (!filename) {
    return fallbackFilename();
  }

  try {
    return decodeURIComponent(filename);
  } catch {
    return filename;
  }
}

export function ExportPredictionsButton() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch(EXPORT_ENDPOINT, {
        credentials: "same-origin",
      });

      if (!response.ok) {
        setError(
          response.status === 401
            ? "Please sign in again before exporting."
            : response.status === 403
              ? "CSV export is available on the Researcher demo plan."
            : "Export failed. Please try again.",
        );
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = getFilename(response.headers.get("Content-Disposition"));
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed. Check your connection and try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="active:scale-[0.98]"
        onClick={handleExport}
        disabled={isExporting}
      >
        {isExporting ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Download aria-hidden="true" />
        )}
        {isExporting ? "Exporting..." : "Export CSV"}
      </Button>

      {error ? (
        <p className="text-sm text-red-400" aria-live="polite">
          {error}
        </p>
      ) : null}
    </div>
  );
}
