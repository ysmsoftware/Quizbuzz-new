import { Router } from "express";
import { paymentController } from "../../container";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";
import { idempotency } from "../../middlewares/idempotency.middleware";

const paymentRouter = Router();

paymentRouter.post("/create-order", idempotency, paymentController.createOrder);
paymentRouter.post("/verify", paymentController.verifyPayment);
paymentRouter.post('/retry', idempotency, paymentController.retryPayment);

// Webhook is registered in app.ts BEFORE json body-parser (needs raw buffer)
// DO NOT move it here — express.raw() must intercept it first.

// Public status poll — frontend polls this after Razorpay modal closes.
// No auth needed: participantId is not guessable (ULID), and status is non-sensitive.
paymentRouter.get('/status/:participantId', paymentController.getPaymentStatus);

paymentRouter.get('/events/:contestId', authenticatedOrgMiddleware, paymentController.getPaymentsByEvent);
paymentRouter.get('/', authenticatedOrgMiddleware, paymentController.getAllPayment);
paymentRouter.get('/:paymentId', paymentController.getPaymentById);
paymentRouter.post("/:paymentId/cancel", paymentController.cancelPayment);

export default paymentRouter;