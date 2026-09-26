#!/bin/bash
# ================================================================
# AETHER VAULT - DISCORD BOT LINUX VPS RUNNER
# ================================================================

cd "$(dirname "$0")"

echo "================================================================"
echo "          AETHER VAULT - DISCORD BOT (LINUX VPS)"
echo "================================================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ [ERROR] Node.js is not installed!"
    echo "Install Node.js on Ubuntu/Debian with:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "  sudo apt install -y nodejs"
    exit 1
fi

# Check Dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing discord.js dependencies..."
    npm install
fi

echo "🚀 Starting Aether Vault Discord Bot Service..."
echo "Working directory: $(pwd)"
echo ""

node index.js
