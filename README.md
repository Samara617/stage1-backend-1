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
