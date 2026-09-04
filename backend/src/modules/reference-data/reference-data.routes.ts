import { Router, Request, Response, NextFunction } from "express";
import { getAllActiveColleges, getDepartmentsForCollege } from "../../common/colleges";

// Public, unauthenticated — contest registration and ambassador signup are both anonymous
// flows, same reasoning as ambassadorPublicRouter. Thin passthrough to the cached common/colleges.ts
// reader: no controller/service/repository trio needed for two GETs with no mutation surface here.
export const referenceDataRouter = Router();

referenceDataRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const colleges = await getAllActiveColleges();
        res.status(200).json({ success: true, data: colleges, requestId: req.id });
    } catch (err) {
        next(err);
    }
});

referenceDataRouter.get("/:collegeId/departments", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const departments = await getDepartmentsForCollege(req.params.collegeId as string);
        res.status(200).json({ success: true, data: departments, requestId: req.id });
    } catch (err) {
        next(err);
    }
});
