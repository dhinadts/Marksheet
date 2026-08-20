import { CalculationStatus, MarkSheetStatus } from '@prisma/client';
import { summarizeRows } from './report-projection';

describe('summarizeRows', () => {
  it('builds cards and hierarchical breakdowns without hard-coded organization IDs', () => {
    const result = summarizeRows([
      {
        status: MarkSheetStatus.COMPLETED,
        calculationStatus: CalculationStatus.READY_FOR_EXPORT,
        confidence: 0.9,
        dimensions: { department: { id: 'd1', name: 'CSE' } },
      },
      {
        status: MarkSheetStatus.REVIEW_REQUIRED,
        calculationStatus: CalculationStatus.TOTAL_MISMATCH,
        confidence: 0.7,
        dimensions: { department: { id: 'd1', name: 'CSE' } },
      },
    ]);
    expect(result.cards).toMatchObject({
      totalMarkSheets: 2,
      processed: 1,
      reviewRequired: 1,
      totalMismatch: 1,
    });
    expect(result.breakdowns.department).toEqual([
      { id: 'd1', name: 'CSE', total: 2, completed: 1 },
    ]);
    expect(result.confidence.average).toBeCloseTo(0.8);
  });
});
