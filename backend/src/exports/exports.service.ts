import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExportStatus, FilePurpose, UploadStatus } from '@prisma/client';
import type { AccessClaims } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../database/tenant-context.service';
import { ReportsService } from '../reports/reports.service';
import { ObjectStorageService } from '../uploads/object-storage.service';
import { generateExport } from './export-formatters';
import { CreateExportDto } from './exports.dto';

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly reports: ReportsService,
    private readonly storage: ObjectStorageService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateExportDto, actor: AccessClaims) {
    const { format } = dto;
    const filterValues: [string, string | undefined][] = [
      ['universityId', dto.universityId],
      ['collegeId', dto.collegeId],
      ['departmentId', dto.departmentId],
      ['programId', dto.programId],
      ['academicYearId', dto.academicYearId],
      ['studyYearId', dto.studyYearId],
      ['semesterId', dto.semesterId],
      ['classId', dto.classId],
      ['sectionId', dto.sectionId],
      ['subjectId', dto.subjectId],
      ['subjectOfferingId', dto.subjectOfferingId],
      ['search', dto.search],
    ];
    const filters: Record<string, string> = {};
    for (const [key, value] of filterValues)
      if (value !== undefined) filters[key] = value;
    const record = await this.tenant.transaction(this.prisma, async (tx) => {
      const created = await tx.export.create({
        data: {
          tenantId: actor.tenantId,
          requestedById: actor.sub,
          format,
          filters,
          status: ExportStatus.PROCESSING,
        },
      });
      await this.audit.record(
        tx,
        actor,
        'EXPORT_REQUESTED',
        'export',
        created.id,
        undefined,
        { format, filters },
      );
      return created;
    });
    try {
      const rows = await this.reports.exportData(
        { ...dto, page: 1, pageSize: 100 },
        actor,
      );
      const generated = generateExport(format, rows);
      const fileId = randomUUID();
      const objectKey = `${actor.tenantId}/exports/${record.id}/${fileId}.${generated.extension}`;
      const checksum = await this.storage.putGenerated(
        objectKey,
        generated.mimeType,
        generated.body,
      );
      const expiresAt = this.expiry();
      const completed = await this.tenant.transaction(
        this.prisma,
        async (tx) => {
          const file = await tx.fileObject.create({
            data: {
              id: fileId,
              tenantId: actor.tenantId,
              purpose: FilePurpose.EXPORT,
              bucket: this.storage.bucketName,
              objectKey,
              mimeType: generated.mimeType,
              sizeBytes: BigInt(generated.body.length),
              checksumSha256: checksum,
              uploadStatus: UploadStatus.COMPLETED,
              uploadExpiresAt: expiresAt,
              uploadedAt: new Date(),
            },
          });
          const updated = await tx.export.update({
            where: { id: record.id },
            data: {
              fileObjectId: file.id,
              status: ExportStatus.COMPLETED,
              expiresAt,
              completedAt: new Date(),
            },
          });
          await this.audit.record(
            tx,
            actor,
            'EXPORT_COMPLETED',
            'export',
            record.id,
            { status: record.status },
            {
              status: updated.status,
              fileObjectId: file.id,
              rowCount: rows.length,
            },
          );
          return updated;
        },
      );
      return { ...completed, download: this.storage.signDownload(objectKey) };
    } catch (error) {
      await this.tenant.transaction(this.prisma, async (tx) => {
        await tx.export.updateMany({
          where: { id: record.id, tenantId: actor.tenantId },
          data: {
            status: ExportStatus.FAILED,
            errorMessage:
              error instanceof Error
                ? error.message.slice(0, 1000)
                : 'Export failed',
          },
        });
        await this.audit.record(
          tx,
          actor,
          'EXPORT_FAILED',
          'export',
          record.id,
          { status: record.status },
          { status: ExportStatus.FAILED },
        );
      });
      throw error;
    }
  }

  get(id: string, actor: AccessClaims) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      const record = await tx.export.findFirst({
        where: { id, tenantId: actor.tenantId },
        include: { fileObject: true },
      });
      if (!record) throw new NotFoundException();
      if (
        record.status === ExportStatus.COMPLETED &&
        record.expiresAt &&
        record.expiresAt <= new Date()
      ) {
        await tx.export.update({
          where: { id },
          data: { status: ExportStatus.EXPIRED },
        });
        return { ...record, status: ExportStatus.EXPIRED, download: null };
      }
      return {
        ...record,
        download:
          record.status === ExportStatus.COMPLETED && record.fileObject
            ? this.storage.signDownload(record.fileObject.objectKey)
            : null,
      };
    });
  }

  private expiry(): Date {
    const hours = Number(
      this.config.get<string | number>('EXPORT_TTL_HOURS', 24),
    );
    if (!Number.isFinite(hours) || hours < 1 || hours > 168)
      throw new Error('EXPORT_TTL_HOURS must be between 1 and 168');
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }
}
