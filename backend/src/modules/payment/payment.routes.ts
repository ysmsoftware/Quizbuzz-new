import { Router } from "express";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";
import { idempotency } from "../../middlewares/idempotency.middleware";

function ctrl() { return require("../../container").paymentController; }

const paymentRouter = Router();

paymentRouter.post("/create-order", idempotency,               (req, res, next) => ctrl().createOrder(req, res, next));
paymentRouter.post("/verify",                                  (req, res, next) => ctrl().verifyPayment(req, res, next));
paymentRouter.post("/retry",        idempotency,               (req, res, next) => ctrl().retryPayment(req, res, next));

// Webhook is registered in app.ts BEFORE json body-parser (needs raw buffer).
// DO NOT move it here — express.raw() must intercept it first.

paymentRouter.get("/status/:participantId",                    (req, res, next) => ctrl().getPaymentStatus(req, res, next));
paymentRouter.get("/events/:contestId", authenticatedOrgMiddleware, (req, res, next) => ctrl().getPaymentsByEvent(req, res, next));
paymentRouter.get("/",              authenticatedOrgMiddleware, (req, res, next) => ctrl().getAllPayment(req, res, next));
paymentRouter.get("/:paymentId",                               (req, res, next) => ctrl().getPaymentById(req, res, next));
paymentRouter.post("/:paymentId/cancel",                       (req, res, next) => ctrl().cancelPayment(req, res, next));

export default paymentRouter;
