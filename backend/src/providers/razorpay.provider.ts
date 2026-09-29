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


    // Read-only lookups — Razorpay is the source of truth when our webhook-fed
    // state is in doubt (reconciliation, admin "verify payment").
    async fetchPayment(paymentId: string): Promise<RazorpayPaymentEntity> {
        return (await this.client.payments.fetch(paymentId)) as unknown as RazorpayPaymentEntity;
    }

    async fetchOrder(orderId: string): Promise<{ id: string; amount: number; currency: string; receipt?: string; status: string; notes?: Record<string, string> }> {
        return (await this.client.orders.fetch(orderId)) as any;
    }

    async fetchOrderPayments(orderId: string): Promise<RazorpayPaymentEntity[]> {
        const res = await this.client.orders.fetchPayments(orderId);
        return (res.items ?? []) as unknown as RazorpayPaymentEntity[];
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

    async createLinkedAccount(params: any) {
        return this.client.accounts.create(params);
    }

    async createPaymentTransfer(params: {
        razorpayPaymentId: string;
        account: string;
        amount: number;
        currency: string;
        notes?: Record<string, string | number>;
    }) {
        return (this.client.payments as any).transfer(params.razorpayPaymentId, {
            transfers: [
                {
                    account: params.account,
                    amount: params.amount,
                    currency: params.currency,
                    ...(params.notes && { notes: params.notes }),
                },
            ],
        });
    }
}
/** The subset of Razorpay's payment entity we read (webhook payload.payment.entity has the same shape). */
export interface RazorpayPaymentEntity {
    id: string;
    order_id: string;
    amount: number;
    currency: string;
    status: "created" | "authorized" | "captured" | "refunded" | "failed";
    method?: string;
    vpa?: string | null;
    acquirer_data?: { rrn?: string | null; upi_transaction_id?: string | null };
    email?: string;
    contact?: string;
    created_at: number;
    notes?: Record<string, string> | string[];
    error_code?: string | null;
    error_description?: string | null;
    error_reason?: string | null;
}
