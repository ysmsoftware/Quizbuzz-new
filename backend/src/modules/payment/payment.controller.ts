import { Request, Response, NextFunction } from "express";
import { PaymentService } from "./payment.service";
import logger from "../../config/logger";
import { PaymentStatus } from "@prisma/client";
import { createOrderSchema, verifyPaymentSchema, retryPaymentSchema, listPaymentsSchema } from "./payment.validator";

export class PaymentController {

    constructor(private paymentService: PaymentService) { }


    createOrder = async (req: Request, res: Response, next: NextFunction) => {
        try {

            const { participantId, contestId } = createOrderSchema.parse(req.body);

            logger.info("Create order request", { participantId, requestId: req.id });
            const result = await this.paymentService.createOrder({ contestId, participantId });

            return res.status(201).json({
                success: true,
                data: result
            });

        } catch (err) {
            next(err);
        }
    }

    verifyPayment = async (req: Request, res: Response, next: NextFunction) => {
        try {

            const validated = verifyPaymentSchema.parse(req.body);

            logger.info("Verify payment request", { razorpayOrderId: validated.razorpayOrderId, requestId: req.id });

            const result = await this.paymentService.verifyPayment(validated);

            return res.status(200).json({
                success: true,
                data: result
            })

        } catch (err) {
            next(err);
        }
    }


    handleWebhook = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const signature = req.headers['x-razorpay-signature'] as string;
            if (!signature) {
                return res.status(400).json({ success: false, message: "Missing Razorpay signature" });
            }
            const rawBody = req.body;

            logger.info("Webhook request", { contest: rawBody?.contest, requestId: req.id });

            await this.paymentService.handleWebhook(signature, rawBody);

            return res.status(200).json({ status: "ok" });

        } catch (err) {
            logger.error("Webhook error", { err });
            return res.status(200).json({ status: "received" });
        }
    }

    retryPayment = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { participantId, contestId, organizationId } = retryPaymentSchema.parse(req.body);

            logger.info("Retry payment request", { participantId, requestId: req.id });

            const result = await this.paymentService.retryPayment(participantId, contestId, organizationId);

            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    cancelPayment = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const paymentId = req.params.paymentId as string;
            if (!paymentId) {
                return res.status(400).json({ success: false, message: "Payment ID is required to cancel a payment" });
            }

            logger.info("Cancel payment request", { paymentId, requestId: req.id });

            await this.paymentService.cancelPayment(paymentId);

            return res.status(204).send();
        } catch (error) {
            next(error);
        }
    }

    getPaymentsByEvent = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { organizationId } = req.user!;
            const { contestId, limit, cursor, status } = listPaymentsSchema.parse({
                ...req.params,
                ...req.query
            });

            logger.info("Fetch event payments request", { contestId, requestId: req.id });

            const result = await this.paymentService.getPaymentsByContest({ 
                organizationId, 
                contestId: contestId!, 
                limit, 
                ...(status && { status }),
                ...(cursor && { cursor })
            })
            return res.status(200).json({
                success: true,
                data: result
            });

        } catch (error) {
            next(error);
        }
    }

    getPaymentById = async (req: Request, res: Response, next: NextFunction) => {
        try {

            const paymentId = req.params.paymentId as string;
            if (!paymentId) {
                return res.status(400).json({ success: false, message: "paymentId is required" });
            }
            logger.info("Fetch payment request", { paymentId, requestId: req.id });

            const result = await this.paymentService.getPaymentById(paymentId);
            return res.status(200).json({
                success: true,
                data: result,
            });

        } catch (error) {
            next(error);
        }
    }


    getAllPayment = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { organizationId } = req.user!;
            const validated = listPaymentsSchema.parse(req.query);

            logger.info("Fetch Payments request", { ...validated, requestId: req.id });

            const { contestId, contactId, razorpayPaymentId, cursor, status, limit } = validated;
            const result = await this.paymentService.getAllPayments({
                organizationId,
                limit,
                ...(contestId && { contestId }),
                ...(contactId && { contactId }),
                ...(razorpayPaymentId && { razorpayPaymentId }),
                ...(cursor && { cursor }),
                ...(status && { status })
            });

            res.status(200).json({
                success: true,
                data: result
            });

        } catch (err) {
            next(err);
        }
    }

}