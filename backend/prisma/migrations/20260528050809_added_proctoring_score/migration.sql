-- AddForeignKey
ALTER TABLE "proctoring_scores" ADD CONSTRAINT "proctoring_scores_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proctoring_scores" ADD CONSTRAINT "proctoring_scores_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "contests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
