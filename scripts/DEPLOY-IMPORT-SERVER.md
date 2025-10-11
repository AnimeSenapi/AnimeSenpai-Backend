# 🚀 Deploy Import Script to Your Own Server

This guide helps you run the `standalone-import.js` script on your own server (separate from Vercel backend).

---

## 📋 **Prerequisites**

✅ Your own server (VPS, cloud instance, or local machine)  
✅ SSH access to your server  
✅ Your production `DATABASE_URL`  

**Recommended Providers:**
- DigitalOcean ($6/month droplet)
- AWS EC2 (free tier)
- Google Cloud (free tier)
- Hetzner ($4/month)
- Your local machine (free!)

---

## 🎯 **Quick Start (3 Steps)**

### **Step 1: Prepare Your Server**

SSH into your server:
```bash
ssh your-username@your-server-ip
```

Install Bun:
```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
```

Verify:
```bash
bun --version
```

---

### **Step 2: Upload Files**

**Option A: Direct Copy (Easiest)**
From your local machine:
```bash
# Copy just the import script
scp AnimeSenpai-Backend/scripts/standalone-import.js your-username@your-server:/home/your-username/

# Copy your .env file (with DATABASE_URL)
scp AnimeSenpai-Backend/.env your-username@your-server:/home/your-username/
```

**Option B: Git Clone**
On your server:
```bash
git clone https://github.com/AnimeSenapi/AnimeSenpai-Backend.git
cd AnimeSenpai-Backend
```

Then create `.env`:
```bash
nano .env
```

Add:
```env
DATABASE_URL="your-production-database-url"
```

---

### **Step 3: Install Dependencies & Run**

On your server:
```bash
# Install Prisma only (all we need!)
bun add @prisma/client

# Generate Prisma Client
bunx prisma generate

# Make script executable
chmod +x standalone-import.js

# Run in background with screen (recommended)
screen -S anime-import
bun standalone-import.js

# Detach from screen: Press Ctrl+A then D
```

**Done!** The import is now running in the background. ✅

---

## 🖥️ **Screen Session Management**

Screen keeps the script running even after you disconnect.

### Start a New Session:
```bash
screen -S anime-import
bun standalone-import.js
```

### Detach (Leave it Running):
Press: `Ctrl+A` then `D`

### Reattach (Check Progress):
```bash
screen -r anime-import
```

### Stop the Import:
```bash
screen -r anime-import
# Press Ctrl+C (graceful shutdown)
```

### List All Sessions:
```bash
screen -ls
```

---

## 📊 **Monitor Progress**

### Check Stats File:
```bash
cat import-state.json
```

### Watch Stats in Real-Time:
```bash
watch -n 5 cat import-state.json
```

### Check Health:
```bash
cat import-health.json
```

### View Live Logs:
```bash
screen -r anime-import
# Ctrl+A then D to detach
```

---

## 🔄 **Running 24/7**

### Option 1: Screen (Simple)
```bash
screen -S anime-import
bun standalone-import.js
# Detach: Ctrl+A then D
```

### Option 2: systemd Service (Advanced)

Create service file:
```bash
sudo nano /etc/systemd/system/anime-import.service
```

Add:
```ini
[Unit]
Description=AnimeSenpai Import Script
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/home/your-username
ExecStart=/home/your-username/.bun/bin/bun standalone-import.js
Restart=on-failure
RestartSec=10
StandardOutput=append:/home/your-username/import.log
StandardError=append:/home/your-username/import-error.log

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable anime-import
sudo systemctl start anime-import
sudo systemctl status anime-import
```

View logs:
```bash
tail -f ~/import.log
```

---

## 🛠️ **Troubleshooting**

### Can't Connect to Database
```bash
# Test connection
bunx prisma studio --browser none

# Common issues:
# 1. Wrong DATABASE_URL format
# 2. Firewall blocking connection
# 3. Database not allowing external IPs

# Solution: Check your database provider's firewall/whitelist
```

### Rate Limited by Jikan API
```bash
# The script handles this automatically!
# It will:
# 1. Detect rate limit (429 status)
# 2. Wait the specified time
# 3. Add 5s buffer
# 4. Continue automatically

# No action needed - just wait
```

