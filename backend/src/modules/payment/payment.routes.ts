import { Router } from "express";
import { paymentController } from "../../container";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";
import { idempotency } from "../../middlewares/idempotency.middleware";

const paymentRouter = Router();

paymentRouter.post("/create-order", idempotency, paymentController.createOrder);
paymentRouter.post("/verify", paymentController.verifyPayment);
paymentRouter.post('/retry', idempotency, paymentController.retryPayment)
// router.post('/webhook', paymentController.handleWebhook);


paymentRouter.get('/events/:contestId', authenticatedOrgMiddleware, paymentController.getPaymentsByEvent);
paymentRouter.get('/', authenticatedOrgMiddleware, paymentController.getAllPayment);
paymentRouter.get('/:paymentId', paymentController.getPaymentById);
paymentRouter.post("/:paymentId/cancel",  paymentController.cancelPayment);

export default paymentRouter;