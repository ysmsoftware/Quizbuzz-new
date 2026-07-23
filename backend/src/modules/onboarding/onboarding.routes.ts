import { Router } from "express";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";

export const onboardingRouter = Router();

// Lazy-load controller to avoid circular-import crashes during worker init
// (same pattern used by organization.routes.ts and every other module)
function ctrl() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("../../container").onboardingController as import("./onboarding.controller").OnboardingController;
}

// All onboarding routes require an authenticated org session
onboardingRouter.get(  "/status",      authenticatedOrgMiddleware, (req, res, next) => ctrl().getStatus(req, res, next));
onboardingRouter.patch("/step/:step",  authenticatedOrgMiddleware, (req, res, next) => ctrl().saveStep(req, res, next));
onboardingRouter.post( "/complete",    authenticatedOrgMiddleware, (req, res, next) => ctrl().complete(req, res, next));
onboardingRouter.get(  "/plans",       authenticatedOrgMiddleware, (req, res, next) => ctrl().getPlans(req, res, next));
onboardingRouter.post( "/handoff",     authenticatedOrgMiddleware, (req, res, next) => ctrl().createHandoff(req, res, next));
