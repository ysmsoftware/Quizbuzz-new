# QuizBuzz Backend

Comprehensive quiz platform backend with real-time proctoring, automated evaluation, and messaging.

## 📚 Documentation

- [🚀 Master API Reference](./docs/API_REFERENCE.md) - Overview of all routes.
- [🔐 Detailed Module Guides](./docs/) - Deep dives into each functional area.
- [Database Schema](./prisma/schema.prisma) - Prisma ORM model definitions.

## 🛠️ Technology Stack

- **Framework**: Express (Node.js) with TypeScript
- **Database**: PostgreSQL (via Prisma)
- **Caching & Queues**: Redis (BullMQ)
- **Real-time**: Socket.IO
- **Payments**: Razorpay
- **Validation**: Zod

## 🚀 Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Environment Setup**:
    Copy `.env.example` to `.env` and fill in the required values (Database URL, Redis URL, Razorpay Keys, etc.).

3.  **Run Migrations**:
    ```bash
    npx prisma migrate dev
    ```

4.  **Start Development Server**:
    ```bash
    npm run dev
    ```

## 🏗️ Architecture

The project follows a modular architecture:
- `src/modules`: Domain-specific logic (Contest, Quiz, Auth, etc.).
- `src/middlewares`: Shared security and utility middlewares.
- `src/container.ts`: Inversion of Control (IoC) container for dependency injection.
