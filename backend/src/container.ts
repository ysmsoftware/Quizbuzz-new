import { OpsMetricsService } from './modules/ops-metrics/ops-metrics.service.js';
import { OpsMetricsController } from './modules/ops-metrics/ops-metrics.controller.js';
import { AdminAuthController } from './modules/admin/auth/admin-auth.controller.js';
import { AdminAuthRepository } from './modules/admin/auth/admin-auth.repository.js';
import { AdminAuthService } from './modules/admin/auth/admin-auth.service.js';
import { EmailProvider } from './providers/email.provider.js';
import { ContactController } from './modules/contact/contact.controller.js';
import { ContactRepository } from './modules/contact/contact.repository.js';
import { ContactService } from './modules/contact/contact.service.js';
import { ContestController } from './modules/contest/contest.controller.js';
import { ContestRepository } from './modules/contest/contest.repository.js';
import { ParticipantRepository } from './modules/participant/participant.repository.js';
import { LeaderboardRepository } from './modules/contest/leaderboard.repository.js';
import { ContestService } from './modules/contest/contest.service.js';
import { QuestionController } from './modules/question/question.controller.js';
import { QuestionRepository } from './modules/question/question.repository.js';
import { QuestionService } from './modules/question/question.service.js';
import { MessagingController } from './modules/messaging/messaging.controller.js';
import { OrganizationRepository } from './modules/organization/organization.repository.js';
import { OrganizationService } from './modules/organization/organization.service.js';
import { MessagingRepository } from './modules/messaging/messaging.repository.js';
import { MessagingService } from './modules/messaging/messaging.service.js';
import { CertificateRepository } from './modules/certificate/certificate.repository.js';
import { CertificateService } from './modules/certificate/certificate.service.js';
import { CertificateController } from './modules/certificate/certificate.controller.js';
import { CertificateTemplateRepository } from './modules/certificate-template/certificate-template.repository.js';
import { CertificateTemplateService } from './modules/certificate-template/certificate-template.service.js';
import { CertificateTemplateController } from './modules/certificate-template/certificate-template.controller.js';
import { SubmissionRepository } from './modules/submission/submission.repository.js';
import { SubmissionService } from './modules/submission/submission.service.js';
import { SubmissionController } from './modules/submission/submission.controller.js';
import { PaymentService } from './modules/payment/payment.service.js';
import { RazorpayProvider } from './providers/razorpay.provider.js';
import { ParticipantService } from './modules/participant/participant.service.js';
import { PaymentRepository } from './modules/payment/payment.repository.js';
import { PaymentController } from './modules/payment/payment.controller.js';
import { OrganizationController } from './modules/organization/organization.controller.js';
import { ParticipantController } from './modules/participant/participant.controller.js';
import { ProctoringRepository } from './modules/proctoring/proctoring.repository.js';
import { ProctoringService as AdminProctoringService } from './modules/proctoring/proctoring.service.js';
import { ProctoringController } from './modules/proctoring/proctoring.controller.js';
import { AnalyticsRepository } from './modules/analytics/analytics.repository.js';
import { AnalyticsService } from './modules/analytics/analytics.service.js';
import { AnalyticsController } from './modules/analytics/analytics.controller.js';
import { OnboardingRepository } from './modules/onboarding/onboarding.repository.js';
import { OnboardingService } from './modules/onboarding/onboarding.service.js';
import { OnboardingController } from './modules/onboarding/onboarding.controller.js';
import { PayoutRepository } from './modules/payout/payout.repository.js';
import { PayoutService } from './modules/payout/payout.service.js';
import { PayoutController } from './modules/payout/payout.controller.js';
import { DashboardRepository } from './modules/dashboard/dashboard.repository.js';
import { DashboardService } from './modules/dashboard/dashboard.service.js';
import { DashboardController } from './modules/dashboard/dashboard.controller.js';
import { AmbassadorRepository } from './modules/ambassador/ambassador.repository.js';
import { AmbassadorService } from './modules/ambassador/ambassador.service.js';
import { AmbassadorController } from './modules/ambassador/ambassador.controller.js';
import { AmbassadorCampaignRepository } from './modules/ambassador-campaign/ambassador-campaign.repository.js';
import { AmbassadorCampaignService } from './modules/ambassador-campaign/ambassador-campaign.service.js';
import { AmbassadorCampaignController } from './modules/ambassador-campaign/ambassador-campaign.controller.js';
import { getStorageProvider } from './providers/storage.provider.js';
import { DurabilityRepository } from './modules/durability/durability.repository.js';
import { DurabilityService } from './modules/durability/durability.service.js';

