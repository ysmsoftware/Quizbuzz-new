import { z } from "zod";

export const updateNotificationPreferencesSchema = z.object({
    preferences: z
        .array(z.object({ type: z.string().min(1).max(100), email: z.boolean() }))
        .min(1)
        .max(50),
});
