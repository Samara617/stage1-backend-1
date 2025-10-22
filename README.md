Here’s a drop-in **README.md** you can add to your Stage-1 Backend repo that explains exactly what you changed to make it Stage-1 DevOps-ready, plus how to run it locally, in Docker, and through your `deploy.sh`. Paste this into `README.md` at the root of your backend project.

---

# String Analyzer — Stage 1 Backend → DevOps-Ready

A minimal REST API that analyzes strings (length, palindrome, unique chars, etc.).
This repo has been updated to be **DevOps-ready for Stage-1**: containerized, health-checked, and deployable via a single `deploy.sh` to a remote Ubuntu server with Docker + Nginx.

---

## What changed for Stage-1 DevOps

**TL;DR:** We added containerization and deployment plumbing, without changing core behavior.

* **Dockerized app** with a production-ready `Dockerfile`.
* Optional **`docker-compose.yml`** (for Postgres mode); default is SQLite for quick wins.
* **Health endpoint** (`GET /health`) so the deploy script/Nginx can verify the service.
* **Standard PORT handling** (`process.env.PORT`, default `8080`) to work behind Nginx.
* **Prisma setup (optional)** with **SQLite** by default (works anywhere), Postgres via Compose.
* A **deployment script** (in a sibling repo) that:

  * Installs Docker + Nginx on the server,
  * Builds & runs the container(s),
  * Creates an Nginx reverse proxy on port 80,
  * Validates the app and logs everything.

---

## Repo Structure

```
.
├─ src/
│  ├─ app.js          # Express app (includes /health)
│  └─ server.js       # Boots app; listens on PORT (default 8080)
├─ prisma/
│  └─ schema.prisma   # SQLite by default (easy local + container)
├─ package.json
├─ Dockerfile
├─ docker-compose.yml # (optional) enables Postgres mode
├─ .dockerignore
├─ .env.example
└─ README.md
```

---

## API Quick Start

### Install & run (no Docker)

```bash
# clone & install
npm ci  # or: npm install

# copy env template and adjust if needed
cp .env.example .env

# run (uses PORT=8080 by default)
npm start
```

### Health check

```bash
curl -s http://localhost:8080/health
# → {"ok":true}
```

---

## Docker (Mode A: SQLite — fastest path)

This mode requires **no external DB**. Prisma uses a local SQLite file inside the container/volume.

```bash
# build
docker build -t string-analyzer .

# run (map 8080 on host → 8080 in container)
docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e DATABASE_URL="file:./dev.db" \
  string-analyzer

# verify
curl -s http://localhost:8080/health
```

> If you see Prisma warnings about OpenSSL, this image installs `openssl` to keep Prisma happy.

---

## Docker Compose (Mode B: Postgres — optional)

If you want a real Postgres DB (locally or on the server), use Compose:

```bash
# start both db + app
docker compose up -d --build

# verify
curl -s http://localhost:8080/health
```

**Compose details**

* App listens on `8080`
* DB URI (inside app): `postgresql://analyzer:analyzer@db:5432/analyzer?schema=public`
* On startup, app runs `prisma db push` to create/update schema

---

## Environment Variables

| Variable       | Default         | Notes                                                                        |
| -------------- | --------------- | ---------------------------------------------------------------------------- |
| `PORT`         | `8080`          | App listens here; Nginx proxies 80 → PORT                                    |
| `DATABASE_URL` | `file:./dev.db` | SQLite (Mode A) — for Compose/Postgres, value is set in `docker-compose.yml` |

Copy `.env.example` to `.env` for local runs:

```env
PORT=8080
DATABASE_URL="file:./dev.db"
```

---

## Endpoints (core examples)

* `GET /health` → `{ "ok": true }`
* `POST /strings` → analyzes a string and stores results
  Example:

  ```bash
  curl -s -X POST http://localhost:8080/strings \
    -H "Content-Type: application/json" \
    -d '{"value":"racecar is a level kayak"}'
  ```

---

## Deploying with the Stage-1 DevOps Script

The deployment happens from a **separate repo** that contains `deploy.sh`.
Steps below assume you already have:

* A reachable Ubuntu server (public IP, SSH access),
* Your SSH key,
* A GitHub **Personal Access Token** (PAT) with `repo` read access.

### 1) Run the script locally

```bash
# in the deploy script repo
chmod +x deploy.sh
./deploy.sh
```

### 2) Fill the prompts

* **Git Repository URL**: `https://github.com/<you>/<this-repo>.git`
* **GitHub PAT**: your token
* **Branch**: `main` (or your branch)
* **SSH username**: usually `ubuntu`
* **Server IP**: your VM’s public IP
* **SSH key path**: path to your private key (`~/.ssh/<key>.pem`)
* **Internal port**: `8080`

The script will:

