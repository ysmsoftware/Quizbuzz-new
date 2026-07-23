import { Request, Response, NextFunction } from "express";
import { OnboardingService } from "./onboarding.service";

export class OnboardingController {
    constructor(private readonly service: OnboardingService) {}

    // GET /onboarding/status
    getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const adminId = req.user!.id;
            const orgId   = req.user!.organizationId;

            const status = await this.service.getStatus(adminId, orgId);
            res.json({ success: true, data: status });
        } catch (err) {
            next(err);
        }
    };

    // PATCH /onboarding/step/:step
    saveStep = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const adminId  = req.user!.id;
            const orgId    = req.user!.organizationId;
            const stepName = String(req.params.step);

            await this.service.saveStep(adminId, orgId, stepName, req.body);
            res.json({ success: true, message: `Step ${stepName} saved` });
        } catch (err) {
            next(err);
        }
    };

    // POST /onboarding/complete
    complete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const adminId = req.user!.id;
            const orgId   = req.user!.organizationId;

            await this.service.complete(adminId, orgId);
            res.json({ success: true, message: "Onboarding completed" });
        } catch (err) {
            next(err);
        }
    };

    // GET /onboarding/plans
    getPlans = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const plans = await this.service.getPlans();
            res.json({ success: true, data: plans });
        } catch (err) {
            next(err);
        }
    };

    // POST /onboarding/handoff
    createHandoff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const adminId  = req.user!.id;
            const orgId    = req.user!.organizationId;
            const planSlug = String(req.body.planSlug || "starter-test");

            const handoff = await this.service.createHandoffToken(adminId, orgId, planSlug);
            res.json({ success: true, data: handoff });
        } catch (err) {
            next(err);
        }
    };
}
