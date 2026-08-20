import { createHash } from 'node:crypto';
import { CalculationStatus, Prisma } from '@prisma/client';

export interface CalculationInputItem {
  id: string;
  groupCode: string;
  maximumMark: Prisma.Decimal.Value;
  isRequired: boolean;
  selectedMarkValueId?: string | null;
  value?: Prisma.Decimal.Value | null;
}

export interface CalculationOutput {
  groupTotals: Record<string, string>;
  grandTotal: Prisma.Decimal;
  maximumMark: Prisma.Decimal;
  percentage: Prisma.Decimal;
  handwrittenTotal: Prisma.Decimal | null;
  status: CalculationStatus;
  inputDigest: string;
}

export function calculateMarks(
  items: CalculationInputItem[],
  configuredMaximum: Prisma.Decimal.Value,
  handwrittenTotal?: Prisma.Decimal.Value | null,
): CalculationOutput {
  const maximumMark = new Prisma.Decimal(configuredMaximum);
  const handwritten =
    handwrittenTotal === undefined || handwrittenTotal === null
      ? null
      : new Prisma.Decimal(handwrittenTotal);
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const groupDecimals = new Map<string, Prisma.Decimal>();
  let grandTotal = new Prisma.Decimal(0);
  let incomplete = false;
  let invalid = maximumMark.lessThanOrEqualTo(0);

  for (const item of sorted) {
    if (item.value === undefined || item.value === null) {
      incomplete ||= item.isRequired;
      continue;
    }
    const value = new Prisma.Decimal(item.value);
    const itemMaximum = new Prisma.Decimal(item.maximumMark);
    invalid ||= value.lessThan(0) || value.greaterThan(itemMaximum);
    grandTotal = grandTotal.plus(value);
    groupDecimals.set(
      item.groupCode,
      (groupDecimals.get(item.groupCode) ?? new Prisma.Decimal(0)).plus(value),
    );
  }

  const status = invalid
    ? CalculationStatus.INVALID
    : incomplete
      ? CalculationStatus.INCOMPLETE
      : handwritten !== null && !handwritten.equals(grandTotal)
        ? CalculationStatus.TOTAL_MISMATCH
        : CalculationStatus.READY_FOR_EXPORT;
  const canonical = JSON.stringify({
    configuredMaximum: maximumMark.toFixed(2),
    handwrittenTotal: handwritten?.toFixed(2) ?? null,
    items: sorted.map((item) => ({
      id: item.id,
      selectedMarkValueId: item.selectedMarkValueId ?? null,
      value:
        item.value === undefined || item.value === null
          ? null
          : new Prisma.Decimal(item.value).toFixed(2),
    })),
  });

  return {
    groupTotals: Object.fromEntries(
      [...groupDecimals.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([group, total]) => [group, total.toFixed(2)]),
    ),
    grandTotal,
    maximumMark,
    percentage: maximumMark.greaterThan(0)
      ? grandTotal.dividedBy(maximumMark).times(100)
      : new Prisma.Decimal(0),
    handwrittenTotal: handwritten,
    status,
    inputDigest: createHash('sha256').update(canonical).digest('hex'),
  };
}
