#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"
    kill "$BACKEND_PID" 2>/dev/null
    kill "$FRONTEND_PID" 2>/dev/null
    wait "$BACKEND_PID" 2>/dev/null
    wait "$FRONTEND_PID" 2>/dev/null
    echo -e "${GREEN}Done.${NC}"
}
trap cleanup EXIT INT TERM

# ── 1. Backend setup ──
echo -e "${GREEN}[1/4] Setting up backend...${NC}"
cd "$ROOT_DIR/backend"

if [ ! -d ".venv" ]; then
    echo "  Creating virtual environment..."
    python3 -m venv .venv
fi

source .venv/bin/activate
pip install -q -r requirements.txt

# ── 2. Frontend setup ──
echo -e "${GREEN}[2/4] Setting up frontend...${NC}"
cd "$ROOT_DIR/frontend"

if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies..."
    npm install --silent
fi

# ── 3. Start backend ──
echo -e "${GREEN}[3/4] Starting backend on :8000...${NC}"
cd "$ROOT_DIR/backend"
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
sleep 2

# Quick health check
if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
    echo -e "  ${GREEN}Backend is running.${NC}"
else
    echo -e "  ${RED}Backend failed to start.${NC}"
    exit 1
fi

# ── 4. Start frontend ──
echo -e "${GREEN}[4/4] Starting frontend on :3000...${NC}"
cd "$ROOT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
sleep 3

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  RefBib is ready!${NC}"
echo -e "${GREEN}  Frontend: http://localhost:3000${NC}"
echo -e "${GREEN}  Backend:  http://localhost:8000${NC}"
echo -e "${GREEN}============================================${NC}"
echo -e "${YELLOW}  Press Ctrl+C to stop both servers.${NC}"
echo ""

wait
