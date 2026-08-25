import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FilePurpose,
  MarkSheetStatus,
  Prisma,
  UploadStatus,
  VersionStatus,
} from '@prisma/client';
import type { AccessClaims } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { MarkSheetsService } from '../mark-sheets/mark-sheets.service';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../database/tenant-context.service';
import { ObjectStorageService } from './object-storage.service';
import { CreateUploadSessionDto } from './upload.dto';
import { capturedMarkSheetKey } from './storage-key';

@Injectable()
export class UploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly storage: ObjectStorageService,
    private readonly audit: AuditService,
    private readonly markSheets: MarkSheetsService,
  ) {}

  create(dto: CreateUploadSessionDto, actor: AccessClaims) {
    const checksum = dto.checksumSha256.toLowerCase();
    return this.tenant.transaction(this.prisma, async (tx) => {
      const existing = await tx.markSheet.findUnique({
        where: {
          tenantId_clientRequestId: {
            tenantId: actor.tenantId,
            clientRequestId: dto.clientRequestId,
          },
        },
        include: { images: { include: { fileObject: true } } },
      });
      if (existing) return this.existingSession(existing, dto, checksum);
      const capturedAttempt = await tx.markSheet.findUnique({
        where: {
          tenantId_studentId_subjectOfferingId_questionPaperVersionId_attempt: {
            tenantId: actor.tenantId,
            studentId: dto.studentId,
            subjectOfferingId: dto.subjectOfferingId,
            questionPaperVersionId: dto.questionPaperVersionId,
            attempt: dto.attempt,
          },
        },
      });
      if (capturedAttempt) {
        return {
          markSheetId: capturedAttempt.id,
          status: capturedAttempt.status,
          alreadyCaptured: true,
        };
      }
      const [student, offering, paperVersion, schemeVersion, professor] =
        await Promise.all([
          tx.student.findFirst({
            where: {
              id: dto.studentId,
              tenantId: actor.tenantId,
              status: 'ACTIVE',
            },
            include: { department: { include: { college: true } } },
          }),
          tx.subjectOffering.findFirst({
            where: {
              id: dto.subjectOfferingId,
              tenantId: actor.tenantId,
              status: 'ACTIVE',
            },
            include: { subject: true, academicYear: true },
          }),
          tx.questionPaperVersion.findFirst({
            where: {
              id: dto.questionPaperVersionId,
              tenantId: actor.tenantId,
              status: VersionStatus.PUBLISHED,
            },
            include: { questionPaper: true },
          }),
          tx.markingSchemeVersion.findFirst({
            where: {
              id: dto.markingSchemeVersionId,
              tenantId: actor.tenantId,
              status: VersionStatus.PUBLISHED,
            },
          }),
          tx.user.findFirst({
            where: { id: actor.sub, tenantId: actor.tenantId },
            select: { displayName: true, username: true },
          }),
        ]);
      if (
        !student ||
        !offering ||
        !paperVersion ||
        !schemeVersion ||
        !professor
      )
        throw new BadRequestException(
          'Capture context is inactive, unpublished, missing, or outside this tenant',
        );
      if (
        student.sectionId !== offering.sectionId ||
        student.programId !== offering.programId
      )
        throw new BadRequestException(
          'Student is not enrolled in the selected subject offering context',
        );
      if (offering.subjectId !== paperVersion.questionPaper.subjectId)
        throw new BadRequestException(
          'Question paper subject does not match the subject offering',
        );
      if (
        schemeVersion.questionPaperVersionId !== paperVersion.id ||
        paperVersion.markingSchemeVersionId !== schemeVersion.id
      )
        throw new BadRequestException(
          'Question paper and marking scheme versions are not bound',
        );
      const markSheetId = randomUUID();
      const fileId = randomUUID();
      const objectKey = capturedMarkSheetKey({
        tenantId: actor.tenantId,
        professorName: professor.displayName || professor.username,
        collegeName: student.department.college.name,
        departmentName: student.department.name,
        academicYear: offering.academicYear.code,
        studentName: student.fullName,
        studentRegisterNumber: student.registerNumber,
        markSheetId,
        pageNumber: dto.pageNumber,
        fileId,
        mimeType: dto.mimeType,
      });
      const signed = this.storage.signUpload(objectKey, dto.mimeType, checksum);
      const markSheet = await tx.markSheet.create({
        data: {
          id: markSheetId,
          tenantId: actor.tenantId,
          clientRequestId: dto.clientRequestId,
          studentId: dto.studentId,
          subjectOfferingId: dto.subjectOfferingId,
          questionPaperVersionId: dto.questionPaperVersionId,
          markingSchemeVersionId: dto.markingSchemeVersionId,
          questionSetNumber: paperVersion.questionPaper.code,
          attempt: dto.attempt,
          status: MarkSheetStatus.PENDING_UPLOAD,
        },
      });
      const file = await tx.fileObject.create({
        data: {
          id: fileId,
          tenantId: actor.tenantId,
          purpose: FilePurpose.ORIGINAL_MARK_SHEET,
          bucket: this.storage.bucketName,
          objectKey,
          mimeType: dto.mimeType,
          sizeBytes: BigInt(dto.sizeBytes),
          checksumSha256: checksum,
          uploadExpiresAt: signed.expiresAt,
          uploadStatus: UploadStatus.PENDING,
        },
      });
      const image = await tx.markSheetImage.create({
        data: {
          tenantId: actor.tenantId,
          markSheetId,
          fileObjectId: fileId,
          pageNumber: dto.pageNumber,
        },
      });
      await this.audit.record(
        tx,
        actor,
        'UPLOAD_SESSION_CREATED',
        'markSheet',
        markSheet.id,
        undefined,
        {
          fileObjectId: file.id,
          pageNumber: dto.pageNumber,
          sizeBytes: dto.sizeBytes,
        },
      );
      return {
        markSheetId: markSheet.id,
        imageId: image.id,
        fileObjectId: file.id,
        upload: signed,
      };
    });
  }

  async complete(markSheetId: string, actor: AccessClaims) {
    const uploaded = await this.completeVerified(markSheetId, actor);
    return this.markSheets.processUploaded(markSheetId, actor, uploaded);
  }

  private async completeVerified(markSheetId: string, actor: AccessClaims) {
    const session = await this.tenant.transaction(this.prisma, async (tx) => {
      const markSheet = await tx.markSheet.findFirst({
        where: { id: markSheetId, tenantId: actor.tenantId },
        include: { images: { include: { fileObject: true } } },
      });
      if (!markSheet) throw new NotFoundException();
      const file = markSheet.images[0]?.fileObject;
      if (!file) throw new ConflictException('Upload session has no file');
      if (file.uploadStatus === UploadStatus.COMPLETED)
        return {
          completed: true as const,
          result: { markSheetId, status: markSheet.status },
        };
      if (file.uploadExpiresAt < new Date()) {
        await tx.fileObject.update({
          where: { id: file.id },
          data: { uploadStatus: UploadStatus.EXPIRED },
        });
        throw new GoneException('Upload session expired');
      }
      return { completed: false as const, markSheet, file };
    });
    if (session.completed) return session.result;
    const object = await this.storage.inspect(session.file.objectKey);
    const { file, markSheet } = session;
    if (
      object.size !== Number(file.sizeBytes) ||
      object.mimeType !== file.mimeType ||
      object.checksum?.toLowerCase() !== file.checksumSha256
    )
      throw new BadRequestException(
        'Uploaded object metadata does not match the authorized upload',
      );
    return this.tenant.transaction(this.prisma, async (tx) => {
      const pending = await tx.fileObject.findFirst({
        where: {
          id: file.id,
          tenantId: actor.tenantId,
          uploadStatus: UploadStatus.PENDING,
        },
      });
      if (!pending)
        throw new ConflictException(
          'Upload session state changed; reload before retrying',
        );
      await tx.fileObject.update({
        where: { id: file.id },
        data: { uploadStatus: UploadStatus.COMPLETED, uploadedAt: new Date() },
      });
      const updated = await tx.markSheet.update({
        where: { id: markSheet.id },
        data: { status: MarkSheetStatus.UPLOADED },
      });
      await this.audit.record(
        tx,
        actor,
        'UPLOAD_COMPLETED',
        'markSheet',
        markSheet.id,
        { status: markSheet.status },
        { status: updated.status, fileObjectId: file.id },
      );
      return { markSheetId, status: updated.status };
    });
  }

  private existingSession(
    existing: Prisma.MarkSheetGetPayload<{
      include: { images: { include: { fileObject: true } } };
    }>,
    dto: CreateUploadSessionDto,
    checksum: string,
  ) {
    const file = existing.images[0]?.fileObject;
    const image = existing.images[0];
    if (
      !file ||
      !image ||
      existing.studentId !== dto.studentId ||
      existing.subjectOfferingId !== dto.subjectOfferingId ||
      existing.questionPaperVersionId !== dto.questionPaperVersionId ||
      existing.markingSchemeVersionId !== dto.markingSchemeVersionId ||
      existing.attempt !== dto.attempt ||
      image.pageNumber !== dto.pageNumber ||
      Number(file.sizeBytes) !== dto.sizeBytes ||
      file.mimeType !== dto.mimeType ||
      file.checksumSha256 !== checksum
    )
      throw new ConflictException(
        'clientRequestId was already used with different upload parameters',
      );
    if (
      file.uploadStatus !== UploadStatus.PENDING ||
      file.uploadExpiresAt < new Date()
    )
      throw new GoneException(
        'The existing upload session is no longer reusable',
      );
    return {
      markSheetId: existing.id,
      imageId: image.id,
      fileObjectId: file.id,
      upload: this.storage.signUpload(
        file.objectKey,
        file.mimeType,
        file.checksumSha256,
      ),
    };
  }
}
