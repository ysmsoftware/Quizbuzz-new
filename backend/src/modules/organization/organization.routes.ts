import { Router } from "express";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";

export const organizationRouter = Router();

// Lazy-load the controller so this routes file can be safely imported in the
// worker process context without triggering a circular-import crash.
// organization.routes.ts is loaded as part of routes.ts → app.ts, which
// container.ts also eventually touches. Accessing organizationController at
// module evaluation time (before container.ts finishes) causes:
//   TypeError: Cannot read properties of undefined (reading 'getOrganization')
// Wrapping each handler in an arrow function defers the lookup until the
// first actual HTTP request, by which time container.ts is fully initialised.
function ctrl() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("../../container").organizationController;
}

// Org profile
organizationRouter.get("/:orgId",                          authenticatedOrgMiddleware, (req, res, next) => ctrl().getOrganization(req, res, next));
organizationRouter.patch("/:orgId",                        authenticatedOrgMiddleware, (req, res, next) => ctrl().updateOrganization(req, res, next));
organizationRouter.patch("/:orgId/profile",                authenticatedOrgMiddleware, (req, res, next) => ctrl().updateOrganizationProfile(req, res, next));

// Members
organizationRouter.get("/:orgId/members",                  authenticatedOrgMiddleware, (req, res, next) => ctrl().listMembers(req, res, next));
organizationRouter.post("/:orgId/members/invite",          authenticatedOrgMiddleware, (req, res, next) => ctrl().inviteMember(req, res, next));
organizationRouter.patch("/:orgId/members/:memberId/role", authenticatedOrgMiddleware, (req, res, next) => ctrl().updateMemberRole(req, res, next));
organizationRouter.delete("/:orgId/members/:memberId",     authenticatedOrgMiddleware, (req, res, next) => ctrl().removeMember(req, res, next));

// Public
organizationRouter.post("/invite/accept", (req, res, next) => ctrl().acceptInvite(req, res, next));
