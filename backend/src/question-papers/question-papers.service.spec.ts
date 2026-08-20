import { BadRequestException } from '@nestjs/common';
import { QuestionPapersService } from './question-papers.service';

describe('QuestionPapersService', () => {
  const service = new QuestionPapersService(
    {} as never,
    {} as never,
    {} as never,
  );

  it('rejects duplicate question codes before persistence', () => {
    const question = {
      code: 'Q1',
      label: 'Question 1',
      groupCode: 'A',
      displayOrder: 1,
      parts: [],
    };
    expect(() =>
      service.createVersion(
        '00000000-0000-4000-8000-000000000001',
        { questions: [question, { ...question, displayOrder: 2 }] },
        {} as never,
      ),
    ).toThrow(BadRequestException);
  });

  it('supports arbitrary part counts and only rejects duplicate part ordering', () => {
    expect(() =>
      service.createVersion(
        '00000000-0000-4000-8000-000000000001',
        {
          questions: [
            {
              code: 'Q16',
              label: 'Question 16',
              groupCode: 'C',
              displayOrder: 16,
              parts: [
                { code: 'a', label: 'A', displayOrder: 1 },
                { code: 'b', label: 'B', displayOrder: 1 },
              ],
            },
          ],
        },
        {} as never,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects image-template cells that reference an unknown configured part', () => {
    expect(() =>
      service.createVersion(
        '00000000-0000-4000-8000-000000000001',
        {
          questions: [
            {
              code: 'Q11',
              label: 'Question 11',
              groupCode: 'B',
              displayOrder: 11,
              parts: [{ code: 'a', label: 'A', displayOrder: 1 }],
            },
          ],
          imageTemplate: {
            expectedAspectRatio: 0.75,
            aspectRatioTolerance: 0.1,
            cells: [
              {
                questionCode: 'Q11',
                questionPartCode: 'b',
                box: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
              },
            ],
          },
        },
        {} as never,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects normalized image-template cells extending outside the page', () => {
    expect(() =>
      service.createVersion(
        '00000000-0000-4000-8000-000000000001',
        {
          questions: [
            {
              code: 'Q1',
              label: 'Question 1',
              groupCode: 'A',
              displayOrder: 1,
              parts: [],
            },
          ],
          imageTemplate: {
            expectedAspectRatio: 0.75,
            aspectRatioTolerance: 0.1,
            cells: [
              {
                questionCode: 'Q1',
                box: { x: 0.9, y: 0.1, width: 0.2, height: 0.1 },
              },
            ],
          },
        },
        {} as never,
      ),
    ).toThrow(BadRequestException);
  });
});
