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
import { ambassadorCampaignRouter } from "./modules/ambassador-campaign/ambassador-campaign.routes";

const apiRouter = Router();

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
apiRouter.use("/public/ambassador", ambassadorPublicRouter);
apiRouter.use("/ambassador", ambassadorRouter);
apiRouter.use("/org/ambassadors", ambassadorCampaignRouter);
apiRouter.use("/queues", authenticatedOrgMiddleware, bullBoardRouter);
apiRouter.use("/", submissionRouter); // submission routes carry their own full prefixes

export { apiRouter };
