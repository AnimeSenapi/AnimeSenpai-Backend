# Prisma Optimize Setup Guide

## ✅ Current Configuration

Prisma Optimize is now properly configured for Prisma 7. Here's what has been set up:

### Environment Variables

1. **OPTIMIZE_API_KEY** - Set in `.env` ✅
2. **ENABLE_PRISMA_OPTIMIZE** - Set to `"true"` in `.env` ✅
3. **DATABASE_URL** - Required for Optimize to work ✅

### Code Configuration

1. **Tracing Initialization** - `src/lib/tracing.ts` is imported first in `src/index.ts` ✅
2. **Optimize Extension** - Configured in `src/lib/db.ts` ✅
3. **Extension Order** - Optimize is applied before Accelerate (correct order) ✅

## 🚀 How to Use Optimize

### 1. Start Your Dev Server

```bash
bun dev
```

Look for this message in the startup logs:
```
✅ Optimize extension loaded successfully
```

### 2. Start Recording in Optimize Dashboard

1. Go to https://optimize.prisma.io
2. Click **"Start Recording"** (important: do this BEFORE executing queries)
3. The button should show that recording is active

### 3. Execute Queries

While recording is active, execute queries using your application or run:

```bash
bun run test:optimize
```

### 4. Stop Recording and View Results

1. Click **"Stop Recording"** in the dashboard
2. View your queries and optimization suggestions

## 🔍 Verification Scripts

### Check Configuration

```bash
bun run verify:optimize
```

### Test Optimize Connection

```bash
bun run test:optimize
```

### Setup Helper

```bash
bun run setup:optimize
```

## ⚠️ Important Notes

### Prisma 7 Compatibility

- Optimize extension requires `DATABASE_URL` to be available when the extension is initialized
- In Prisma 7, `DATABASE_URL` is not in the schema file - it must be provided via environment variables
- The extension will work correctly when the server starts normally (via `bun dev`)
- Test scripts may show errors if environment variables aren't loaded before importing `db.ts`

### Extension Order

The correct order for extensions is:
1. **Optimize** (requires tracing instrumentation)
2. **Accelerate** (can be applied after Optimize)

This order is already configured in `src/lib/db.ts`.

### Tracing Requirement

Optimize requires OpenTelemetry tracing to be initialized. This is handled by:
- `src/lib/tracing.ts` - Initializes Prisma instrumentation
- `src/index.ts` - Imports tracing first (line 1)

## 🐛 Troubleshooting

### Optimize Extension Not Loading

1. Check that `ENABLE_PRISMA_OPTIMIZE="true"` is set in `.env`
2. Check that `OPTIMIZE_API_KEY` is set in `.env`
3. Restart your dev server after changing environment variables
4. Look for error messages in the startup logs

### DATABASE_URL Error

If you see "Environment variable not found: DATABASE_URL":
- Make sure `.env` file exists and contains `DATABASE_URL`
- Restart your dev server
- This error may appear in test scripts but should not occur when running `bun dev`

### No Queries Appearing in Dashboard

1. Make sure you clicked "Start Recording" BEFORE executing queries
2. Check that Optimize extension loaded successfully (look for ✅ message)
3. Verify tracing is initialized (should be automatic)
4. Try running `bun run test:optimize` while recording

## 📚 Additional Resources

- [Prisma Optimize Documentation](https://www.prisma.io/docs/orm/prisma-optimize)
- [Optimize Dashboard](https://optimize.prisma.io)
- [Console (Get API Key)](https://console.prisma.io/optimize)

