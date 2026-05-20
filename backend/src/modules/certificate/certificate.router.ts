import { Router } from "express";
import { certificateController } from "../../container";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";

const certificateRouter = Router();

// Public endpoint for participants to download and view their certificates
certificateRouter.get("/public/:id", certificateController.getCertificateByIdPublic);

certificateRouter.use(authenticatedOrgMiddleware);

// ─── Static routes BEFORE parameterised ones ─────────────────────────────────
// Express matches top-down; "issue", "bulk-issue", "retry-failed" must come
// before /:id or Express would match them as IDs.

certificateRouter.post("/issue",        certificateController.issueCertificate);
certificateRouter.post("/bulk-issue",   certificateController.bulkIssueCertificates);
certificateRouter.post("/retry-failed", certificateController.retryFailedCertificates);

// ─── Read routes ──────────────────────────────────────────────────────────────

// contact+contest combo before single-param routes (more specific first)
certificateRouter.get(
    "/contact/:contactId/contest/:contestId",
    certificateController.getCertificateByContactAndContest
);
certificateRouter.get("/contact/:contactId", certificateController.getCertificatesByContact);
certificateRouter.get("/contest/:contestId", certificateController.getCertificatesByContest);

// ─── Parameterised routes LAST ────────────────────────────────────────────────

certificateRouter.get("/:id",          certificateController.getCertificateById);
certificateRouter.post("/:id/retry",   certificateController.retryCertificate);

export { certificateRouter };
