# Q-Commerce Store (React + Vite)

## Environment Variables

Create a `.env.local` file (see `.env.example`) with:

Frontend-safe (Vite):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_CHAT_API_URL`
- `VITE_ORDERS_API_URL`
- `VITE_ADMIN_API_URL`
- `VITE_RECOMMENDATIONS_API_URL`

Backend-only (Node/Express):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MEILISEARCH_URL`
- `MEILISEARCH_API_KEY`
- `MEILISEARCH_INDEX`
- `LMSTUDIO_BASE_URL`
- `LMSTUDIO_CHAT_MODEL`
- `LMSTUDIO_EMBEDDING_MODEL`

## Development

```bash
npm install
npm run dev
```

In another terminal:

```bash
npm run server
```

## Build

```bash
npm run build
```
