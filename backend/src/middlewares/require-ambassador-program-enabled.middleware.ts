import { Request, Response, NextFunction } from "express";
import { isFeatureEnabled } from "../common/feature-flags";
import { NotFoundError } from "../error/http-errors";

/**
 * Gate for every /org/ambassadors* route. A disabled flag returns a plain
 * 404 (never 403) so there's no signal the feature exists at all for orgs it
 * hasn't been enabled for — per the plan doc's "no signal the feature
 * exists" requirement, same posture as feature-flags.ts's other gated
 * surfaces. Mounted once per router (see ambassador-campaign.routes.ts),
 * not repeated per handler.
 */
export const requireAmbassadorProgramEnabled = async (
    req: Request,
    _res: Response,
    next: NextFunction,
) => {
    try {
        const organizationId = req.user?.organizationId;
        const enabled = await isFeatureEnabled(
            "ambassador_program_enabled",
            organizationId ? { organizationId } : undefined,
        );
        if (!enabled) {
            throw new NotFoundError("Not found");
        }
        next();
    } catch (err) {
        next(err);
    }
};