// Quiz Module
import { QuizSession } from './modules/quiz/quiz.session.js';
import { QuizService } from './modules/quiz/quiz.service.js';
import { QuizAuthService } from './modules/quiz/quiz-auth.service.js';
import { QuizRegistrationService } from './modules/quiz/quiz-registration.service.js';
import { QuizRegistrationController } from './modules/quiz/quiz-registration.controller.js';
import { ProctoringService } from './modules/quiz/proctoring.service.js';
import { QuizGateway } from './modules/quiz/quiz.gateway.js';
import { AdminGateway } from './modules/quiz/admin.gateway.js';
import { QuizSchedulerService } from './modules/quiz/quiz-scheduler.service.js';
import { SocketService } from './socket/socket.js';
import { injectTimerWorkerDeps } from './workers/quiz-timer.worker.js';

import { prisma } from './config/db.js';

export const razorpay = new RazorpayProvider();
export const emailProvider = new EmailProvider();
export const storageProvider = getStorageProvider();

// ─── Repositories ─────────────────────────────────────────────────────────────
export const organizationRepository = new OrganizationRepository()
export const adminAuthRepository = new AdminAuthRepository();
export const contactRepository = new ContactRepository();
export const contestRepository = new ContestRepository();
export const participantRepository = new ParticipantRepository();
export const leaderboardRepository = new LeaderboardRepository();
export const questionRepository = new QuestionRepository();
export const messagingRepository = new MessagingRepository();
export const certificateRepository = new CertificateRepository();
export const certificateTemplateRepository = new CertificateTemplateRepository();
export const submissionRepository = new SubmissionRepository();
export const paymentRepository = new PaymentRepository();
export const proctoringRepository = new ProctoringRepository();
export const analyticsRepository = new AnalyticsRepository(prisma);
export const onboardingRepository = new OnboardingRepository();
export const payoutRepository = new PayoutRepository();
export const dashboardRepository = new DashboardRepository();
export const ambassadorRepository = new AmbassadorRepository();
export const ambassadorCampaignRepository = new AmbassadorCampaignRepository();
export const durabilityRepository = new DurabilityRepository();

// ─── Services ─────────────────────────────────────────────────────────────────
export const messagingService = new MessagingService(messagingRepository, participantRepository);
export const organizationService = new OrganizationService(organizationRepository, messagingService);
export const adminAuthService = new AdminAuthService(adminAuthRepository, organizationService, messagingService);
export const certificateTemplateService = new CertificateTemplateService(certificateTemplateRepository, organizationRepository);
export const certificateService = new CertificateService(certificateRepository, participantRepository, certificateTemplateRepository);
export const contactService = new ContactService(contactRepository, messagingService, certificateService);
export const submissionService = new SubmissionService(submissionRepository, participantRepository, contestRepository);
export const participantService = new ParticipantService(participantRepository, contestRepository);
export const quizSchedulerService = new QuizSchedulerService();
export const payoutService = new PayoutService(payoutRepository, razorpay, messagingService);
export const contestService = new ContestService(organizationRepository, contestRepository, participantService, leaderboardRepository, contactService, messagingService, submissionService, quizSchedulerService, participantRepository, paymentRepository, ambassadorCampaignRepository);
export const questionService = new QuestionService(questionRepository, contestService);
export const paymentService = new PaymentService(paymentRepository, razorpay, contestService, participantService, messagingService, payoutService);
export const adminProctoringService = new AdminProctoringService(proctoringRepository);
export const quizSession = new QuizSession();

