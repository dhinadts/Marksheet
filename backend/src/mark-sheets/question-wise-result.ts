type NumericValue = { toString(): string } | string | number | null | undefined;

export interface QuestionMarkResult {
  question: number;
  label: string;
  obtained: number | null;
  maximum: number;
  confidence: number | null;
  status: 'accepted' | 'warning' | 'needs_review';
  displayOrder: number;
}

interface ResultPart {
  questions: QuestionMarkResult[];
  obtainedTotal: number | null;
  maximumTotal: number;
}

export interface QuestionWiseResult {
  partA: ResultPart;
  partBC: ResultPart;
  grandTotal: { obtained: number | null; maximum: number };
}

interface ReviewItemShape {
  selectedMarkValue?: { value?: NumericValue } | null;
  extractedMark: {
    extractedValue?: NumericValue;
    confidence?: NumericValue;
    extractionStatus?: string;
    verificationStatus?: string;
    markingSchemeItem: {
      displayOrder?: number;
      maximumMark: NumericValue;
      question?: {
        number?: NumericValue;
        code?: string;
        label?: string;
      } | null;
      questionPart?: { label?: string } | null;
    };
  };
}

function finite(value: NumericValue): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : null;
}

function part(questions: QuestionMarkResult[]): ResultPart {
  const complete =
    questions.length > 0 && questions.every((item) => item.obtained !== null);
  return {
    questions,
    obtainedTotal: complete
      ? questions.reduce((sum, item) => sum + item.obtained!, 0)
      : null,
    maximumTotal: questions.reduce((sum, item) => sum + item.maximum, 0),
  };
}

export function toQuestionWiseResult(
  items: ReviewItemShape[],
): QuestionWiseResult {
  const questions = items
    .map((item): QuestionMarkResult | null => {
      const extracted = item.extractedMark;
      const scheme = extracted.markingSchemeItem;
      const question = scheme.question;
      const number =
        finite(question?.number) ?? finite(question?.code?.replace(/^Q/i, ''));
      if (number === null) return null;
      const obtained = finite(
        item.selectedMarkValue?.value ?? extracted.extractedValue,
      );
      const rawStatus =
        extracted.verificationStatus ?? extracted.extractionStatus ?? '';
      const status =
        rawStatus === 'VERIFIED' || rawStatus === 'AUTO_ACCEPT'
          ? 'accepted'
          : obtained === null
            ? 'needs_review'
            : 'warning';
      const baseLabel =
        question?.label ?? question?.code ?? `Question ${number}`;
      return {
        question: number,
        label: scheme.questionPart?.label
          ? `${baseLabel} ${scheme.questionPart.label}`
          : baseLabel,
        obtained,
        maximum: finite(scheme.maximumMark) ?? 0,
        confidence: finite(extracted.confidence),
        status,
        displayOrder: scheme.displayOrder ?? number,
      };
    })
    .filter((item): item is QuestionMarkResult => item !== null)
    .sort((left, right) => left.displayOrder - right.displayOrder);
  const partA = part(questions.filter((item) => item.question <= 10));
  const partBC = part(questions.filter((item) => item.question >= 11));
  return {
    partA,
    partBC,
    grandTotal: {
      obtained:
        partA.obtainedTotal === null || partBC.obtainedTotal === null
          ? null
          : partA.obtainedTotal + partBC.obtainedTotal,
      maximum: partA.maximumTotal + partBC.maximumTotal,
    },
  };
}
