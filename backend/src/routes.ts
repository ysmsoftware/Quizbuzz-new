import { Router } from "express";

// Domain routers
import { organizationRouter } from "./modules/organization/organization.routes"
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { adminAuthRouter } from "./modules/admin/auth/admin-auth.routes";
import { contactRouter } from "./modules/contact/contact.routes";
import { contestRouter } from "./modules/contest/contest.routes";
import { participantRouter } from "./modules/participant/participant.routes";
import { questionRouter } from "./modules/question/question.routes";
import { messagingRouter } from "./modules/messaging/messaging.routes";
import { certificateRouter } from "./modules/certificate/certificate.router";
import { certificateTemplateRouter } from "./modules/certificate-template/certificate-template.routes";
import { submissionRouter } from "./modules/submission/submission.routes";
import { proctoringRouter } from "./modules/proctoring/proctoring.routes";
import { analyticsRouter } from "./modules/analytics/analytics.routes";
import { onboardingRouter } from "./modules/onboarding/onboarding.routes";

import { authLimiter, analyticsLimiter } from "./middlewares/rate-limit.js";
import { authenticatedOrgMiddleware } from "./middlewares/authenticated-org.middleware";
import { bullBoardRouter } from "./queues/board";
import paymentRouter from "./modules/payment/payment.routes.js";
import payoutRouter from "./modules/payout/payout.routes.js";
import { quizRegistrationRouter } from "./modules/quiz/quiz-registration.routes.js";
import { quizProctoringRouter } from "./modules/quiz/quiz-proctoring.routes.js";
import { ambassadorPublicRouter, ambassadorRouter } from "./modules/ambassador/ambassador.routes";
import { orgAmbassadorRouter, campaignRouter } from "./modules/ambassador-campaign/ambassador-campaign.routes";
import { opsMetricsRouter } from "./modules/ops-metrics/ops-metrics.routes";

const apiRouter = Router();

// IMPORTANT: these two must be mounted before organizationRouter/dashboardRouter below.
// organizationRouter has GET /org/:orgId (a single-segment catch-all) and dashboardRouter
// has GET /org/:orgId/dashboard/*; Express matches router.use() mounts in registration
// order, not by specificity. organizationRouter's :orgId param happily matches literal
// single-segment paths like "campaigns" or "ambassadors" — so GET /org/campaigns (list) and
// GET /org/ambassadors (directory list) would be swallowed as "get organization id=campaigns"
// / "id=ambassadors" and 404 before ever reaching campaignRouter/orgAmbassadorRouter, if
// those were registered after organizationRouter. Nested sub-paths (e.g.
// /org/campaigns/:id, /org/ambassadors/applications) aren't affected — only the two
// single-segment root list routes are shaped like :orgId. Keep this pair above the /org
// mounts below.
apiRouter.use("/org/ambassadors", orgAmbassadorRouter);
apiRouter.use("/org/campaigns", campaignRouter);
apiRouter.use("/org", organizationRouter);
apiRouter.use("/org", dashboardRouter);
apiRouter.use("/auth/admin", adminAuthRouter);
apiRouter.use("/auth/quiz", quizRegistrationRouter);
apiRouter.use("/quiz-proctoring", quizProctoringRouter);
apiRouter.use("/contacts", contactRouter);
apiRouter.use("/contests", contestRouter);
apiRouter.use("/contests", participantRouter);
apiRouter.use("/questions", questionRouter);
apiRouter.use("/messaging", messagingRouter);
apiRouter.use("/payments", paymentRouter);
apiRouter.use("/payout-accounts", payoutRouter);
apiRouter.use("/certificates", certificateRouter);
apiRouter.use("/certificate-templates", certificateTemplateRouter);
apiRouter.use("/proctoring", proctoringRouter);
apiRouter.use("/analytics", analyticsLimiter, analyticsRouter);
apiRouter.use("/onboarding", onboardingRouter);
apiRouter.use("/ops/metrics", opsMetricsRouter);
apiRouter.use("/public/ambassador", ambassadorPublicRouter);
apiRouter.use("/ambassador", ambassadorRouter);
apiRouter.use("/queues", authenticatedOrgMiddleware, bullBoardRouter);
apiRouter.use("/", submissionRouter); // submission routes carry their own full prefixes

export { apiRouter };
