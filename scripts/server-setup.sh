#!/bin/bash

# 🔧 Server Setup Script
# Run this ON YOUR SERVER after uploading the files

echo "════════════════════════════════════════════════════════════════"
echo "  🔧 AnimeSenpai Import - Server Setup"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check if we're in the right directory
if [ ! -f "standalone-import.js" ]; then
  echo "❌ Error: standalone-import.js not found!"
  echo "   Please run this script in the same directory as standalone-import.js"
  exit 1
fi

echo "✅ Found standalone-import.js"
echo ""

# Check for .env
if [ ! -f ".env" ]; then
  echo "⚠️  No .env file found!"
  echo ""
  echo "Creating .env file..."
  cat > .env << 'EOF'
# Add your production DATABASE_URL here
DATABASE_URL="postgresql://user:password@host:5432/database?schema=anime_data"

# Example PostgreSQL:
# DATABASE_URL="postgresql://username:password@hostname:5432/dbname?schema=anime_data"

# Example with Supabase:
# DATABASE_URL="postgresql://postgres.xxx:password@aws-0-region.pooler.supabase.com:6543/postgres?schema=anime_data"
EOF
  
  echo "✅ Created .env template"
  echo ""
  echo "⚠️  IMPORTANT: Edit .env and add your DATABASE_URL!"
  echo "   nano .env"
  echo ""
  read -p "Press Enter after you've updated .env..."
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Installing Bun"
echo "═══════════════════════════════════════════════════════════════"

# Check if bun is installed
if command -v bun &> /dev/null; then
  echo "✅ Bun is already installed"
  bun --version
else
  echo "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  source ~/.bashrc
  echo "✅ Bun installed"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Installing Dependencies"
echo "═══════════════════════════════════════════════════════════════"
bun add @prisma/client
echo "✅ @prisma/client installed"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Generating Prisma Client"
echo "═══════════════════════════════════════════════════════════════"
bunx prisma generate
echo "✅ Prisma Client generated"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Testing Database Connection"
echo "═══════════════════════════════════════════════════════════════"
bunx prisma db execute --stdin <<< "SELECT 1;" 2>/dev/null
if [ $? -eq 0 ]; then
  echo "✅ Database connection successful"
else
  echo "⚠️  Could not verify database connection"
  echo "   The import script will test it again at startup"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Setting Permissions"
echo "═══════════════════════════════════════════════════════════════"
chmod +x standalone-import.js
chmod 600 .env
echo "✅ Permissions set"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  ✅ SETUP COMPLETE!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "🎯 Ready to Start Import!"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Option 1: Run in Screen (Recommended)"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  screen -S anime-import"
echo "  bun standalone-import.js"
echo "  # Press Ctrl+A then D to detach"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Option 2: Run Directly"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  bun standalone-import.js"
echo "  # Press Ctrl+C to stop"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Monitoring Commands"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  Check progress:    cat import-state.json"
echo "  Check health:      cat import-health.json"
echo "  Watch stats:       watch -n 5 cat import-state.json"
echo "  Reattach screen:   screen -r anime-import"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Ready to start? Run: bun standalone-import.js"
echo ""


