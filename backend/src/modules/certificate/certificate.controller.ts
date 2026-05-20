import { Request, Response, NextFunction } from "express";
import { CertificateService } from "./certificate.service";
import {
    issueCertificateSchema,
    bulkIssueCertificateSchema,
    certificatePaginationSchema,
} from "./certificate.validator";

export class CertificateController {
    constructor(private readonly certificateService: CertificateService) {}

    // ── GET /certificates/public/:id ──────────────────────────────────────────

    getCertificateByIdPublic = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const cert = await this.certificateService.getCertificateByIdPublic(
                req.params.id as string
            );
            res.status(200).json({ success: true, data: cert });
        } catch (err) { next(err); }
    };

    // ── GET /certificates/:id ─────────────────────────────────────────────────

    getCertificateById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const cert = await this.certificateService.getCertificateById(
                req.params.id as string,
                req.user!.organizationId as string
            );
            res.status(200).json({ success: true, data: cert });
        } catch (err) { next(err); }
    };

    // ── GET /certificates/contact/:contactId ──────────────────────────────────

    getCertificatesByContact = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { page, limit } = certificatePaginationSchema.parse(req.query);
            const result = await this.certificateService.getCertificatesByContact(
                req.params.contactId as string,
                req.user!.organizationId as string,
                page,
                limit
            );
            res.status(200).json({ success: true, ...result });
        } catch (err) { next(err); }
    };

    // ── GET /certificates/contest/:contestId ──────────────────────────────────

    getCertificatesByContest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { page, limit } = certificatePaginationSchema.parse(req.query);
            const result = await this.certificateService.getCertificatesByContest(
                req.params.contestId as string,
                req.user!.organizationId as string,
                page,
                limit
            );
            res.status(200).json({ success: true, ...result });
        } catch (err) { next(err); }
    };

    // ── GET /certificates/contact/:contactId/contest/:contestId ───────────────

    getCertificateByContactAndContest = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const cert = await this.certificateService.getCertificateByContactAndContest(
                req.params.contactId as string,
                req.params.contestId as string,
                req.user!.organizationId as string
            );
            res.status(200).json({ success: true, data: cert });
        } catch (err) { next(err); }
    };

    // ── POST /certificates/issue ──────────────────────────────────────────────

    issueCertificate = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const dto = issueCertificateSchema.parse(req.body);
            const cert = await this.certificateService.issueCertificate(
                dto,
                req.user!.organizationId as string
            );
            res.status(202).json({
                success: true,
                message: "Certificate queued for generation",
                data: cert,
            });
        } catch (err) { next(err); }
    };

    // ── POST /certificates/bulk-issue ─────────────────────────────────────────

    bulkIssueCertificates = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { contestId } = bulkIssueCertificateSchema.parse(req.body);
            const result = await this.certificateService.bulkIssueCertificates(
                contestId,
                req.user!.organizationId as string
            );
            res.status(202).json({
                success: true,
                message: `${result.queued} certificates queued, ${result.skipped} skipped (already issued)`,
                data: result,
            });
        } catch (err) { next(err); }
    };

    // ── POST /certificates/:id/retry ──────────────────────────────────────────

    retryCertificate = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const cert = await this.certificateService.retryCertificate(
                req.params.id as string,
                req.user!.organizationId as string
            );
            res.status(202).json({
                success: true,
                message: "Certificate re-queued for generation",
                data: cert,
            });
        } catch (err) { next(err); }
    };

    // ── POST /certificates/retry-failed ──────────────────────────────────────

    retryFailedCertificates = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Optional: scope to a specific contest via query param
            const contestId = req.query.contestId as string | undefined;
            const result = await this.certificateService.retryFailedCertificates(
                req.user!.organizationId,
                contestId
            );
            res.status(202).json({
                success: true,
                message: `${result.count} failed certificates re-queued`,
                data: result,
            });
        } catch (err) { next(err); }
    };
}
