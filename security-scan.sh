#!/bin/bash

echo "🔒 AnimeSenpai Security Scan"
echo "============================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo -e "${RED}❌ Bun is not installed${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Checking for package vulnerabilities...${NC}"
echo ""

# Check for outdated packages
echo -e "${YELLOW}1. Checking for outdated packages${NC}"
bun outdated || true
echo ""

# Check dependencies for known vulnerabilities
echo -e "${YELLOW}2. Security audit${NC}"

# Create a temporary audit script
cat > /tmp/audit-check.js << 'EOF'
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

console.log('Total dependencies:', Object.keys(deps).length);
console.log('');

// Check for commonly vulnerable packages
const vulnerablePackages = [
  'lodash',  // Often has vulnerabilities
  'moment',  // Deprecated, large bundle
  'request', // Deprecated
];

const issues = [];

for (const pkg of vulnerablePackages) {
  if (deps[pkg]) {
    issues.push(`⚠️  ${pkg} is installed - consider alternatives`);
  }
}

if (issues.length > 0) {
  console.log('Potential issues:');
  issues.forEach(issue => console.log('  ', issue));
} else {
  console.log('✅ No commonly vulnerable packages detected');
}
EOF

bun run /tmp/audit-check.js
rm /tmp/audit-check.js
echo ""

# Check for sensitive files
echo -e "${YELLOW}3. Checking for sensitive files${NC}"
SENSITIVE_FILES=(
  ".env"
  "*.key"
  "*.pem"
  "*.p12"
  "id_rsa"
  "id_dsa"
)

FOUND_SENSITIVE=0
for pattern in "${SENSITIVE_FILES[@]}"; do
  if [ -f "$pattern" ]; then
    echo -e "  ${RED}⚠️  Found: $pattern${NC}"
    FOUND_SENSITIVE=1
  fi
done

if [ $FOUND_SENSITIVE -eq 0 ]; then
  echo -e "  ${GREEN}✅ No sensitive files in repository${NC}"
fi
echo ""

# Check .gitignore
echo -e "${YELLOW}4. Checking .gitignore configuration${NC}"
if [ -f ".gitignore" ]; then
  REQUIRED_IGNORES=(
    ".env"
    "node_modules"
    "*.key"
    "*.pem"
  )
  
  MISSING_IGNORES=()
  for pattern in "${REQUIRED_IGNORES[@]}"; do
    if ! grep -q "$pattern" .gitignore; then
      MISSING_IGNORES+=("$pattern")
    fi
  done
  
  if [ ${#MISSING_IGNORES[@]} -eq 0 ]; then
    echo -e "  ${GREEN}✅ .gitignore properly configured${NC}"
  else
    echo -e "  ${YELLOW}⚠️  Missing patterns in .gitignore:${NC}"
    for pattern in "${MISSING_IGNORES[@]}"; do
      echo "     - $pattern"
    done
  fi
else
  echo -e "  ${RED}❌ .gitignore not found!${NC}"
fi
echo ""

# Check environment variables
echo -e "${YELLOW}5. Checking environment configuration${NC}"
if [ -f ".env.example" ]; then
  echo -e "  ${GREEN}✅ .env.example exists${NC}"
else
  echo -e "  ${YELLOW}⚠️  .env.example not found - create one for documentation${NC}"
fi

if [ -f ".env" ]; then
  echo -e "  ${GREEN}✅ .env exists${NC}"
  
  # Check for weak secrets
  if grep -q "your-secret-key" .env 2>/dev/null; then
    echo -e "  ${RED}⚠️  Default secrets detected - change them!${NC}"
  fi
else
  echo -e "  ${YELLOW}⚠️  .env not found${NC}"
fi
echo ""

# Check TypeScript configuration
echo -e "${YELLOW}6. Checking TypeScript strict mode${NC}"
if [ -f "tsconfig.json" ]; then
  if grep -q '"strict": true' tsconfig.json; then
    echo -e "  ${GREEN}✅ TypeScript strict mode enabled${NC}"
  else
    echo -e "  ${YELLOW}⚠️  TypeScript strict mode not enabled${NC}"
  fi
else
  echo -e "  ${RED}❌ tsconfig.json not found${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}📊 Security Scan Complete${NC}"
echo "============================"
echo ""
echo "Recommendations:"
echo "  1. Run 'bun update' regularly to get security patches"
echo "  2. Never commit .env files or secrets to git"
echo "  3. Use environment variables for all sensitive config"
echo "  4. Enable TypeScript strict mode"
echo "  5. Keep dependencies minimal and up-to-date"
echo ""
echo -e "${GREEN}✅ Security scan completed${NC}"

