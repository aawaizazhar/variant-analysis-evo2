export function getNucleotideColorClass(nucleotide: string): string {
  switch (nucleotide.toUpperCase()) {
    case "A":
      return "text-red-400";
    case "T":
      return "text-blue-400";
    case "G":
      return "text-green-400";
    case "C":
      return "text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

export function getClassificationColorClasses(classification: string): string {
  if (!classification) return "bg-amber-500/15 text-amber-400";
  const lowercaseClass = classification.toLowerCase();

  if (lowercaseClass.includes("pathogenic")) {
    return "bg-red-500/15 text-red-400";
  } else if (lowercaseClass.includes("benign")) {
    return "bg-green-500/15 text-green-400";
  } else {
    return "bg-amber-500/15 text-amber-400";
  }
}
