#!/bin/bash

###############################################################################
# Anime Import Script Launcher
# 
# This script sets up and runs the standalone anime import script
# Usage: ./scripts/run-import.sh
###############################################################################

echo "🌙 AnimeSenpai - Standalone Import Script"
echo "========================================"
echo ""

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Error: Bun is not installed!"
    echo "   Install it with: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "   Create a .env file with your DATABASE_URL"
    echo "   Example: DATABASE_URL=\"postgresql://user:pass@host:5432/db\""
    exit 1
fi

# Check if DATABASE_URL is set
if ! grep -q "DATABASE_URL" .env; then
    echo "❌ Error: DATABASE_URL not found in .env file!"
    exit 1
fi

echo "✅ Bun found: $(bun --version)"
echo "✅ .env file found"
echo "✅ DATABASE_URL configured"
echo ""

# Check if Prisma client is generated
if [ ! -d "node_modules/@prisma/client" ]; then
    echo "📦 Prisma client not found, generating..."
    bun install
    bunx prisma generate
fi

echo "🚀 Starting anime import..."
echo "   Press Ctrl+C to stop gracefully"
echo "   Stats will be saved to: import-state.json"
echo "   Health updates in: import-health.json"
echo ""
echo "========================================"
echo ""

# Run the import script
bun scripts/standalone-import.js

