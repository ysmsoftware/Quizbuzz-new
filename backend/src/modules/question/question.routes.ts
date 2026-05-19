import { Router } from "express";
import { questionController } from "../../container";
import { authenticatedOrgMiddleware } from "../../middlewares/authenticated-org.middleware";

export const questionRouter = Router();


questionRouter.get("/", authenticatedOrgMiddleware, questionController.listQuestions);
questionRouter.post("/", authenticatedOrgMiddleware, questionController.createQuestion);
questionRouter.post("/bulk", authenticatedOrgMiddleware, questionController.bulkCreateQuestions);
questionRouter.get("/tags", authenticatedOrgMiddleware, questionController.getDistinctTags);
questionRouter.get("/:questionId", authenticatedOrgMiddleware, questionController.getQuestion);
questionRouter.patch("/:questionId", authenticatedOrgMiddleware, questionController.updateQuestion);

questionRouter.delete("/:questionId", authenticatedOrgMiddleware, questionController.deleteQuestion);

// ─── Contest–Question Assignment ───────────────────────────────────────────
questionRouter.get("/contests/:contestId/questions", authenticatedOrgMiddleware, questionController.getContestQuestions);
questionRouter.post("/contests/:contestId/assign-questions", authenticatedOrgMiddleware, questionController.assignQuestionsToContest);
questionRouter.post("/contests/:contestId/auto-generate", authenticatedOrgMiddleware, questionController.autoGenerateQuestions);
questionRouter.delete("/contests/:contestId/questions/:questionId", authenticatedOrgMiddleware, questionController.removeQuestionFromContest);
questionRouter.patch("/contests/:contestId/questions/:questionId", authenticatedOrgMiddleware, questionController.updateContestQuestion);

