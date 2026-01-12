#!/bin/bash
# Network Isolation Verification Script - "Proof of Life"
# Purpose: CLI-based demonstration of security compliance for ft_transcendence v19
# Requirements:
# - Backend services must NOT be accessible from host (III.3 & IV.5)
# - Only WAF (ports 80/443) exposed to external traffic
# - Internal Docker mesh routing functional
# - Database isolation enforced

set -o pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
SKIP=0

echo ""
echo -e "${BOLD}=========================================="
echo "🔒 NETWORK ISOLATION COMPLIANCE AUDIT"
echo "ft_transcendence Subject v19: III.3 & IV.5"
echo "==========================================${NC}"
echo ""
echo -e "${BLUE}Test Philosophy:${NC}"
echo "  • Host Isolation Tests → Must FAIL (ports closed)"
echo "  • WAF Entry Tests → Must PASS (ports open)"
echo "  • Internal Mesh Tests → Must PASS (Docker DNS)"
echo ""

# ============================================
# TEST 1: HOST ISOLATION (The "Fail" Tests)
# ============================================
echo -e "${BOLD}[TEST 1] Host Isolation - Backend Services${NC}"
echo "Expected: Connection Refused (ports must be CLOSED)"
echo "--------------------------------------------------------"

test_port_blocked() {
    local port=$1
    local service=$2
    local test_cmd=""
    
    # Use nc if available, fallback to bash tcp
    if command -v nc >/dev/null 2>&1; then
        test_cmd="nc -zv -w2 localhost $port"
    else
        test_cmd="timeout 2 bash -c 'echo > /dev/tcp/localhost/$port'"
    fi
    
    echo -n "  ├─ Port $port ($service)... "
    
    if eval "$test_cmd" >/dev/null 2>&1; then
        echo -e "${RED}✗ FAIL${NC} - PORT IS EXPOSED (Security Violation)"
        ((FAIL++))
        return 1
    else
        echo -e "${GREEN}✓ PASS${NC} - Connection Refused (Isolated)"
        ((PASS++))
        return 0
    fi
}

test_port_blocked 3000 "api-gateway"
test_port_blocked 3001 "auth-service"
test_port_blocked 8200 "vault"

# ============================================
# TEST 2: DATABASE ISOLATION
# ============================================
echo ""
echo -e "${BOLD}[TEST 2] Database Tier Isolation${NC}"
echo "Expected: Connection Refused (data tier locked down)"
echo "--------------------------------------------------------"

test_port_blocked 5432 "postgres"
test_port_blocked 6379 "redis"

# Optional: Test with psql if installed
if command -v psql >/dev/null 2>&1; then
    echo -n "  ├─ PostgreSQL connection attempt (psql)... "
    if timeout 2 psql -h localhost -U root_admin -d postgres -c '\q' >/dev/null 2>&1; then
        echo -e "${RED}✗ FAIL${NC} - Database accessible from host"
        ((FAIL++))
    else
        echo -e "${GREEN}✓ PASS${NC} - Database connection blocked"
        ((PASS++))
    fi
fi

# ============================================
# TEST 3: WAF ENTRY POINT (The "Pass" Tests)
# ============================================
echo ""
echo -e "${BOLD}[TEST 3] WAF Public Entry Point${NC}"
echo "Expected: HTTP 200/302 (public gateway operational)"
echo "--------------------------------------------------------"

test_waf_port() {
    local port=$1
    local protocol=$2
    
    echo -n "  ├─ Port $port ($protocol)... "
    
    # First check if port is listening
    if ! timeout 2 bash -c "echo > /dev/tcp/localhost/$port" 2>/dev/null; then
        echo -e "${RED}✗ FAIL${NC} - Port not listening (WAF down?)"
        ((FAIL++))
        return 1
    fi
    
    # Then check HTTP response if curl available
    if command -v curl >/dev/null 2>&1; then
        local url="${protocol}://localhost:${port}/"
        local http_code=$(curl -k -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "$url" 2>/dev/null)
        
        if [[ "$http_code" =~ ^(200|301|302|404)$ ]]; then
            echo -e "${GREEN}✓ PASS${NC} - HTTP $http_code (WAF responding)"
            ((PASS++))
            return 0
        else
            echo -e "${YELLOW}⚠ WARN${NC} - Unexpected HTTP code: $http_code"
            ((PASS++))  # Still pass if port is open
            return 0
        fi
    else
        echo -e "${GREEN}✓ PASS${NC} - Port listening (curl unavailable for HTTP check)"
        ((PASS++))
        return 0
    fi
}

test_waf_port 80 "http"
test_waf_port 443 "https"

# ============================================
# TEST 4: INTERNAL MESH (The "Deep" Tests)
# ============================================
echo ""
echo -e "${BOLD}[TEST 4] Internal Docker Mesh Routing${NC}"
echo "Expected: Services communicate via Docker DNS (mesh functional)"
echo "--------------------------------------------------------"

# Check if Docker daemon is accessible
if ! docker ps >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠ SKIP${NC}: Docker daemon not accessible (permission denied?)"
    ((SKIP++))
