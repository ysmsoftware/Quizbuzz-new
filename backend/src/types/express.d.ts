declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string
                organizationId: string
            };
            participant?: {
                id: string;
                contestId: string;
                organizationId: string;
            };
            id: string;
        }
    }
}

export {}