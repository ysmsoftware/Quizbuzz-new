import { Router } from "express";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";
import { idempotency } from "../../middlewares/idempotency.middleware";

function ctrl() {
  return require("../../container").payoutController;
}

const payoutRouter = Router();

payoutRouter.post("/setup", authenticatedOrgMiddleware, idempotency, (req, res, next) => ctrl().setupPayoutAccount(req, res, next));
payoutRouter.get("/account", authenticatedOrgMiddleware, (req, res, next) => ctrl().getPayoutAccount(req, res, next));
payoutRouter.patch("/link", authenticatedOrgMiddleware, (req, res, next) => ctrl().attachLinkedAccount(req, res, next));
payoutRouter.get("/transfers", authenticatedOrgMiddleware, (req, res, next) => ctrl().listTransfers(req, res, next));

export default payoutRouter;
