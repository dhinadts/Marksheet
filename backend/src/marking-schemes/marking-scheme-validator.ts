import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateMarkingSchemeVersionDto } from './marking-scheme.dto';

export interface PaperQuestionShape {
  id: string;
  code: string;
  groupCode: string;
  parts: Array<{ id: string; code: string }>;
}

@Injectable()
export class MarkingSchemeValidator {
  validate(
    dto: CreateMarkingSchemeVersionDto,
    questions: PaperQuestionShape[],
  ): void {
    const errors: string[] = [];
    const keySet = new Set(dto.items.map((item) => item.clientKey));
    if (keySet.size !== dto.items.length)
      errors.push('clientKey values must be unique');
    if (
      new Set(dto.items.map((item) => item.displayOrder)).size !==
      dto.items.length
    )
      errors.push('displayOrder values must be unique');

    const thresholds = Object.entries(dto.confidenceThresholds);
    if (
      !thresholds.length ||
      thresholds.some(
        ([, value]) =>
          typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value < 0 ||
          value > 1,
      )
    )
      errors.push(
        'confidence thresholds must be a non-empty map of numbers from 0 to 1',
      );

    const questionMap = new Map(
      questions.map((question) => [question.id, question]),
    );
    for (const item of dto.items) {
      const question = questionMap.get(item.questionId);
      if (!question) {
        errors.push(
          `${item.clientKey} references a question outside the selected paper version`,
        );
        continue;
      }
      if (item.groupCode !== question.groupCode)
        errors.push(`${item.clientKey} groupCode must match ${question.code}`);
      if (
        item.questionPartId &&
        !question.parts.some((part) => part.id === item.questionPartId)
      )
        errors.push(
          `${item.clientKey} references a part outside ${question.code}`,
        );
      if (item.parentClientKey && !keySet.has(item.parentClientKey))
        errors.push(`${item.clientKey} has an unknown parentClientKey`);
      if ((item.isScorable ?? true) && item.maximumMark <= 0)
        errors.push(`${item.clientKey} must have a positive maximumMark`);
    }

    for (const question of questions) {
      const questionItems = dto.items.filter(
        (item) => item.questionId === question.id,
      );
      const roots = questionItems.filter(
        (item) => !item.parentClientKey && !item.questionPartId,
      );
      if (roots.length !== 1) {
        errors.push(`${question.code} must have exactly one root item`);
        continue;
      }
      const root = roots[0];
      if (!question.parts.length) {
        if (!(root.isScorable ?? true))
          errors.push(`${question.code} without parts must be scorable`);
        if (questionItems.length !== 1)
          errors.push(`${question.code} without parts cannot have child items`);
        continue;
      }
      if (root.isScorable ?? true)
        errors.push(`${question.code} with parts must use a non-scorable root`);
      const children = questionItems.filter(
        (item) => item.parentClientKey === root.clientKey,
      );
      for (const part of question.parts) {
        if (
          children.filter((item) => item.questionPartId === part.id).length !==
          1
        )
          errors.push(
            `${question.code}.${part.code} must have exactly one scorable item`,
          );
      }
      if (children.some((item) => !(item.isScorable ?? true)))
        errors.push(`${question.code} part items must be scorable`);
      const childTotal = children.reduce(
        (sum, item) => sum + item.maximumMark,
        0,
      );
      if (!this.equal(childTotal, root.maximumMark))
        errors.push(
          `${question.code} part maximums must total ${root.maximumMark}`,
        );
    }

    const rootTotal = dto.items
      .filter((item) => !item.parentClientKey && !item.questionPartId)
      .reduce((sum, item) => sum + item.maximumMark, 0);
    if (!this.equal(rootTotal, dto.maximumMark))
      errors.push(
        `question maximums total ${rootTotal}, expected ${dto.maximumMark}`,
      );
    if (errors.length)
      throw new BadRequestException({
        message: 'Invalid marking scheme',
        errors,
      });
  }

  private equal(left: number, right: number): boolean {
    return Math.abs(left - right) < 0.005;
  }
}
