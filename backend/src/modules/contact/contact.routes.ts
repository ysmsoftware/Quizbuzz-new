import { Router } from "express";
import { contactController } from "../../container";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";

export const contactRouter = Router();

contactRouter.post("/", authenticatedOrgMiddleware, contactController.create);
contactRouter.get("/lookup", authenticatedOrgMiddleware, contactController.lookup);
contactRouter.get("/", authenticatedOrgMiddleware, contactController.list);
contactRouter.get("/:id", authenticatedOrgMiddleware, contactController.getById);
contactRouter.patch("/:id", authenticatedOrgMiddleware, contactController.update);
contactRouter.delete("/:id", authenticatedOrgMiddleware, contactController.softDelete);
contactRouter.get("/:id/contests", authenticatedOrgMiddleware, contactController.getContests);
contactRouter.get("/:id/messages", authenticatedOrgMiddleware, contactController.getMessages);
contactRouter.get("/:id/certificates", authenticatedOrgMiddleware, contactController.getCertificates);