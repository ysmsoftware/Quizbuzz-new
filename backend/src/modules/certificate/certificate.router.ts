import { Router } from "express";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";

function ctrl() { return require("../../container").certificateController; }

const certificateRouter = Router();

// Public endpoint for participants to download and view their certificates
certificateRouter.get("/public/:id", (req, res, next) => ctrl().getCertificateByIdPublic(req, res, next));

certificateRouter.use(authenticatedOrgMiddleware);

// Static routes BEFORE parameterised ones
certificateRouter.post("/issue",        (req, res, next) => ctrl().issueCertificate(req, res, next));
certificateRouter.post("/bulk-issue",   (req, res, next) => ctrl().bulkIssueCertificates(req, res, next));
certificateRouter.post("/retry-failed", (req, res, next) => ctrl().retryFailedCertificates(req, res, next));

// Read routes
certificateRouter.get("/contact/:contactId/contest/:contestId", (req, res, next) => ctrl().getCertificateByContactAndContest(req, res, next));
certificateRouter.get("/contact/:contactId", (req, res, next) => ctrl().getCertificatesByContact(req, res, next));
certificateRouter.get("/contest/:contestId", (req, res, next) => ctrl().getCertificatesByContest(req, res, next));

// Parameterised routes last
certificateRouter.get("/:id",        (req, res, next) => ctrl().getCertificateById(req, res, next));
certificateRouter.post("/:id/retry", (req, res, next) => ctrl().retryCertificate(req, res, next));

export { certificateRouter };
