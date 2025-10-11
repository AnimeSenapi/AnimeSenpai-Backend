# ⚡ Quick Deploy - 3 Commands

Deploy the import script to your server in under 2 minutes!

---

## 🎯 **Super Fast Method**

### From Your Local Machine:

```bash
# 1. Deploy to server (one command!)
cd AnimeSenpai-Backend/scripts
./deploy-to-server.sh your-user@your-server-ip /home/your-user/anime-import

# 2. SSH to server
ssh your-user@your-server-ip

# 3. Run setup
cd anime-import
bash server-setup.sh

# 4. Start import in screen
screen -S anime-import
bun standalone-import.js

# 5. Detach (Ctrl+A then D)
```

**Done!** Import is running. ✅

---

## 🖥️ **Manual Method (If Scripts Don't Work)**

### On Your Local Machine:
```bash
# Copy files
scp AnimeSenpai-Backend/scripts/standalone-import.js user@server:/home/user/
scp AnimeSenpai-Backend/.env user@server:/home/user/
scp AnimeSenpai-Backend/prisma/schema.prisma user@server:/home/user/prisma/
```

### On Your Server:
```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install deps
bun add @prisma/client
bunx prisma generate

# Run
screen -S anime-import
bun standalone-import.js
```

---

## 📊 **Monitor Progress**

```bash
# Check stats
cat import-state.json

# Watch in real-time
watch -n 5 cat import-state.json

# Reattach to see logs
screen -r anime-import
```

---

## 🛑 **Stop Import**

```bash
# Reattach
screen -r anime-import

# Stop gracefully (Ctrl+C)
# It will save all pending data!
```

---

## 💰 **Cheap Server Options**

| Provider | Cost | Setup Time |
|----------|------|------------|
| **DigitalOcean** | $6/month | 5 minutes |
| **Hetzner** | $4/month | 5 minutes |
| **AWS EC2** | Free tier | 10 minutes |
| **Your Laptop** | FREE | 0 minutes |

**Pro Tip:** Use a cheap VPS for 1 week (~$2), then destroy it after import!

---

## ⏱️ **Time Estimates**

- **1,000 anime:** ~11 hours
- **5,000 anime:** ~56 hours (~2.3 days)
- **10,000 anime:** ~111 hours (~4.6 days)

**Recommendation:** Run overnight for 8 hours to get ~720 anime, then decide if you want more.

---

## 🎉 **That's It!**

Three commands and you're importing anime data! The script handles everything else automatically.

Need help? Check `DEPLOY-IMPORT-SERVER.md` for detailed guide.


