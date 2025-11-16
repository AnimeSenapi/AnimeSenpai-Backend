# Prisma Optimize Troubleshooting Guide

## Current Status
- ✅ Optimize extension is loading successfully
- ✅ API key is configured
- ✅ Extension order is correct (Optimize before Accelerate)
- ⚠️  Queries are not appearing in dashboard

## Critical Steps to Get Data in Optimize Dashboard

### Step 1: Verify Extension is Loaded
When you start your server, you should see:
```
✅ Prisma Optimize: ENABLED - Query analysis active
   ✅ Optimize extension loaded successfully
```

### Step 2: Start Recording FIRST (Most Important!)
**This is the #1 reason queries don't appear!**

1. Go to https://optimize.prisma.io
2. Make sure you're logged in
3. **Click "Start Recording"** - The button should show "Recording..." or similar
4. **DO NOT execute queries before starting recording!**

### Step 3: Execute Queries While Recording
While recording is active, execute queries:

**Option A: Use the test script**
```bash
bun run test:optimize
```

**Option B: Use your application**
- Make API calls
- Navigate pages
- Trigger database queries

**Option C: Make a simple query**
```typescript
import { db } from './src/lib/db'
await db.user.count()
await db.genre.findMany({ take: 5 })
```

### Step 4: Stop Recording
1. Go back to https://optimize.prisma.io
2. Click "Stop Recording"
3. Wait a few seconds for processing
4. View your queries

## Common Issues & Solutions

### Issue: "Nothing is being recorded"

**Solution:**
1. ✅ Check that recording is ACTIVE before executing queries
2. ✅ Verify you see "✅ Optimize extension loaded successfully" in server logs
3. ✅ Make sure API key matches the project in the dashboard
4. ✅ Check server console for any Optimize errors

### Issue: "HTTP 409 Conflict: There is no active recording"

**Solution:**
- This means queries are being sent but no recording session is active
- **Start recording BEFORE executing queries**

### Issue: "Extension order error"

**Solution:**
- Already fixed - Optimize is applied BEFORE Accelerate
- This is critical for proper query tracking

### Issue: "Prisma 6.x compatibility"

**Solution:**
- We're using Prisma Client 6.18.0
- Optimize extension 2.0.0 should work
- If issues persist, consider downgrading to Prisma 5.x

## Testing Checklist

Run this to verify everything works:

```bash
# 1. Check configuration
bun run check:prisma

# 2. Start your server
bun dev

# 3. Look for Optimize messages in console

# 4. Go to https://optimize.prisma.io and START RECORDING

# 5. Run test script (while recording is active)
bun run test:optimize

# 6. Go back to dashboard and STOP RECORDING

# 7. Check dashboard for queries
```

## Debug Information

If still not working, check:

1. **Server Logs:**
   - Look for "✅ Optimize extension loaded successfully"
   - Look for any error messages from Optimize

2. **Network Tab:**
   - Check if requests are being sent to Optimize API
   - Look for any 409 or 401 errors

3. **API Key:**
   - Verify it's correct in .env
   - Make sure it matches the project in dashboard
   - Check if it has expired

4. **Recording Status:**
   - Make absolutely sure recording is ACTIVE before queries
   - The dashboard should show "Recording..." status

## Still Not Working?

1. Check Prisma Discord: https://discord.gg/prisma
2. Check Optimize GitHub issues
3. Try with a minimal example (just Optimize, no Accelerate)
4. Consider downgrading to Prisma 5.x if Prisma 6.x is causing issues

