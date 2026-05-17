import { Router } from "express";
import { organizationController } from "../../container";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";

export const organizationRouter = Router();

// Org profile 


organizationRouter.get("/:orgId", authenticatedOrgMiddleware, organizationController.getOrganization,);
organizationRouter.patch("/:orgId", authenticatedOrgMiddleware, organizationController.updateOrganization,);

// Members 
organizationRouter.get("/:orgId/members", authenticatedOrgMiddleware, organizationController.listMembers);
organizationRouter.post("/:orgId/members/invite", authenticatedOrgMiddleware, organizationController.inviteMember);
organizationRouter.patch("/:orgId/members/:memberId/role", authenticatedOrgMiddleware, organizationController.updateMemberRole);
organizationRouter.delete("/:orgId/members/:memberId", authenticatedOrgMiddleware, organizationController.removeMember);

// Public
organizationRouter.post("/invite/accept", organizationController.acceptInvite);
