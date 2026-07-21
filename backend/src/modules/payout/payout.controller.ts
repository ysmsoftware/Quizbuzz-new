import { Request, Response, NextFunction } from "express";
import { PayoutService } from "./payout.service";
import { setupPayoutAccountSchema, attachLinkedAccountSchema } from "./payout.validator";
import logger from "../../config/logger";

export class PayoutController {
  constructor(private payoutService: PayoutService) {}

  setupPayoutAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId } = req.user!;
      const input = setupPayoutAccountSchema.parse(req.body);

      logger.info("Setup payout account request", { organizationId, requestId: req.id });

      const result = await this.payoutService.setupPayoutAccount(organizationId, input);

      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  getPayoutAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId } = req.user!;
      logger.info("Get payout account request", { organizationId, requestId: req.id });

      const result = await this.payoutService.getPayoutAccount(organizationId);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  attachLinkedAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId } = req.user!;
      const { razorpayLinkedAccountId } = attachLinkedAccountSchema.parse(req.body);

      logger.info("Attach linked account request", { organizationId, razorpayLinkedAccountId, requestId: req.id });

      const result = await this.payoutService.attachLinkedAccount(organizationId, razorpayLinkedAccountId);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  listTransfers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId } = req.user!;
      logger.info("List payout transfers request", { organizationId, requestId: req.id });

      const result = await this.payoutService.listTransfers(organizationId);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}
