#!/bin/bash

# 🚀 Quick Deploy Script for Standalone Import
# This script uploads everything you need to your server

echo "════════════════════════════════════════════════════════════════"
echo "  🚀 AnimeSenpai Import Script Deployment"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check if server details are provided
if [ -z "$1" ] || [ -z "$2" ]; then
  echo "❌ Missing server details!"
  echo ""
  echo "Usage:"
  echo "  ./deploy-to-server.sh <user@host> <remote-path>"
  echo ""
  echo "Example:"
  echo "  ./deploy-to-server.sh root@123.456.789.0 /root/anime-import"
  echo "  ./deploy-to-server.sh ubuntu@my-server.com /home/ubuntu/anime-import"
  echo ""
  exit 1
fi

SERVER=$1
REMOTE_PATH=$2

echo "📋 Deployment Details:"
echo "   Server: $SERVER"
echo "   Remote Path: $REMOTE_PATH"
echo ""

# Confirm
read -p "Continue with deployment? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Deployment cancelled"
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Step 1: Creating remote directory"
echo "═══════════════════════════════════════════════════════════════"
ssh $SERVER "mkdir -p $REMOTE_PATH"
echo "✅ Directory created"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Step 2: Uploading import script"
echo "═══════════════════════════════════════════════════════════════"
scp scripts/standalone-import.js $SERVER:$REMOTE_PATH/
echo "✅ Script uploaded"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Step 3: Uploading .env file"
echo "═══════════════════════════════════════════════════════════════"
if [ -f ../.env ]; then
  scp ../.env $SERVER:$REMOTE_PATH/
  echo "✅ .env uploaded"
else
  echo "⚠️  No .env file found in AnimeSenpai-Backend/"
  echo "   You'll need to create one manually on the server"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Step 4: Installing Bun on server"
echo "═══════════════════════════════════════════════════════════════"
ssh $SERVER "command -v bun >/dev/null 2>&1 || curl -fsSL https://bun.sh/install | bash"
echo "✅ Bun installed/verified"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Step 5: Installing dependencies"
echo "═══════════════════════════════════════════════════════════════"
ssh $SERVER "cd $REMOTE_PATH && bun add @prisma/client"
echo "✅ Dependencies installed"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Step 6: Uploading Prisma schema"
echo "═══════════════════════════════════════════════════════════════"
ssh $SERVER "mkdir -p $REMOTE_PATH/prisma"
scp ../prisma/schema.prisma $SERVER:$REMOTE_PATH/prisma/
echo "✅ Prisma schema uploaded"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Step 7: Generating Prisma Client"
echo "═══════════════════════════════════════════════════════════════"
ssh $SERVER "cd $REMOTE_PATH && bunx prisma generate"
echo "✅ Prisma Client generated"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Step 8: Setting permissions"
echo "═══════════════════════════════════════════════════════════════"
ssh $SERVER "chmod +x $REMOTE_PATH/standalone-import.js && chmod 600 $REMOTE_PATH/.env"
echo "✅ Permissions set"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  ✅ DEPLOYMENT COMPLETE!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "🎯 Next Steps:"
echo ""
echo "1. SSH to your server:"
echo "   ssh $SERVER"
echo ""
echo "2. Navigate to import directory:"
echo "   cd $REMOTE_PATH"
echo ""
echo "3. Start the import in screen:"
echo "   screen -S anime-import"
echo "   bun standalone-import.js"
echo ""
echo "4. Detach from screen:"
echo "   Press: Ctrl+A then D"
echo ""
echo "5. Monitor progress:"
echo "   cat import-state.json"
echo ""
echo "6. Reattach to check logs:"
echo "   screen -r anime-import"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  📊 Expected Performance"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  • ~90 anime per hour"
echo "  • ~720 anime overnight (8 hours)"
echo "  • ~2,160 anime per day"
echo "  • ~10,000 anime in ~4.6 days"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  💡 Pro Tips"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  • Screen sessions persist through disconnects"
echo "  • Ctrl+C stops gracefully (saves pending data)"
echo "  • Stats auto-save every 5 minutes"
echo "  • The script skips already-imported anime"
echo ""
echo "Happy importing! 🎉"
echo ""


