import { AdminAuthController } from './modules/admin/auth/admin-auth.controller.js';
import { AdminAuthRepository } from './modules/admin/auth/admin-auth.repository.js';
import { AdminAuthService } from './modules/admin/auth/admin-auth.service.js';
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

// Quiz Module
import { QuizSession } from './modules/quiz/quiz.session.js';
import { QuizService } from './modules/quiz/quiz.service.js';
import { QuizAuthService } from './modules/quiz/quiz-auth.service.js';
import { ProctoringService } from './modules/quiz/proctoring.service.js';
import { QuizGateway } from './modules/quiz/quiz.gateway.js';
import { AdminGateway } from './modules/quiz/admin.gateway.js';
import { QuizSchedulerService } from './modules/quiz/quiz-scheduler.service.js';
import { SocketService } from './socket/socket.js';
import { injectTimerWorkerDeps } from './workers/quiz-timer.worker.js';

import { prisma } from './config/db.js';

export const razorpay = new RazorpayProvider();

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
export const submissionRepository = new SubmissionRepository();
export const paymentRepository = new PaymentRepository();
export const proctoringRepository = new ProctoringRepository();
export const analyticsRepository = new AnalyticsRepository(prisma);

// ─── Services ─────────────────────────────────────────────────────────────────
export const messagingService = new MessagingService(messagingRepository, participantRepository);
export const organizationService = new OrganizationService(organizationRepository, messagingService);
export const adminAuthService = new AdminAuthService(adminAuthRepository, organizationService, messagingService);
export const certificateService = new CertificateService(certificateRepository, participantRepository);
export const contactService = new ContactService(contactRepository, messagingService, certificateService);
export const submissionService = new SubmissionService(submissionRepository, participantRepository, contestRepository);
export const participantService = new ParticipantService(participantRepository, contestRepository);
export const quizSchedulerService = new QuizSchedulerService();
export const contestService = new ContestService(contestRepository, participantService, leaderboardRepository, contactService, messagingService, submissionService, quizSchedulerService);
export const questionService = new QuestionService(questionRepository, contestService);
export const paymentService = new PaymentService(paymentRepository, razorpay, contestService, participantService, messagingService)
export const adminProctoringService = new AdminProctoringService(proctoringRepository);
export const quizSession = new QuizSession();
export const analyticsService = new AnalyticsService(analyticsRepository, quizSession);
export const proctoringService = new ProctoringService(prisma, quizSession);
export const quizService = new QuizService(quizSession, proctoringService, submissionService);
export const quizAuthService = new QuizAuthService(prisma, quizSession, messagingService);
export const socketService = new SocketService();


export const quizGateway = new QuizGateway(
    quizService,
    proctoringService
);

export const adminGateway = new AdminGateway(
    quizService,
    proctoringService
);

// Inject dependencies into the timer worker (avoids circular imports)
injectTimerWorkerDeps({
    gateway: quizGateway,
    quizService: quizService,
    contestService: contestService,
    prismaClient: prisma,
});

// ─── Controllers ──────────────────────────────────────────────────────────────
export const organizationController = new OrganizationController(organizationService, adminAuthRepository);
export const adminAuthController = new AdminAuthController(adminAuthService);
export const contactController = new ContactController(contactService);
export const contestController = new ContestController(contestService);
export const questionController = new QuestionController(questionService);
export const messagingController = new MessagingController(messagingService);
export const certificateController = new CertificateController(certificateService);
export const submissionController = new SubmissionController(submissionService);
export const participantController = new ParticipantController(participantService);
export const paymentController = new PaymentController(paymentService);
export const proctoringController = new ProctoringController(adminProctoringService);
export const analyticsController = new AnalyticsController(analyticsService);
