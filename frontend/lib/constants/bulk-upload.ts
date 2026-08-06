// ============================================
// QuizBuzz Pro — Bulk Question Upload Config
// ============================================
//
// Per engineering guidelines: no hardcoded limits in business logic.
// These are read once, from env, with sane defaults — never re-derive
// or hardcode these numbers anywhere else in the app.
//
// BULK_UPLOAD_MAX_TOTAL mirrors the backend's BULK_IMPORT_LIMIT config
// (backend/src/config/index.ts -> config.questions.bulkImportLimit).
// The backend enforces the real ceiling per request; this just keeps the
// frontend's file-parsing limit in sync so users get a clear error before
// anything is sent over the wire.
//
// BULK_UPLOAD_BATCH_SIZE is the frontend-only chunk size used to split any
// upload (regardless of total size) into sequential batch requests, so a
// single slow/failed request never risks the whole upload.

export const BULK_UPLOAD_BATCH_SIZE = Number(process.env.NEXT_PUBLIC_BULK_UPLOAD_BATCH_SIZE) || 50;

export const BULK_UPLOAD_MAX_TOTAL = Number(process.env.NEXT_PUBLIC_BULK_UPLOAD_MAX_TOTAL) || 500;
