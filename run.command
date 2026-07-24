#!/bin/bash

cd "$(dirname "$0")"

echo "=================================================="
echo "CHROS Local Server + Cloudflare Tunnel for macOS"
echo "=================================================="

# Check if cloudflared binary exists
if [ ! -f "./cloudflared" ]; then
    echo ""
    echo "=========================================="
    ARCH=$(uname -m)
    if [ "$ARCH" = "arm64" ]; then
        CLOUD_ARCH="arm64"
    else
        CLOUD_ARCH="amd64"
    fi
    echo "[Cloudflare] Downloading cloudflared for macOS ($CLOUD_ARCH)..."
    echo "=========================================="
    curl -L -o ./cloudflared.tgz "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-${CLOUD_ARCH}.tgz"
    if [ -f "./cloudflared.tgz" ]; then
        tar -xzf ./cloudflared.tgz
        rm -f ./cloudflared.tgz
    fi
    if [ ! -f "./cloudflared" ]; then
        echo "[ERROR] Failed to download cloudflared automatically."
        echo "Please download it manually or check your connection."
        exit 1
    fi
    chmod +x ./cloudflared
    echo "[Cloudflare] Download and permissions setup complete!"
fi

echo ""
echo "=========================================="
echo "📦 Checking and installing dependencies..."
echo "=========================================="
npm install

echo ""
echo "=========================================="
echo "🔒 Obfuscating JavaScript files..."
echo "=========================================="
npm run obfuscate

echo ""
echo "=========================================="
echo "🚀 Starting CHROS Local Node.js Server..."
echo "=========================================="
# Run the node server in the background
npm start &
NODE_PID=$!

# Wait a moment for server to initialize
sleep 2

echo ""
echo "=========================================="
echo "🌐 Launching Cloudflare Tunnel..."
echo "=========================================="
echo "Please wait a moment for the tunnel link to generate."
echo "Look for a line like: https://xxxx-xxxx.trycloudflare.com"
echo "Press Ctrl+C to stop both the server and tunnel."
echo "=========================================="
echo ""

# Run cloudflared in the foreground
./cloudflared tunnel --url http://127.0.0.1:5000

# When cloudflared exits, kill the background Node process
kill $NODE_PID
