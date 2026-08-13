import { BadRequestException } from '@nestjs/common';
import { CreateMarkingSchemeVersionDto } from './marking-scheme.dto';
import {
  MarkingSchemeValidator,
  PaperQuestionShape,
} from './marking-scheme-validator';

describe('MarkingSchemeValidator', () => {
  const validator = new MarkingSchemeValidator();
  const questions: PaperQuestionShape[] = [
    {
      id: '00000000-0000-4000-8000-000000000001',
      code: 'SHORT',
      groupCode: 'A',
      parts: [],
    },
    {
      id: '00000000-0000-4000-8000-000000000002',
      code: 'LONG',
      groupCode: 'B',
      parts: [
        { id: '00000000-0000-4000-8000-000000000003', code: 'alpha' },
        { id: '00000000-0000-4000-8000-000000000004', code: 'beta' },
        { id: '00000000-0000-4000-8000-000000000005', code: 'gamma' },
      ],
    },
  ];
  const valid: CreateMarkingSchemeVersionDto = {
    questionPaperVersionId: '00000000-0000-4000-8000-000000000099',
    maximumMark: 17,
    confidenceThresholds: { high: 0.9, manual: 0.5 },
    items: [
      {
        clientKey: 'short',
        questionId: questions[0].id,
        groupCode: 'A',
        displayOrder: 1,
        maximumMark: 2,
      },
      {
        clientKey: 'long',
        questionId: questions[1].id,
        groupCode: 'B',
        displayOrder: 2,
        maximumMark: 15,
        isScorable: false,
      },
      ...questions[1].parts.map((part, index) => ({
        clientKey: part.code,
        parentClientKey: 'long',
        questionId: questions[1].id,
        questionPartId: part.id,
        groupCode: 'B',
        displayOrder: index + 3,
        maximumMark: 5,
      })),
    ],
  };

  it('accepts administrator-defined question codes, thresholds, and arbitrary part counts', () => {
    expect(() => validator.validate(valid, questions)).not.toThrow();
  });

  it('rejects totals that do not derive from individual configured maximums', () => {
    expect(() =>
      validator.validate({ ...valid, maximumMark: 18 }, questions),
    ).toThrow(BadRequestException);
  });

  it('rejects a part assigned to another question', () => {
    const items = valid.items.map((item) =>
      item.clientKey === 'alpha'
        ? { ...item, questionId: questions[0].id }
        : item,
    );
    expect(() => validator.validate({ ...valid, items }, questions)).toThrow(
      BadRequestException,
    );
  });
});
