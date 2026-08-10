# FIGM Code Inspector — Troubleshooting & FAQ Guide

Common issues, diagnostic steps, and resolution solutions.

---

## 1. Common Issues & Solutions

### Issue A: `JWT_SECRET environment variable is missing in production environment`
- **Cause**: Application launched with `NODE_ENV=production` without setting `JWT_SECRET`.
- **Solution**: Add `JWT_SECRET=your_random_64_char_key` in Vercel environment variables or local `.env`.

### Issue B: `FATAL: sorry, too many clients already`
- **Cause**: Direct connection string used instead of PgBouncer pooler URL in serverless environment.
- **Solution**: Ensure `DATABASE_URL` in `.env` uses port `6543` with `?pgbouncer=true`.

### Issue C: Supabase Disconnected / Falling Back to JSON
- **Cause**: Invalid `NEXT_PUBLIC_SUPABASE_URL` or missing keys in `.env`.
- **Solution**: Verify credentials or run in local JSON mode (`STORAGE_PROVIDER=json`).

---

## 2. Diagnostic Commands

```bash
# Check TypeScript Compilation
npm run build


// hi 









































































# Run Full Test Verification
npm test

# Check Local Health Endpoint
curl http://localhost:3000/api/health
```
