import { Router } from "express";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";

function ctrl() { return require("../../container").certificateTemplateController; }

const certificateTemplateRouter = Router();

certificateTemplateRouter.use(authenticatedOrgMiddleware);

certificateTemplateRouter.post("/preview", (req, res, next) => ctrl().preview(req, res, next));
certificateTemplateRouter.post("/",        (req, res, next) => ctrl().create(req, res, next));
certificateTemplateRouter.get("/",         (req, res, next) => ctrl().list(req, res, next));
certificateTemplateRouter.get("/:id",      (req, res, next) => ctrl().getById(req, res, next));
certificateTemplateRouter.patch("/:id",    (req, res, next) => ctrl().update(req, res, next));
certificateTemplateRouter.delete("/:id",   (req, res, next) => ctrl().remove(req, res, next));
certificateTemplateRouter.post("/:id/test-generate", (req, res, next) => ctrl().testGenerate(req, res, next));

export { certificateTemplateRouter };
