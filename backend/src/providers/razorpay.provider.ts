import Razorpay from "razorpay";
import crypto  from 'crypto';
import { config } from "../config";

export class RazorpayProvider {

    private client: Razorpay;
    private webhookSecret: string;
    private keyId: string;

    constructor() {
        // .trim() is critical — copy-pasting secrets into .env files
        // often introduces trailing newlines that silently break HMAC verification
        this.keyId = (config.payment.razorpay.keyId ?? "").trim();
        this.webhookSecret = (config.payment.razorpay.webhookSecret ?? "").trim();

        this.client = new Razorpay({
            key_id: this.keyId,
            key_secret: (config.payment.razorpay.keySecret ?? "").trim(),
        });
    }


    // used by FE checkout
    getPublicKey() {
        return this.keyId;
    }

    async createOrder(params: {
        amount: number; // in paise
        currency: string;
        receipt: string;
        notes?: Record<string, string>; 
    }) {

        const order = await this.client.orders.create({
            amount: params.amount,
            currency: params.currency,
            receipt: params.receipt,
            ...(params.notes && { notes: params.notes }),
        });

        return {
            id: order.id,
            amount: order.amount,
            currency: order.currency,
            status: order.status,
        };
    }


    // verify payment signature
    verifyPaymentSignature(params: {
        razorpayOrderId: string;
        razorpayPaymentId: string;
        razorpaySignature: string;
    }): boolean {

        const body = params.razorpayOrderId + "|" + params.razorpayPaymentId;

        const expectedSignature  = crypto
            .createHmac("sha256", config.payment.razorpay.keySecret!)
            .update(body)
            .digest("hex");

        return crypto.timingSafeEqual(
            Buffer.from(expectedSignature),
            Buffer.from(params.razorpaySignature)
        );

    }

    // Verify webhook authenticity
    
    verifyWebhookSignature(
        payload: string,
        signature: string
    ): boolean {
        const expected = crypto
            .createHmac("sha256", this.webhookSecret)
            .update(payload)
            .digest('hex');
        
        return expected === signature;
    }


}