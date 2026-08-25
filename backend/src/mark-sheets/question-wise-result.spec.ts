import { toQuestionWiseResult } from './question-wise-result';

const item = (
  question: number,
  value: string | number | null,
  maximum = 2,
) => ({
  selectedMarkValue: null,
  extractedMark: {
    extractedValue: value,
    confidence: '0.9',
    extractionStatus: 'AUTO_ACCEPT',
    markingSchemeItem: {
      displayOrder: question,
      maximumMark: maximum.toString(),
      question: {
        number: question.toString(),
        code: `Q${question}`,
        label: `Question ${question}`,
      },
      questionPart: null,
    },
  },
});

describe('toQuestionWiseResult', () => {
  it('preserves zero and normalizes numeric strings', () => {
    const result = toQuestionWiseResult([item(1, 0), item(2, '2')]);
    expect(result.partA.questions.map((mark) => mark.obtained)).toEqual([0, 2]);
    expect(result.partA.obtainedTotal).toBe(2);
  });

  it('keeps a missing value null and does not manufacture a total', () => {
    const result = toQuestionWiseResult([item(1, null), item(11, '12', 13)]);
    expect(result.partA.questions[0].obtained).toBeNull();
    expect(result.partA.obtainedTotal).toBeNull();
    expect(result.grandTotal.obtained).toBeNull();
  });

  it('uses the configured Part B question total', () => {
    const result = toQuestionWiseResult([item(11, '12', 13)]);
    expect(result.partBC.questions[0]).toMatchObject({
      obtained: 12,
      maximum: 13,
    });
  });
});
