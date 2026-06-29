import { Router } from "express";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";

function ctrl() { return require("../../container").questionController; }

export const questionRouter = Router();

questionRouter.get("/",         authenticatedOrgMiddleware, (req, res, next) => ctrl().listQuestions(req, res, next));
questionRouter.post("/",        authenticatedOrgMiddleware, (req, res, next) => ctrl().createQuestion(req, res, next));
questionRouter.post("/bulk",    authenticatedOrgMiddleware, (req, res, next) => ctrl().bulkCreateQuestions(req, res, next));
questionRouter.get("/tags",     authenticatedOrgMiddleware, (req, res, next) => ctrl().getDistinctTags(req, res, next));
questionRouter.get("/:questionId",    authenticatedOrgMiddleware, (req, res, next) => ctrl().getQuestion(req, res, next));
questionRouter.patch("/:questionId",  authenticatedOrgMiddleware, (req, res, next) => ctrl().updateQuestion(req, res, next));
questionRouter.delete("/:questionId", authenticatedOrgMiddleware, (req, res, next) => ctrl().deleteQuestion(req, res, next));

// Contest–Question Assignment
questionRouter.get("/contests/:contestId/questions",                   authenticatedOrgMiddleware, (req, res, next) => ctrl().getContestQuestions(req, res, next));
questionRouter.post("/contests/:contestId/assign-questions",           authenticatedOrgMiddleware, (req, res, next) => ctrl().assignQuestionsToContest(req, res, next));
questionRouter.post("/contests/:contestId/auto-generate",             authenticatedOrgMiddleware, (req, res, next) => ctrl().autoGenerateQuestions(req, res, next));
questionRouter.delete("/contests/:contestId/questions/:questionId",    authenticatedOrgMiddleware, (req, res, next) => ctrl().removeQuestionFromContest(req, res, next));
questionRouter.patch("/contests/:contestId/questions/:questionId",     authenticatedOrgMiddleware, (req, res, next) => ctrl().updateContestQuestion(req, res, next));