* Install Docker + Nginx on the server if missing,
* Sync this repo,
* Build & run the container (or Compose, if `docker-compose.yml` exists),
* Create an Nginx site that proxies `http://SERVER_IP` → `http://127.0.0.1:8080`,
* Validate and print a log filename.

### 3) Verify

```bash
curl -i http://<SERVER_IP>/health
curl -i http://<SERVER_IP>/
```

Open in a browser: `http://<SERVER_IP>`

---

## Troubleshooting

**Nginx shows default page or 502?**

* Ensure the app actually listens on the port you provided (default 8080).
* Check and reload Nginx:

  ```bash
  sudo nginx -t
  sudo systemctl reload nginx
  ```

**Cannot reach `http://<SERVER_IP>`**

* Open port 80 on your cloud firewall/security group.
* On the VM:

  ```bash
  sudo ufw allow 'Nginx Full'
  sudo ufw status
  ```

**Container not running / crashing**

```bash
docker ps
docker logs <container_name>
```

**Prisma issues**

* Confirm `prisma/schema.prisma` exists.
* Ensure `DATABASE_URL` is set (SQLite or Postgres).
* We run `prisma generate` at build time and `prisma db push` at start (Compose) or you can run:

  ```bash
  npm run prisma:generate
  npm run prisma:push
  ```

---

## Validation Checklist (what reviewers look for)

* App runs in Docker and responds on `/health`.
* `PORT` is respected (reverse-proxies cleanly from Nginx:80 → app:PORT).
* Deploy script completes without manual server edits.
* Re-running the script **redeploys idempotently** (no duplicate networks/containers).
* Logs exist (e.g., `deploy_YYYYMMDD_HHMMSS.log`).

---

## Changelog (DevOps upgrade)

* **Added** `Dockerfile` for Node 20-alpine (+ `openssl`)
* **Added** `docker-compose.yml` (optional Postgres)
* **Added** `GET /health`
* **Standardized** `PORT` handling (default `8080`)
* **Added** Prisma SQLite schema + `.env.example`
* **Documented** Stage-1 DevOps deployment via `deploy.sh`

---

## License

MIT (or your choice)

---
--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------




# String Analyzer API (Stage 1)

A small REST API that analyzes input strings and stores their computed properties.

## Features

* Analyze & store strings (unique by SHA-256).
* Compute:

  * `length`, `is_palindrome` (case-insensitive, ignores spaces),
  * `unique_characters`, `word_count`,
  * `sha256_hash`, and `character_frequency_map`.
* Filtered retrieval via query params and simple natural-language parsing.
* Strict JSON responses with correct HTTP codes.

---

## Tech Stack

* **Runtime:** Node.js (>= 18)
* **Language:** TypeScript
* **Web:** Express
* **ORM:** Prisma
* **DB:** PostgreSQL (Railway)
* **Tests:** Vitest
* **Lint/Format:** ESLint + Prettier

---

## Requirements

* Node.js 18 or 20
* npm
* PostgreSQL database
* Git

---

## Quick Start (Local)

```bash
# 0) clone
git clone https://github.com/<you>/string-analyzer.git
cd string-analyzer

# 1) install deps
npm ci

# 2) env vars (create .env from example)
cp .env.example .env
# edit .env and set DATABASE_URL to a Postgres you can access locally

# 3) generate prisma client & push schema
npm run prisma:push

# 4) dev server
npm run dev
# server listens on PORT (default 8080)
```

Health check:

```bash
curl http://localhost:8080/health
# => {"ok":true}
```

### PowerShell equivalents (Windows)

```powershell
(Invoke-WebRequest -Uri "http://localhost:8080/health").Content
```

---

## Environment Variables

Create `.env` from the example:

```
DATABASE_URL="postgresql://user:password@host:5432/dbname"
PORT=8080
```

* `DATABASE_URL` – required. Postgres connection string.
* `PORT` – optional. Defaults to `8080` if not set.

---

## Install / Scripts

```bash
npm ci                 # install
npm run dev            # dev mode (TSX watch)
npm run build          # compile TS → dist
npm start              # run compiled server
npm test               # run unit tests (Vitest)
npm run prisma:generate
npm run prisma:push
npm run lint           # ESLint
```

---

## API Usage

Base URL (local): `http://localhost:8080`
Base URL (prod): `https://<your-app>.railway.app`

All responses are JSON and include `Content-Type: application/json`.

### 1) Create / Analyze String

**POST** `/strings`
**Body**

```json
{ "value": "string to analyze" }
```

**201 Created**

```json
{
  "id": "sha256_hash_value",
  "value": "string to analyze",
  "properties": {
    "length": 16,
    "is_palindrome": false,
    "unique_characters": 12,
    "word_count": 3,
    "sha256_hash": "abc123...",
    "character_frequency_map": { "s": 2, "t": 3, "r": 2 }
  },
  "created_at": "2025-08-27T10:00:00Z"
}
```

**Errors**

* `409` String already exists
* `400` Invalid body or missing `"value"`
* `422` `"value"` wrong type (must be string)

