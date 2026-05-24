import { Router } from "express";
import { quizProctoringController } from "./quiz-proctoring.controller";
import { authenticatedParticipantMiddleware } from "../../middlewares/authenticated-participant.middleware";

export const quizProctoringRouter = Router();

// Presigned URL generation is authenticated so only active participants can generate them
quizProctoringRouter.post("/presigned-url", authenticatedParticipantMiddleware, quizProctoringController.getPresignedUrl);

// Local upload route mimics S3 presigned URL PUT target, so it is public but strictly path-validated and key-restricted
quizProctoringRouter.put("/local-upload", quizProctoringController.localUpload);

// Confirm upload route is authenticated and processes metadata asynchronously via BullMQ
quizProctoringRouter.post("/confirm", authenticatedParticipantMiddleware, quizProctoringController.confirmUpload);