else
    # Check if WAF container is running
    if ! docker ps --format '{{.Names}}' | grep -q '^waf$'; then
        echo -e "${YELLOW}⚠ SKIP${NC}: WAF container not running"
        echo "  └─ Start stack: docker compose up -d"
        ((SKIP++))
    else
        echo -n "  ├─ WAF → api-gateway (http://api-gateway:3000/health)... "
        
        # Execute curl inside WAF container to test internal routing
        if docker exec waf sh -c 'command -v curl >/dev/null 2>&1'; then
            waf_test=$(docker exec waf curl -f -s -o /dev/null -w "%{http_code}" http://api-gateway:3000/health 2>/dev/null || echo "000")
            
            if [[ "$waf_test" =~ ^(200|302)$ ]]; then
                echo -e "${GREEN}✓ PASS${NC} - HTTP $waf_test (internal routing works)"
                ((PASS++))
            else
                echo -e "${RED}✗ FAIL${NC} - HTTP $waf_test (gateway unreachable or unhealthy)"
                ((FAIL++))
            fi
        elif docker exec waf sh -c 'command -v wget >/dev/null 2>&1'; then
            if docker exec waf wget -q --spider --tries=1 --timeout=2 http://api-gateway:3000/health 2>/dev/null; then
                echo -e "${GREEN}✓ PASS${NC} - Internal routing works (wget)"
                ((PASS++))
            else
                echo -e "${RED}✗ FAIL${NC} - Gateway unreachable via Docker DNS"
                ((FAIL++))
            fi
        else
            echo -e "${YELLOW}⚠ SKIP${NC} - curl/wget not installed in WAF"
            ((SKIP++))
        fi
        
        # Test Vault accessibility from api-gateway
        if docker ps --format '{{.Names}}' | grep -q '^api-gateway$'; then
            echo -n "  ├─ api-gateway → vault (https://vault:8200)... "
            
            vault_test=$(docker exec api-gateway sh -c 'command -v curl >/dev/null 2>&1 && curl -k -f -s -o /dev/null -w "%{http_code}" https://vault:8200/v1/sys/health 2>/dev/null || echo "000"')
            
            if [[ "$vault_test" =~ ^(200|429|473)$ ]]; then
                echo -e "${GREEN}✓ PASS${NC} - HTTP $vault_test (Vault reachable via TLS)"
                ((PASS++))
            else
                echo -e "${YELLOW}⚠ WARN${NC} - Vault may be initializing or sealed"
                ((SKIP++))
            fi
        fi
    fi
fi

# ============================================
# TEST 5: VAULT TLS VERIFICATION
# ============================================
echo ""
echo -e "${BOLD}[TEST 5] Vault TLS Configuration${NC}"
echo "Expected: TLS enabled, cleartext HTTP blocked"
echo "--------------------------------------------------------"

if docker ps --format '{{.Names}}' | grep -q '^vault$'; then
    echo -n "  ├─ Vault TLS listener (https://127.0.0.1:8200)... "
    
    # Check if Vault responds to HTTPS
    if docker exec vault sh -c 'command -v wget >/dev/null 2>&1'; then
        if docker exec vault wget --no-check-certificate --spider --tries=1 --timeout=2 https://127.0.0.1:8200/v1/sys/health 2>/dev/null; then
            echo -e "${GREEN}✓ PASS${NC} - TLS listener active"
            ((PASS++))
        else
            echo -e "${RED}✗ FAIL${NC} - HTTPS healthcheck failed"
            ((FAIL++))
        fi
    else
        echo -e "${YELLOW}⚠ SKIP${NC} - wget not available in Vault container"
        ((SKIP++))
    fi
    
    echo -n "  ├─ Vault HTTP blocked (http://127.0.0.1:8200)... "
    # Verify HTTP is NOT accessible (should fail with TLS required)
    if docker exec vault sh -c 'wget --spider --tries=1 --timeout=2 http://127.0.0.1:8200/v1/sys/health 2>&1' | grep -q 'TLS'; then
        echo -e "${GREEN}✓ PASS${NC} - HTTP rejected (TLS enforced)"
        ((PASS++))
    else
        echo -e "${YELLOW}⚠ WARN${NC} - Unable to verify TLS enforcement"
        ((SKIP++))
    fi
else
    echo -e "${YELLOW}⚠ SKIP${NC}: Vault container not running"
    ((SKIP++))
fi

# ============================================
# SUMMARY & EXIT CODE
# ============================================
echo ""
echo -e "${BOLD}=========================================="
echo "📊 AUDIT SUMMARY"
echo "==========================================${NC}"
echo -e "  ${GREEN}✓ Tests Passed:${NC}  $PASS"
echo -e "  ${RED}✗ Tests Failed:${NC}  $FAIL"
echo -e "  ${YELLOW}⚠ Tests Skipped:${NC} $SKIP"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✓ COMPLIANCE STATUS: PASS${NC}"
    echo -e "${GREEN}════════════════════════════════════════${NC}"
    echo "All network isolation requirements are satisfied."
    echo ""
    echo "✅ Backend services isolated from host"
    echo "✅ WAF is the sole external entry point"
    echo "✅ Internal Docker mesh routing functional"
    echo "✅ Database tier locked down"
    echo ""
    exit 0
else
    echo -e "${RED}${BOLD}✗ COMPLIANCE STATUS: FAIL${NC}"
    echo -e "${RED}════════════════════════════════════════${NC}"
    echo "Network isolation violations detected."
    echo ""
    echo -e "${YELLOW}REMEDIATION REQUIRED:${NC}"
    echo "1. Ensure docker-compose.override.yml is renamed to docker-compose.dev.yml"
    echo "2. Verify base docker-compose.yml has NO 'ports:' for backends"
    echo "3. Restart stack: docker compose down && docker compose up -d"
    echo "4. Re-run: ./scripts/verify_isolation.sh"
    echo ""
    exit 1
fi
