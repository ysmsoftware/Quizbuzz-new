import { Router } from "express";

// Domain routers
import { organizationRouter } from "./modules/organization/organization.routes"
import { adminAuthRouter } from "./modules/admin/auth/admin-auth.routes";
import { contactRouter } from "./modules/contact/contact.routes";
import { contestRouter } from "./modules/contest/contest.routes";
import { participantRouter } from "./modules/participant/participant.routes";
import { questionRouter } from "./modules/question/question.routes";
import { messagingRouter } from "./modules/messaging/messaging.routes";
import { certificateRouter } from "./modules/certificate/certificate.router";
import { submissionRouter } from "./modules/submission/submission.routes";
import { proctoringRouter } from "./modules/proctoring/proctoring.routes";
import { analyticsRouter } from "./modules/analytics/analytics.routes";

import { authLimiter, analyticsLimiter } from "./middlewares/rate-limit.js";
import paymentRouter from "./modules/payment/payment.routes.js";
import { quizRegistrationRouter } from "./modules/quiz/quiz-registration.routes.js";

const apiRouter = Router();

apiRouter.use("/org", organizationRouter);
apiRouter.use("/auth/admin", adminAuthRouter);
apiRouter.use("/auth/quiz", quizRegistrationRouter);
apiRouter.use("/contacts", contactRouter);
apiRouter.use("/contests", contestRouter);
apiRouter.use("/contests", participantRouter);
apiRouter.use("/questions", questionRouter);
apiRouter.use("/messaging", messagingRouter);
apiRouter.use("/payment", paymentRouter);
apiRouter.use("/certificates", certificateRouter);
apiRouter.use("/proctoring", proctoringRouter);
apiRouter.use("/analytics", analyticsLimiter, analyticsRouter);
apiRouter.use("/", submissionRouter); // submission routes carry their own full prefixes

export { apiRouter };
