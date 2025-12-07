# SaaS Boilerplate

Production-ready SaaS starter with React, Express, Stripe subscriptions, and AI chat.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + React Router |
| Backend | Express.js |
| Database | PostgreSQL (prod) / SQLite (dev) |
| Auth | Clerk |
| Payments | Stripe |
| AI | Claude, GPT-4, Gemini |

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Initialize database
node server/db/init.js

# Start development
npm run dev
```

## Project Structure

```
├── src/                  # React frontend
│   ├── App.js           # Routes and main app
│   ├── index.js         # Entry point
│   └── index.css        # Global styles
├── server/
│   ├── server.js        # Express app
│   ├── db/
│   │   ├── database.js  # DB abstraction (Postgres/SQLite)
│   │   └── init.js      # Schema initialization
│   ├── middleware/
│   │   └── auth.js      # Clerk auth middleware
│   ├── routes/
│   │   ├── authRoutes.js    # Auth endpoints
│   │   ├── chatRoutes.js    # AI chat endpoints
│   │   └── stripeRoutes.js  # Subscription endpoints
│   └── services/
│       └── aiRouter.js  # Multi-provider AI routing
└── package.json
```

## Deployment

**Frontend:** Deploy `src/` to Vercel
**Backend:** Deploy `server/` to Render
**Database:** Railway PostgreSQL

## Environment Variables

See `.env.example` for all required variables.

## License

MIT
