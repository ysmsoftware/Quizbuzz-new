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
            ambassador?: {
                id: string; // platform-level identity — not scoped to an organization
            };
            id: string;
        }
    }
}

export {}