export const opsMetricsService = new OpsMetricsService(quizSession);
export const opsMetricsController = new OpsMetricsController(opsMetricsService);
export const analyticsService = new AnalyticsService(analyticsRepository, quizSession);
export const durabilityService = new DurabilityService(durabilityRepository, quizSession);
export const onboardingService = new OnboardingService(onboardingRepository);
export const dashboardService = new DashboardService(dashboardRepository);
export const ambassadorService = new AmbassadorService(ambassadorRepository, ambassadorCampaignRepository, organizationRepository, emailProvider, storageProvider);
export const ambassadorCampaignService = new AmbassadorCampaignService(ambassadorCampaignRepository, ambassadorRepository, organizationRepository, emailProvider, storageProvider);
export const proctoringService = new ProctoringService(prisma, quizSession);
export const quizService = new QuizService(quizSession, proctoringService, submissionService, quizSchedulerService, durabilityService);
export const quizAuthService = new QuizAuthService(prisma, quizSession, messagingService);
export const quizRegistrationService = new QuizRegistrationService(emailProvider);
export const socketService = new SocketService();


export const quizGateway = new QuizGateway(
    quizService,
    proctoringService
);

export const adminGateway = new AdminGateway(
    quizService,
    proctoringService
);

// Lets AdminGateway relay admin:v1:broadcast to participants without a hard
// constructor dependency on QuizGateway — same late-binding pattern as
// contestService.setBroadcaster(quizGateway) below.
adminGateway.setParticipantBroadcaster(quizGateway);

// Inject dependencies into the timer worker (avoids circular imports)
injectTimerWorkerDeps({
    gateway: quizGateway,
    quizService: quizService,
    contestService: contestService,
    prismaClient: prisma,
});

// ContestService is constructed before the gateway (the gateway depends on
// QuizService), so its socket + quiz-runtime collaborators are bound after the fact
// through narrow ports — same late-binding approach as injectTimerWorkerDeps above.
contestService.setBroadcaster(quizGateway);
contestService.setQuizTerminator({
    handleTimeExpiry: (cid) => quizService.handleTimeExpiry(cid),
    emitAutoSubmit: (pid, cid, reason) => quizGateway.emitAutoSubmit(pid, cid, reason),
});
contestService.setQuizStarter({
    transitionToQuiz: (cid) => quizService.transitionToQuiz(cid),
    handleRejoin: (cid, pid) => quizService.handleRejoin(cid, pid),
    startQuizForParticipant: (pid, cid, oid, contactId) => quizGateway.startQuizForParticipant(pid, cid, oid, contactId),
    broadcastAdminEvent: (cid, event, data) => quizGateway.broadcastAdminEvent(cid, event, data),
});

// ─── Controllers ──────────────────────────────────────────────────────────────
export const organizationController = new OrganizationController(organizationService, adminAuthRepository);
export const adminAuthController = new AdminAuthController(adminAuthService);
export const contactController = new ContactController(contactService);
export const contestController = new ContestController(contestService);
export const questionController = new QuestionController(questionService);
export const messagingController = new MessagingController(messagingService);
export const certificateController = new CertificateController(certificateService);
export const certificateTemplateController = new CertificateTemplateController(certificateTemplateService);
export const submissionController = new SubmissionController(submissionService);
export const participantController = new ParticipantController(participantService);
export const paymentController = new PaymentController(paymentService);
export const proctoringController = new ProctoringController(adminProctoringService);
export const analyticsController = new AnalyticsController(analyticsService);
export const onboardingController = new OnboardingController(onboardingService);
export const quizRegistrationController = new QuizRegistrationController(quizRegistrationService, quizAuthService);
export const payoutController = new PayoutController(payoutService);
export const dashboardController = new DashboardController(dashboardService);
export const ambassadorController = new AmbassadorController(ambassadorService);
export const ambassadorCampaignController = new AmbassadorCampaignController(ambassadorCampaignService);
