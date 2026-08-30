import { Router } from "express";
import { opsMetricsAuthMiddleware } from "../../middlewares/ops-metrics-auth.middleware";

export const opsMetricsRouter = Router();

opsMetricsRouter.use(opsMetricsAuthMiddleware);

// Lazy-load the controller, same reasoning as organization.routes.ts:
// this file is imported by routes.ts -> app.ts, which container.ts also
// touches, so resolving the controller at request time (not module-eval
// time) avoids the circular-import crash.
function ctrl() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("../../container").opsMetricsController;
}

// GET /api/v1/ops/metrics/fleet — every reporting instance's latest heartbeat
opsMetricsRouter.get("/fleet", (req, res, next) => ctrl().getFleet(req, res, next));

// GET /api/v1/ops/metrics/contests — contests currently LIVE / REGISTRATION_CLOSED
opsMetricsRouter.get("/contests", (req, res, next) => ctrl().listContests(req, res, next));

// GET /api/v1/ops/metrics/contests/:contestId — live Redis snapshot for one contest
opsMetricsRouter.get("/contests/:contestId", (req, res, next) => ctrl().getContestSnapshot(req, res, next));
