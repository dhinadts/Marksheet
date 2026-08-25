import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccessClaims } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PageQueryDto, pageResult } from '../common/dto/page-query.dto';
import { UpdateStatusDto } from '../common/dto/update-status.dto';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../database/tenant-context.service';
import { CatalogRecordDto } from './catalog.dto';
import { CsvValidationDto } from './catalog.dto';

type Delegate = {
  findMany(args: Record<string, unknown>): Promise<unknown[]>;
  count(args: Record<string, unknown>): Promise<number>;
  findFirst(
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null>;
  create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
};
type Config = {
  model: string;
  fields: readonly string[];
  required: readonly string[];
  parents: Readonly<Record<string, string>>;
  search: readonly string[];
};

const configs: Readonly<Record<string, Config>> = {
  professors: {
    model: 'user',
    fields: ['username', 'email', 'displayName'],
    required: ['username', 'email', 'displayName'],
    parents: {},
    search: ['username', 'email', 'displayName'],
  },
  universities: {
    model: 'university',
    fields: ['code', 'name'],
    required: ['code', 'name'],
    parents: {},
    search: ['code', 'name'],
  },
  colleges: {
    model: 'college',
    fields: ['universityId', 'code', 'name'],
    required: ['universityId', 'code', 'name'],
    parents: { universityId: 'university' },
    search: ['code', 'name'],
  },
  departments: {
    model: 'department',
    fields: ['collegeId', 'code', 'name'],
    required: ['collegeId', 'code', 'name'],
    parents: { collegeId: 'college' },
    search: ['code', 'name'],
  },
  programs: {
    model: 'program',
    fields: ['departmentId', 'code', 'name'],
    required: ['departmentId', 'code', 'name'],
    parents: { departmentId: 'department' },
    search: ['code', 'name'],
  },
  'academic-years': {
    model: 'academicYear',
    fields: ['code', 'startsOn', 'endsOn'],
    required: ['code', 'startsOn', 'endsOn'],
    parents: {},
    search: ['code', 'name'],
  },
  'study-years': {
    model: 'studyYear',
    fields: ['ordinal', 'displayName'],
    required: ['ordinal', 'displayName'],
    parents: {},
    search: ['displayName'],
  },
  semesters: {
    model: 'semester',
    fields: ['academicYearId', 'ordinal', 'displayName'],
    required: ['academicYearId', 'ordinal', 'displayName'],
    parents: { academicYearId: 'academicYear' },
    search: ['displayName'],
  },
  classes: {
    model: 'academicClass',
    fields: [
      'programId',
      'academicYearId',
      'studyYearId',
      'semesterId',
      'code',
      'name',
    ],
    required: [
      'programId',
      'academicYearId',
      'studyYearId',
      'semesterId',
      'code',
      'name',
    ],
    parents: {
      programId: 'program',
      academicYearId: 'academicYear',
      studyYearId: 'studyYear',
      semesterId: 'semester',
    },
    search: ['code', 'name'],
  },
  sections: {
    model: 'section',
    fields: ['classId', 'code', 'name'],
    required: ['classId', 'code', 'name'],
    parents: { classId: 'academicClass' },
    search: ['code', 'name'],
  },
  students: {
    model: 'student',
    fields: [
      'departmentId',
      'programId',
      'sectionId',
      'registerNumber',
      'fullName',
      'email',
    ],
    required: [
      'departmentId',
      'programId',
      'sectionId',
      'registerNumber',
      'fullName',
    ],
    parents: {
      departmentId: 'department',
      programId: 'program',
      sectionId: 'section',
    },
    search: ['registerNumber', 'fullName', 'email'],
  },
  subjects: {
    model: 'subject',
    fields: ['departmentId', 'code', 'name', 'isElective'],
    required: ['departmentId', 'code', 'name'],
    parents: { departmentId: 'department' },
    search: ['code', 'name'],
  },
  'subject-offerings': {
    model: 'subjectOffering',
    fields: [
      'subjectId',
      'programId',
      'academicYearId',
      'semesterId',
      'sectionId',
    ],
    required: [
      'subjectId',
      'programId',
      'academicYearId',
      'semesterId',
      'sectionId',
    ],
    parents: {
      subjectId: 'subject',
      programId: 'program',
      academicYearId: 'academicYear',
      semesterId: 'semester',
      sectionId: 'section',
    },
    search: [],
  },
  'department-academic-years': {
    model: 'departmentAcademicYear',
    fields: ['departmentId', 'academicYearId'],
    required: ['departmentId', 'academicYearId'],
    parents: { departmentId: 'department', academicYearId: 'academicYear' },
    search: [],
  },
  'professor-subject-assignments': {
    model: 'professorSubjectAssignment',
    fields: ['professorId', 'subjectOfferingId'],
    required: ['professorId', 'subjectOfferingId'],
    parents: { professorId: 'user', subjectOfferingId: 'subjectOffering' },
    search: [],
  },
};

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  private config(resource: string): Config {
    const value = configs[resource];
    if (!value) throw new NotFoundException('Unknown catalog resource');
    return value;
  }
  private delegate(client: Prisma.TransactionClient, model: string): Delegate {
    return (client as unknown as Record<string, Delegate>)[model];
  }
  private data(dto: CatalogRecordDto, config: Config): Record<string, unknown> {
    return Object.fromEntries(
      config.fields
        .filter((key) => dto[key as keyof CatalogRecordDto] !== undefined)
        .map((key) => {
          const value = dto[key as keyof CatalogRecordDto];
          return [
            key,
            key === 'startsOn' || key === 'endsOn'
              ? new Date(value as string)
              : value,
          ];
        }),
    );
  }
  private async parents(
    tx: Prisma.TransactionClient,
    tenantId: string,
    config: Config,
    data: Record<string, unknown>,
  ) {
    for (const [field, model] of Object.entries(config.parents)) {
      if (data[field] === undefined) continue;
      const found = await this.delegate(tx, model).findFirst({
        where: { id: data[field], tenantId },
      });
      if (!found)
        throw new BadRequestException(
          `${field} does not reference a record in this tenant`,
        );
    }
  }

  list(resource: string, query: PageQueryDto, actor: AccessClaims) {
    const config = this.config(resource);
    return this.tenant.transaction(this.prisma, async (tx) => {
      const where: Record<string, unknown> = { tenantId: actor.tenantId };
      if (query.status) where.status = query.status;
      if (query.search && config.search.length)
        where.OR = config.search.map((field) => ({
          [field]: { contains: query.search, mode: 'insensitive' },
        }));
      const delegate = this.delegate(tx, config.model);
      const [items, total] = await Promise.all([
        delegate.findMany({
          where,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: { createdAt: 'desc' },
        }),
        delegate.count({ where }),
      ]);
      return pageResult(items, total, query);
    });
  }

  create(resource: string, dto: CatalogRecordDto, actor: AccessClaims) {
    const config = this.config(resource);
    const data = this.data(dto, config);
    const missing = config.required.filter((key) => data[key] === undefined);
    if (missing.length)
      throw new BadRequestException(`Missing fields: ${missing.join(', ')}`);
    return this.tenant.transaction(this.prisma, async (tx) => {
      await this.parents(tx, actor.tenantId, config, data);
      const created = await this.delegate(tx, config.model).create({
        data: { ...data, tenantId: actor.tenantId },
      });
      await this.audit.record(
        tx,
        actor,
        'CREATE',
        config.model,
        String(created.id),
        undefined,
        created as Prisma.InputJsonObject,
      );
      return created;
    });
  }

  update(
    resource: string,
    id: string,
    dto: CatalogRecordDto,
    actor: AccessClaims,
  ) {
    const config = this.config(resource);
    const data = this.data(dto, config);
    if (!dto.expectedUpdatedAt)
      throw new BadRequestException('expectedUpdatedAt is required');
    return this.tenant.transaction(this.prisma, async (tx) => {
      const delegate = this.delegate(tx, config.model);
      const existing = await delegate.findFirst({
        where: { id, tenantId: actor.tenantId },
      });
      if (!existing) throw new NotFoundException();
      await this.parents(tx, actor.tenantId, config, data);
      const result = await delegate.updateMany({
        where: {
          id,
          tenantId: actor.tenantId,
          updatedAt: new Date(dto.expectedUpdatedAt!),
        },
        data,
      });
      if (!result.count)
        throw new ConflictException('Record changed; reload and retry');
      const updated = await delegate.findFirst({
        where: { id, tenantId: actor.tenantId },
      });
      await this.audit.record(
        tx,
        actor,
        'UPDATE',
        config.model,
        id,
        existing as Prisma.InputJsonObject,
        updated as Prisma.InputJsonObject,
      );
      return updated;
    });
  }

  status(
    resource: string,
    id: string,
    dto: UpdateStatusDto,
    actor: AccessClaims,
  ) {
    const config = this.config(resource);
    return this.tenant.transaction(this.prisma, async (tx) => {
      const delegate = this.delegate(tx, config.model);
      const existing = await delegate.findFirst({
        where: { id, tenantId: actor.tenantId },
      });
      if (!existing) throw new NotFoundException();
      const result = await delegate.updateMany({
        where: {
          id,
          tenantId: actor.tenantId,
          updatedAt: new Date(dto.expectedUpdatedAt),
        },
        data: { status: dto.status },
      });
      if (!result.count)
        throw new ConflictException('Record changed; reload and retry');
      const updated = await delegate.findFirst({
        where: { id, tenantId: actor.tenantId },
      });
      await this.audit.record(
        tx,
        actor,
        'STATUS_CHANGE',
        config.model,
        id,
        existing as Prisma.InputJsonObject,
        updated as Prisma.InputJsonObject,
      );
      return updated;
    });
  }

  validateStudentCsv(dto: CsvValidationDto, actor: AccessClaims) {
    const lines = dto.csv.trim().split(/\r?\n/);
    if (lines.length < 2)
      throw new BadRequestException(
        'CSV must contain a header and at least one row',
      );
    const headers = lines[0].split(',').map((value) => value.trim());
    const required = [
      'registerNumber',
      'fullName',
      'departmentId',
      'programId',
      'sectionId',
    ];
    const missing = required.filter((header) => !headers.includes(header));
    if (missing.length)
      throw new BadRequestException(
        `Missing CSV columns: ${missing.join(', ')}`,
      );
    const rows = lines
      .slice(1)
      .filter(Boolean)
      .map((line, index) => {
        const values = line.split(',').map((value) => value.trim());
        const record = Object.fromEntries(
          headers.map((header, column) => [header, values[column] ?? '']),
        );
        return { row: index + 2, record };
      });
    return this.tenant.transaction(this.prisma, async (tx) => {
      const seen = new Set<string>();
      const results = [];
      for (const { row, record } of rows) {
        const errors: string[] = [];
        for (const field of required)
          if (!record[field]) errors.push(`${field} is required`);
        if (seen.has(record.registerNumber))
          errors.push('duplicate registerNumber in file');
        seen.add(record.registerNumber);
        for (const [field, model] of Object.entries(configs.students.parents)) {
          if (
            record[field] &&
            !(await this.delegate(tx, model).findFirst({
              where: { id: record[field], tenantId: actor.tenantId },
            }))
          )
            errors.push(`${field} is outside this tenant or does not exist`);
        }
        if (
          record.registerNumber &&
          (await tx.student.findFirst({
            where: {
              tenantId: actor.tenantId,
              registerNumber: record.registerNumber,
            },
          }))
        )
          errors.push('registerNumber already exists');
        results.push({ row, valid: errors.length === 0, errors, data: record });
      }
      return {
        valid: results.every((item) => item.valid),
        totalRows: results.length,
        validRows: results.filter((item) => item.valid).length,
        rows: results,
      };
    });
  }
}
