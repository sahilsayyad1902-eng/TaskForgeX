# TaskForgeX — HTML, CSS, JavaScript, Node.js, MySQL

Beginner-friendly full-stack **Trello-like Kanban board** with a dark, Codolio-inspired workspace. Tasks appear as cards in **To do**, **In progress**, and **Done** columns. Drag a card between columns to update its status; the status picker on each card also works on touch screens. The Home view includes task stats, an activity heatmap, and upcoming due dates. The workspace has an interactive monthly calendar, notifications, theme switch, profile editor, and feedback form. The browser app is plain HTML/CSS/JavaScript, the API is Node.js + Express, and data lives in MySQL. User passwords are hashed; API routes use short-lived bearer tokens; every task query is scoped to its signed-in owner.

## Project structure

```text
task-tracker-fullstack/
├── .github/workflows/pages.yml   # Auto-publish frontend on GitHub Pages
├── frontend/
│   ├── index.html                # Sign-in/register + task dashboard
│   ├── styles.css                # Responsive layout and styling
│   ├── app.js                    # Browser UI and API calls
│   ├── config.js                 # API URL (local first, change after deploy)
│   ├── favicon.png               # TaskForgeX browser/search icon
│   ├── robots.txt                # Allow search crawlers
│   └── .nojekyll
├── backend/
│   ├── src/
│   │   ├── server.js             # Express app, CORS, security headers, rate limit
│   │   ├── db.js                 # MySQL connection pool
│   │   ├── initDb.js             # Creates tables on API startup
│   │   ├── middleware/auth.js    # JWT authentication
│   │   └── routes/               # Auth, profile, feedback and task endpoints
│   ├── .env.example
│   └── package.json
├── database/
│   └── schema.sql                # MySQL database and table definitions
└── README.md
```

## Run it on your computer

### 1. Install tools

Install Node.js 20+ and MySQL 8+. Start the MySQL server. In MySQL Workbench (or the MySQL command line), open and run `database/schema.sql`. It creates a local database called `task_tracker`. The API also creates missing tables when it starts.

### 2. Configure the API

Open PowerShell in the project folder:

```powershell
cd "C:\path\to\task-tracker-fullstack\backend"
Copy-Item .env.example .env
notepad .env
```

Update `DB_USER` and `DB_PASSWORD` to match your local MySQL account. Change `JWT_SECRET` to a long random value (at least 32 characters). Keep `.env` private; it is ignored by Git.

Install dependencies and start the API:

```powershell
npm install
npm run dev
```

The local API listens at `http://localhost:4000`. The `GET /api/health` endpoint should return `{"status":"ok","database":"connected"}`.

### 3. Open the frontend

In a second terminal, from the project root, serve the static frontend:

```powershell
python -m http.server 5500 --directory frontend
```

Open `http://127.0.0.1:5500`. `frontend/config.js` already points to the local API. Register an account and create tasks.

## Push the project to GitHub

1. Create a new GitHub repository, for example `task-tracker-fullstack`. For the easiest free Pages setup, make it public. Do not initialize the repo with an extra README.
2. In PowerShell, open the project root (the folder containing `frontend`, `backend`, and `.github`) and run these commands. Replace `YOUR-USERNAME` with your GitHub username:

   ```powershell
   git init
   git add .
   git commit -m "Build HTML CSS JS task tracker with MySQL API"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/task-tracker-fullstack.git
   git push -u origin main
   ```

   If `git init` says the repository is already initialized, skip that command. If GitHub asks you to sign in, finish its browser authorization.

## Publish the frontend on GitHub Pages

1. On GitHub, open the repository → **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Open **Actions** and wait for **Publish frontend to GitHub Pages** to finish successfully.
4. Open the deployed URL, usually `https://YOUR-USERNAME.github.io/task-tracker-fullstack/`.

GitHub Pages serves only the static HTML, CSS, and browser JavaScript. It does not run the Express backend or MySQL, so those are deployed separately.

## Deploy the API and MySQL on Railway

1. Create a Railway project and add a **MySQL** database service.
2. Add a service from your GitHub repository and connect this same repo.
3. In the API service settings, set the **Root Directory** to `/backend` and the start command to `npm start` if it is not detected automatically.
4. In the API service **Variables**, add:

   ```text
   NODE_ENV=production
   JWT_SECRET=<a new random string, at least 32 characters>
   FRONTEND_ORIGIN=https://YOUR-USERNAME.github.io
   DB_HOST=${{MySQL.MYSQLHOST}}
   DB_PORT=${{MySQL.MYSQLPORT}}
   DB_USER=${{MySQL.MYSQLUSER}}
   DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
   DB_NAME=${{MySQL.MYSQLDATABASE}}
   ```

   Use Railway's variable-reference picker to select the MySQL service variables. If you named your database service something other than `MySQL`, select that service in the picker. Do not set `PORT`; Railway supplies it. Never put MySQL credentials or `JWT_SECRET` in frontend files or GitHub.
5. Deploy the API, then use its generated public domain. Open `https://YOUR-API-DOMAIN/api/health`; once Railway has initialized the database it should report `database: connected`.
6. In `frontend/config.js`, replace the local API URL with the deployed API URL plus `/api`, for example:

   ```js
   window.TASK_API_URL = "https://YOUR-API-DOMAIN/api";
   ```

7. Commit and push that change. GitHub Actions republishes the frontend; Railway automatically redeploys the API when backend files change.
8. Reload your GitHub Pages URL and test registration, sign-in, task creation, status change, search, and deletion.

## API routes

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | API and database health |
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/login` | Sign in and receive a token |
| `GET` | `/api/auth/me` | Get the current user (auth required) |
| `GET` | `/api/tasks` | List the signed-in user's tasks |
| `POST` | `/api/tasks` | Create a task |
| `PATCH` | `/api/tasks/:id` | Update task fields/status (Kanban card move) |
| `DELETE` | `/api/tasks/:id` | Delete a task |

The API applies prepared SQL parameters and checks `user_id` on task reads, changes, and deletes. Passwords are stored as bcrypt hashes. The browser keeps the login token only in `sessionStorage` for the current tab session.
