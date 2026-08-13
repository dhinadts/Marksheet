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
});
