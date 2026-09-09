# SplitFlow

> **Shared expenses, sorted.**
>
> A calm, focused way for friends, flatmates, and travel groups to track shared spending, see equal-share balances, and keep every receipt in one shared room.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![License](https://img.shields.io/badge/license-not%20specified-lightgrey)](#license)

SplitFlow replaces messy group chats and forgotten receipts with one clear activity log. Create a room, invite the group, record expenses, and use the dashboard to understand who paid and what each person’s estimated share looks like.

## Highlights

- **Shared rooms** for trips, homes, projects, or any recurring group expense
- **Invite codes** so members can join the right room quickly
- **Expense tracking** with title, amount, category, payer, and date
- **Dashboard metrics** for total spent, equal-share estimate, and net balance
- **Activity filtering** by expense category
- **Account creation and sign-in** with validation and friendly database errors
- **Demo access** for exploring the dashboard without creating an account
- **Light and dark themes** remembered in the browser
- **Responsive interface** built with plain HTML, CSS, and JavaScript
- **Health endpoint** for checking database connectivity

## Demo Access

Use these credentials on the sign-in screen:

| Field | Demo value |
| --- | --- |
| Email | `demo@splitflow.demo` |
| Password | `SplitFlow123!` |

The SQL seed also includes these sample users:

- `aarav@splitflow.demo`
- `maya@splitflow.demo`

The demo experience is preloaded with a **Weekend in Goa** room, invite code `GOA24X`, and sample expenses. Do not use the demo password or seeded accounts in a public production deployment.

## Tech Stack

### Frontend

- HTML5
- CSS3 with responsive layouts, theme variables, and custom UI components
- Vanilla JavaScript
- Google Fonts: Space Grotesk and DM Mono
- Canvas Confetti for successful expense feedback

### Backend

- Node.js
- Express 4
- CORS middleware
- MySQL connection pooling through `mysql2/promise`
- `bcryptjs` for password hashing
- `jsonwebtoken` for seven-day signed sessions

### Database

MySQL database: `splitflow_db`

The schema is defined in [`database.sql`](database.sql) and contains:

| Table | Purpose |
| --- | --- |
| `users` | Names, unique email addresses, bcrypt password hashes, and account dates |
| `groups_table` | Group names, unique invite codes, creators, and creation dates |
| `group_members` | Many-to-many relationship between users and groups |
| `expenses` | Amounts, titles, categories, payers, groups, and timestamps |

Foreign keys and cascading rules keep memberships and expenses consistent when a group or user is removed.

## Getting Started

### Prerequisites

- Node.js 18 or newer
- MySQL 8 or a compatible MySQL server
- A terminal with access to the project directory

### 1. Install dependencies

```bash
npm install
```

### 2. Create and seed the database

From the project directory, run:

```bash
mysql -u root -p < database.sql
```

This creates `splitflow_db`, its tables, and the sample records used by the demo account.

### 3. Configure environment variables

The app has convenient local defaults, but set these variables explicitly for a real deployment:

```bash
# PowerShell
$env:DB_HOST="localhost"
$env:DB_USER="root"
$env:DB_PASSWORD="your-mysql-password"
$env:DB_NAME="splitflow_db"
$env:JWT_SECRET="replace-with-a-long-random-secret"
$env:NODE_ENV="development"
```

Available configuration:

| Variable | Local default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP server port |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_USER` | `root` | MySQL user |
| `DB_PASSWORD` | empty | MySQL password |
| `DB_NAME` | `splitflow_db` | Database name |
| `JWT_SECRET` | Development fallback only | Secret used to sign login tokens |
| `NODE_ENV` | unset | Set to `production` for production checks |

### 4. Start the app

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Check the database connection at [http://localhost:3000/api/health](http://localhost:3000/api/health). A healthy response is:

```json
{
  "status": "ok",
  "database": "connected"
}
```

## How It Works

1. A visitor can explore the landing page and dashboard preview.
2. A user signs up or uses the demo account.
3. The server returns a signed JWT after successful authentication.
4. The first group is created automatically for a new authenticated user.
5. Users can create additional groups or join an existing group with an invite code.
6. Members add expenses to a group and see the activity log and calculated summary.

Protected API requests use the following header:

```http
Authorization: Bearer <jwt-token>
```

## API Overview

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | No | Check MySQL availability |
| `POST` | `/api/auth/signup` | No | Create an account |
| `POST` | `/api/auth/login` | No | Sign in and receive a JWT |
| `GET` | `/api/group/default` | Yes | Load or create the user’s first group |
| `POST` | `/api/groups` | Yes | Create a group |
| `POST` | `/api/groups/join` | Yes | Join a group using an invite code |
| `GET` | `/api/groups/:groupId` | Yes | Load a group and its members |
| `GET` | `/api/expenses/:groupId` | Yes | List group expenses |
| `POST` | `/api/expenses` | Yes | Add an expense |

## Project Structure

```text
SplitFlow/
├── server.js              # Express server, authentication, groups, and expense APIs
├── database.sql            # MySQL schema and demo seed data
├── package.json            # Scripts and backend dependencies
├── public/
│   ├── index.html          # Landing page and authentication UI
│   ├── dashboard.html      # Expense dashboard
│   ├── how-it-works.html   # Product guidance
│   ├── privacy.html        # Privacy information
│   ├── app.js              # Frontend state, API calls, and interactions
│   ├── config.js           # Frontend API URL override
│   └── style.css           # Shared visual system and responsive styles
└── README.md
```

The root-level HTML, CSS, and JavaScript files mirror the frontend files in `public/`; the Express server serves the `public/` directory.

## Security Notes

- Passwords are stored as bcrypt hashes, never as plain text.
- SQL queries use prepared statements through `mysql2`.
- Protected routes verify JWTs and confirm group membership before returning data.
- Production startup requires `JWT_SECRET` instead of the local development fallback.
- Use a dedicated MySQL user with limited permissions in production rather than `root`.
- Keep `.env` files, database passwords, and production JWT secrets out of source control.
- Rotate the seeded demo credentials before exposing a deployed instance publicly.
- Configure HTTPS and restrict CORS appropriately before production use.

## Current Scope

SplitFlow currently calculates an equal-share estimate from the group total and member count. It does not yet process payments, send settlement requests, upload receipt images, or provide live WebSocket updates.

## License

No license has been specified for this repository yet. Add a license file before distributing or accepting external contributions.
