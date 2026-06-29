import { Router } from "express";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";

function ctrl() { return require("../../container").contactController; }

export const contactRouter = Router();

contactRouter.post("/",                        authenticatedOrgMiddleware, (req, res, next) => ctrl().create(req, res, next));
contactRouter.get("/lookup",                   authenticatedOrgMiddleware, (req, res, next) => ctrl().lookup(req, res, next));
contactRouter.get("/",                         authenticatedOrgMiddleware, (req, res, next) => ctrl().list(req, res, next));
contactRouter.get("/:id",                      authenticatedOrgMiddleware, (req, res, next) => ctrl().getById(req, res, next));
contactRouter.patch("/:id",                    authenticatedOrgMiddleware, (req, res, next) => ctrl().update(req, res, next));
contactRouter.delete("/:id",                   authenticatedOrgMiddleware, (req, res, next) => ctrl().softDelete(req, res, next));
contactRouter.get("/:id/contests",             authenticatedOrgMiddleware, (req, res, next) => ctrl().getContests(req, res, next));
contactRouter.get("/:id/messages",             authenticatedOrgMiddleware, (req, res, next) => ctrl().getMessages(req, res, next));
contactRouter.get("/:id/certificates",         authenticatedOrgMiddleware, (req, res, next) => ctrl().getCertificates(req, res, next));