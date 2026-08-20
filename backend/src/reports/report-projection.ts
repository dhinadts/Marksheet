import { CalculationStatus, MarkSheetStatus } from '@prisma/client';

export interface SummaryRow {
  status: MarkSheetStatus;
  calculationStatus?: CalculationStatus | null;
  confidence?: number | null;
  dimensions: Record<string, { id: string; name: string }>;
}

export function summarizeRows(rows: SummaryRow[]) {
  const count = (predicate: (row: SummaryRow) => boolean) =>
    rows.filter(predicate).length;
  const dimensions = Object.keys(rows[0]?.dimensions ?? {});
  const breakdowns = Object.fromEntries(
    dimensions.map((dimension) => {
      const buckets = new Map<
        string,
        { id: string; name: string; total: number; completed: number }
      >();
      for (const row of rows) {
        const value = row.dimensions[dimension];
        if (!value) continue;
        const bucket = buckets.get(value.id) ?? {
          ...value,
          total: 0,
          completed: 0,
        };
        bucket.total += 1;
        bucket.completed += row.status === MarkSheetStatus.COMPLETED ? 1 : 0;
        buckets.set(value.id, bucket);
      }
      return [
        dimension,
        [...buckets.values()].sort((a, b) => a.name.localeCompare(b.name)),
      ];
    }),
  );
  const confidences = rows
    .map((row) => row.confidence)
    .filter((value): value is number => value !== null && value !== undefined);
  return {
    cards: {
      totalMarkSheets: rows.length,
      processed: count((row) => row.status === MarkSheetStatus.COMPLETED),
      pending: count(
        (row) =>
          row.status === MarkSheetStatus.PENDING_UPLOAD ||
          row.status === MarkSheetStatus.UPLOADED,
      ),
      verified: count(
        (row) =>
          row.status === MarkSheetStatus.VERIFIED ||
          row.status === MarkSheetStatus.COMPLETED,
      ),
      reviewRequired: count(
        (row) => row.status === MarkSheetStatus.REVIEW_REQUIRED,
      ),
      totalMismatch: count(
        (row) => row.calculationStatus === CalculationStatus.TOTAL_MISMATCH,
      ),
      processingErrors: count((row) => row.status === MarkSheetStatus.FAILED),
    },
    confidence: {
      count: confidences.length,
      average: confidences.length
        ? confidences.reduce((sum, value) => sum + value, 0) /
          confidences.length
        : null,
    },
    breakdowns,
  };
}
