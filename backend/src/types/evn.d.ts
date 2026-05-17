declare namespace NodeJS {
    interface ProcessEnv {
        DOMAIN: string;
        BASE_URL: string;
        PORT: string;
        NODE_ENV: "development" | "production" | "test";
        ALLOWED_ORIGINS:string;
        JWT_ACCESS_SECRET: string;
        JWT_REFRESH_SECRET: string;
        DATABASE_URL: string;
        FILE_STORAGE_DRIVER: "local" | "s3";
        LOCAL_PUBLIC_URL: string;
        DEBUG: string;
        REDIS_HOST: string;
        REDIS_PORT: string;
        REDIS_PASSWORD?: string;
        AWS_REGION: string;
        AWS_ACCESS_KEY_ID: string;
        AWS_SECRET_ACCESS_KEY: string;
        AWS_S3_BUCKET: string;
        AWS_PUBLIC_URL: string;
        RAZORPAY_KEY_ID: string;
        RAZORPAY_KEY_SECRET: string;
        RAZORPAY_WEBHOOK_SECRET?: string;
        SMTP_HOST: string;
        SMTP_PORT: string;
        SMTP_USER: string;
        SMTP_PASS: string;
        WHATSAPP_OTP_API_URL: string;
        WHATSAPP_OTP_API_KEY: string;
    }
}