**cURL**

```bash
curl -s -X POST "$BASE/strings" \
  -H "Content-Type: application/json" \
  -d '{"value":"Race car"}'
```

**PowerShell**

```powershell
(Invoke-WebRequest -Uri "$env:BASE/strings" `
  -Method POST -ContentType "application/json" `
  -Body '{"value":"Race car"}').Content
```

---

### 2) Get Specific String

**GET** `/strings/{string_value}`

**200 OK**

```json
{
  "id": "sha256_hash_value",
  "value": "requested string",
  "properties": { /* same as above */ },
  "created_at": "2025-08-27T10:00:00Z"
}
```

**404** not found

> Note: URL-encode spaces, e.g. `/strings/Race%20car`.

---

### 3) Get All Strings (Filtering)

**GET** `/strings?is_palindrome=true&min_length=5&max_length=20&word_count=2&contains_character=a`

**200 OK**

```json
{
  "data": [ { "id":"...", "value":"...", "properties":{...}, "created_at":"..." } ],
  "count": 15,
  "filters_applied": {
    "is_palindrome": true,
    "min_length": 5,
    "max_length": 20,
    "word_count": 2,
    "contains_character": "a"
  }
}
```

**Query Params**

* `is_palindrome`: boolean (`true|false`)
* `min_length`: integer
* `max_length`: integer
* `word_count`: integer
* `contains_character`: single character

**400** on invalid types (e.g., `contains_character=ab`).

---

### 4) Natural Language Filtering

**GET** `/strings/filter-by-natural-language?query=all%20single%20word%20palindromic%20strings`

**200 OK**

```json
{
  "data": [ /* matches */ ],
  "count": 3,
  "interpreted_query": {
    "original": "all single word palindromic strings",
    "parsed_filters": { "word_count": 1, "is_palindrome": true }
  }
}
```

**Errors**

* `400` Unable to parse query
* `422` Conflicting filters

---

### 5) Delete String

**DELETE** `/strings/{string_value}`

**204 No Content**

**404** not found

---

## Testing Before Submission

Unit tests (Vitest):

```bash
npm test
```

Manual endpoint checks (pick one style):

**cURL**

```bash
BASE=http://localhost:8080

curl -s "$BASE/health"
curl -s -X POST "$BASE/strings" -H "Content-Type: application/json" -d '{"value":"level"}'
curl -s "$BASE/strings/level"
curl -s "$BASE/strings?is_palindrome=true&contains_character=e"
curl -s "$BASE/strings/filter-by-natural-language?query=strings%20longer%20than%2010%20characters"
curl -i -X DELETE "$BASE/strings/level"
```

**PowerShell**

```powershell
$BASE="http://localhost:8080"
(Invoke-WebRequest -Uri "$BASE/health").Content
(Invoke-WebRequest -Uri "$BASE/strings" -Method POST -ContentType "application/json" -Body '{"value":"level"}').Content
(Invoke-WebRequest -Uri "$BASE/strings/level").Content
(Invoke-WebRequest -Uri "$BASE/strings?is_palindrome=true&contains_character=e").Content
(Invoke-WebRequest -Uri "$BASE/strings/filter-by-natural-language?query=strings%20longer%20than%2010%20characters").Content
Invoke-WebRequest -Uri "$BASE/strings/level" -Method DELETE -SkipHttpErrorCheck
```

**What graders look for**

* Correct HTTP codes (`201/409/400/422/404/204`)
* Always JSON with `Content-Type: application/json`
* Field names exactly as spec (`is_palindrome`, `unique_characters`, etc.)
* `id` equals the SHA-256 of `value`

---

## Deployment (Railway)

1. Provision **PostgreSQL** in your Railway project.
2. **Deploy from GitHub** → select this repo.
3. **Variables**: set `DATABASE_URL` (copy from the Postgres plugin).
4. Start command:

   * **Dockerfile** included (no config needed), *or*
   * **Zero-Docker**: `npm run prisma:push && npm run start`
5. Grab the public URL from the service page and test:

   * `https://<your-app>.railway.app/health`

---

## Notes / Design Choices

* Palindrome detection ignores spaces and case: `"Race car"` → `true`.
* Unicode-safe length via spread (`[...value].length`).
* `character_frequency_map` counts every character (including spaces/punctuation).
* `GET /strings/{value}` looks up by exact string value, not by hash, matching the challenge spec.

---

## Troubleshooting

* **409 on create**: already stored; use a different value or delete first.
* **400/422 on create**: ensure the body is exactly `{ "value": "..." }` and type is string.
* **404 on GET/DELETE**: make sure you URL-encoded the value and previously created it.
* **DB errors**: recheck `DATABASE_URL`, run `npm run prisma:push`, and restart.

---

## License

MIT

This README gives you setup, local run, dependencies, env vars, testing steps, API docs, and deploy notes—exactly what the submission requires.
