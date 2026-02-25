#!/bin/bash

# Connection Test Script
# Tests if backend and frontend are properly connected

echo "======================================"
echo "  NutriLife Connection Test"
echo "======================================"
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test 1: Backend Root Endpoint
echo -n "Test 1: Backend health check... "
response=$(curl -s http://localhost:8000/)
if echo "$response" | grep -q "NutriLife API is running"; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo "   Backend is not responding at http://localhost:8000"
    echo "   Please start the backend first:"
    echo "   cd api && uvicorn index:app --reload --host 0.0.0.0 --port 8000"
fi

echo ""

# Test 2: Backend Detailed Health
echo -n "Test 2: Backend database connection... "
response=$(curl -s http://localhost:8000/health)
if echo "$response" | grep -q "connected"; then
    echo -e "${GREEN}PASS${NC}"
elif echo "$response" | grep -q "error"; then
    echo -e "${RED}FAIL${NC}"
    echo "   Database connection error"
    echo "   Check your MySQL credentials in .env file"
else
    echo -e "${YELLOW}UNKNOWN${NC}"
    echo "   Could not verify database connection"
fi

echo ""

# Test 3: Frontend
echo -n "Test 3: Frontend running... "
response=$(curl -s http://localhost:3000/)
if [ -n "$response" ]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo "   Frontend is not responding at http://localhost:3000"
    echo "   Please start the frontend:"
    echo "   npm run dev"
fi

echo ""

# Test 4: API Endpoint
echo -n "Test 4: API endpoint accessibility... "
response=$(curl -s -X POST http://localhost:8000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test","password":"test"}')
if echo "$response" | grep -q "success\|Invalid credentials"; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo "   API endpoints not responding correctly"
fi

echo ""

# Test 5: CORS Check
echo -n "Test 5: CORS configuration... "
response=$(curl -s -I -X OPTIONS http://localhost:8000/api/auth/login \
    -H "Origin: http://localhost:3000" \
    -H "Access-Control-Request-Method: POST")
if echo "$response" | grep -q "access-control-allow-origin"; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${YELLOW}CHECK${NC}"
    echo "   CORS headers may not be properly configured"
fi

echo ""
echo "======================================"
echo "  Test Summary"
echo "======================================"
echo ""
echo "If all tests passed:"
echo -e "  ${GREEN}✓${NC} Your app should work correctly"
echo "  Open http://localhost:3000 in your browser"
echo ""
echo "If tests failed:"
echo "  1. Make sure backend is running (Terminal 1)"
echo "  2. Make sure frontend is running (Terminal 2)"
echo "  3. Check .env.local has: NEXT_PUBLIC_API_URL=http://localhost:8000"
echo "  4. Check MySQL is running and credentials are correct"
echo ""
echo "For detailed debugging, see CONNECTION_FIX_GUIDE.md"
echo ""