### Script Crashes
```bash
# Check if it saved state
cat import-state.json

# Restart - it will skip already-imported anime
bun standalone-import.js
```

---

## ⚡ **Performance Expectations**

| Duration | Anime Imported |
|----------|---------------|
| **1 hour** | ~90 anime |
| **8 hours** (overnight) | ~720 anime |
| **24 hours** (full day) | ~2,160 anime |
| **1 week** | ~15,120 anime |

**To import 10,000 anime:** ~4.6 days of continuous running

---

## 💰 **Server Costs**

### Cheap Options:

**DigitalOcean:**
- $6/month droplet (1GB RAM)
- Perfect for this task
- Easy setup

**Hetzner:**
- $4/month VPS
- Good performance
- EU-based

**AWS/GCP:**
- Free tier available
- t2.micro is enough

### Local Machine (Free!)
- Run on your laptop/desktop
- Free but must keep computer on
- Same speed and reliability

---

## 🎯 **Recommended Setup**

**For Startups (Cheapest):**
```bash
# Use a $4-6/month VPS
# Run in screen session
# Let it run for 1 week
# Then stop the server
# Total cost: ~$2 for initial import
```

**For Ongoing Updates:**
```bash
# Use systemd service
# Runs 24/7
# Automatically restarts on failure
# Keeps your database updated
```

---

## 📝 **Complete Example**

```bash
# 1. SSH to server
ssh root@your-server-ip

# 2. Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# 3. Create directory
mkdir anime-import
cd anime-import

# 4. Upload files (from local machine)
# Exit SSH first, then run:
exit
scp AnimeSenpai-Backend/scripts/standalone-import.js root@your-server:/root/anime-import/
scp AnimeSenpai-Backend/.env root@your-server:/root/anime-import/

# 5. Back to server
ssh root@your-server-ip
cd anime-import

# 6. Install dependencies
bun add @prisma/client
bunx prisma generate

# 7. Run in screen
screen -S anime-import
bun standalone-import.js

# 8. Detach
# Press: Ctrl+A then D

# 9. Monitor progress
cat import-state.json

# 10. Check back later
screen -r anime-import
```

---

## 🔐 **Security Tips**

### Protect Your .env File:
```bash
chmod 600 .env
```

### Don't Commit .env:
Already handled - it's in `.gitignore`

### Use Read-Only Database User (Optional):
Create a separate DB user with write access only to `anime` schema

---

## 🚀 **Pro Tips**

1. **Start Small:**
   - Run for 8 hours overnight
   - Check results in the morning
   - Scale up if happy

2. **Use Screen:**
   - Much simpler than systemd
   - Easy to monitor
   - Just as reliable

3. **Monitor Progress:**
   - Check `import-state.json` every few hours
   - Watch the `fetchRate` (should be ~90/min)
   - Verify `totalSaved` is increasing

4. **Stop When You Have Enough:**
   - 1,000 anime = ~11 hours
   - 5,000 anime = ~2.3 days
   - 10,000 anime = ~4.6 days

5. **Destroy Server After Import:**
   - Once done, destroy the VPS
   - Save money
   - Only pay for import time
   - Can always re-import later

---

## ❓ **FAQ**

**Q: Can I run this on my laptop?**  
A: Yes! Just run `bun standalone-import.js` locally. Keep it plugged in and don't sleep.

**Q: What if it crashes?**  
A: Just restart it. It skips already-imported anime automatically.

**Q: Can I pause and resume?**  
A: Yes! Press Ctrl+C to stop gracefully. Restart later with `bun standalone-import.js`.

**Q: How do I know it's working?**  
A: Check `import-state.json` - the `totalSaved` should increase.

**Q: Should I run this on Vercel?**  
A: No! Vercel has 10-second timeout. Use a VPS or local machine.

**Q: Can multiple scripts run at once?**  
A: Not recommended - they'll fight over rate limits.

---

## 🎉 **You're All Set!**

The import script is now running on your server, fetching complete anime data 3x faster than before!

**Next Steps:**
1. Let it run overnight (~720 anime)
2. Check progress in the morning
3. Decide if you want to continue or stop

Need help? The script has extensive logging - just check the output! 🚀


