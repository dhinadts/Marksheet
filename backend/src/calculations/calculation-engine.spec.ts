import { CalculationStatus } from '@prisma/client';
import { calculateMarks } from './calculation-engine';

describe('calculateMarks', () => {
  const item = (
    id: string,
    groupCode: string,
    maximumMark: number,
    value: number,
  ) => ({
    id,
    groupCode,
    maximumMark,
    isRequired: true,
    selectedMarkValueId: `value-${id}`,
    value,
  });

  it('calculates the configured 100-mark sample entirely from individual marks', () => {
    const inputs = [
      ...Array.from({ length: 10 }, (_, index) =>
        item(`q${index + 1}`, 'PART_A', 2, 2),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        item(`q${index + 11}`, 'PART_B_C', 13, 13),
      ),
      item('q16', 'PART_B_C', 15, 15),
    ];
    const result = calculateMarks(inputs, 100, 100);
    expect(result.groupTotals).toEqual({ PART_A: '20.00', PART_B_C: '80.00' });
    expect(result.grandTotal.toString()).toBe('100');
    expect(result.status).toBe(CalculationStatus.READY_FOR_EXPORT);
  });

  it('flags a handwritten total mismatch without adopting that total', () => {
    const result = calculateMarks([item('q1', 'A', 100, 86)], 100, 88);
    expect(result.grandTotal.toString()).toBe('86');
    expect(result.status).toBe(CalculationStatus.TOTAL_MISMATCH);
  });

  it('detects missing required and out-of-range individual marks', () => {
    expect(
      calculateMarks([{ ...item('q1', 'A', 2, 1), value: null }], 2).status,
    ).toBe(CalculationStatus.INCOMPLETE);
    expect(calculateMarks([item('q1', 'A', 2, 3)], 2).status).toBe(
      CalculationStatus.INVALID,
    );
  });

  it('produces a deterministic digest independent of input order', () => {
    const a = item('a', 'A', 2, 1);
    const b = item('b', 'A', 2, 2);
    expect(calculateMarks([a, b], 4).inputDigest).toBe(
      calculateMarks([b, a], 4).inputDigest,
    );
  });
});
