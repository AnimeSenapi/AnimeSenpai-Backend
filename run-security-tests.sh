#!/bin/bash

# Comprehensive Security Test Runner
# Runs all security tests and generates a detailed report

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔒 AnimeSenpai Security Test Suite${NC}"
echo "====================================="
echo -e "${YELLOW}Comprehensive security testing for the auth system${NC}"
echo ""

# Check if server is running
echo -e "${CYAN}🔍 Checking if server is running...${NC}"
if ! curl -s http://localhost:3001/health > /dev/null; then
    echo -e "${RED}❌ Server is not running on localhost:3001${NC}"
    echo -e "${YELLOW}Please start the server first with: bun run dev${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Server is running${NC}"

# Make test scripts executable
chmod +x test-auth-security.sh
chmod +x test-advanced-security.sh

# Create results directory
mkdir -p security-test-results
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RESULTS_DIR="security-test-results/test_$TIMESTAMP"
mkdir -p "$RESULTS_DIR"

echo -e "\n${BLUE}📊 Starting comprehensive security tests...${NC}"
echo "Results will be saved to: $RESULTS_DIR"
echo ""

# Run basic security tests
echo -e "${CYAN}🧪 Running basic security tests...${NC}"
./test-auth-security.sh > "$RESULTS_DIR/basic_security_tests.log" 2>&1
BASIC_EXIT_CODE=$?

# Run advanced security tests
echo -e "${CYAN}🧪 Running advanced security tests...${NC}"
./test-advanced-security.sh > "$RESULTS_DIR/advanced_security_tests.log" 2>&1
ADVANCED_EXIT_CODE=$?

# Run error handling tests
echo -e "${CYAN}🧪 Running error handling tests...${NC}"
./test-error-handling.sh > "$RESULTS_DIR/error_handling_tests.log" 2>&1
ERROR_EXIT_CODE=$?

# Generate summary report
echo -e "\n${BLUE}📋 Generating security test report...${NC}"

cat > "$RESULTS_DIR/security_report.md" << EOF
# Security Test Report

**Generated:** $(date)
**Server:** http://localhost:3001
**Test Suite:** AnimeSenpai Auth Security Tests

## Test Results Summary

### Basic Security Tests
- **Status:** $([ $BASIC_EXIT_CODE -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")
- **Exit Code:** $BASIC_EXIT_CODE
- **Log File:** basic_security_tests.log

### Advanced Security Tests
- **Status:** $([ $ADVANCED_EXIT_CODE -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")
- **Exit Code:** $ADVANCED_EXIT_CODE
- **Log File:** advanced_security_tests.log

### Error Handling Tests
- **Status:** $([ $ERROR_EXIT_CODE -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")
- **Exit Code:** $ERROR_EXIT_CODE
- **Log File:** error_handling_tests.log

## Overall Security Status

$([ $BASIC_EXIT_CODE -eq 0 ] && [ $ADVANCED_EXIT_CODE -eq 0 ] && [ $ERROR_EXIT_CODE -eq 0 ] && echo "🛡️ **ALL TESTS PASSED** - System is secure!" || echo "⚠️ **SOME TESTS FAILED** - Review and fix vulnerabilities")

## Test Categories Covered

### Basic Security Tests
- SQL Injection Prevention
- XSS Prevention
- Authentication Bypass
- Input Validation
- Rate Limiting
- Session Management
- Password Security
- GDPR Compliance
- Injection Attacks
- Buffer Overflow
- Protocol Attacks
- Encoding Attacks
- Timing Attacks
- CSRF & CORS
- Security Verification

### Advanced Security Tests
- Advanced SQL Injection
- Advanced XSS
- JWT Attacks
- Session Fixation
- CSRF Attacks
- HTTP Parameter Pollution
- LDAP Injection
- XXE Injection
- SSRF Attacks
- Deserialization Attacks
- Buffer Overflow
- Header Injection
- Protocol Smuggling
- Memory Exhaustion
- Race Conditions

### Error Handling Tests
- Health Check Tests
- Invalid Endpoint Tests
- Authentication Error Tests
- Input Validation Tests
- Resource Not Found Tests
- Rate Limiting Tests
- CORS Tests
- Large Request Tests
- Security Tests
- Email Verification Tests
- Password Reset Tests
- Session Management Tests
- GDPR Tests
- Database Error Tests
- Performance Tests

## Recommendations

$([ $BASIC_EXIT_CODE -eq 0 ] && [ $ADVANCED_EXIT_CODE -eq 0 ] && [ $ERROR_EXIT_CODE -eq 0 ] && echo "- ✅ All security tests passed. System is ready for production." || echo "- ⚠️ Review failed tests and implement fixes before production deployment.")

## Next Steps

1. Review any failed tests in the log files
2. Implement fixes for identified vulnerabilities
3. Re-run tests to verify fixes
4. Set up continuous security monitoring
5. Implement security headers in production
6. Set up error monitoring and alerting

## Files Generated

- \`basic_security_tests.log\` - Basic security test results
- \`advanced_security_tests.log\` - Advanced security test results
- \`error_handling_tests.log\` - Error handling test results
- \`security_report.md\` - This summary report

EOF

# Display summary
echo -e "\n${BLUE}🎯 SECURITY TEST SUMMARY${NC}"
echo "=========================="
echo -e "Basic Security Tests: $([ $BASIC_EXIT_CODE -eq 0 ] && echo -e "${GREEN}✅ PASSED${NC}" || echo -e "${RED}❌ FAILED${NC}")"
echo -e "Advanced Security Tests: $([ $ADVANCED_EXIT_CODE -eq 0 ] && echo -e "${GREEN}✅ PASSED${NC}" || echo -e "${RED}❌ FAILED${NC}")"
echo -e "Error Handling Tests: $([ $ERROR_EXIT_CODE -eq 0 ] && echo -e "${GREEN}✅ PASSED${NC}" || echo -e "${RED}❌ FAILED${NC}")"

if [ $BASIC_EXIT_CODE -eq 0 ] && [ $ADVANCED_EXIT_CODE -eq 0 ] && [ $ERROR_EXIT_CODE -eq 0 ]; then
    echo -e "\n${GREEN}🛡️  ALL SECURITY TESTS PASSED!${NC}"
    echo -e "${GREEN}Your auth system is secure and ready for production! 🚀${NC}"
    echo -e "\n${BLUE}📊 Detailed report saved to: $RESULTS_DIR/security_report.md${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  SOME SECURITY TESTS FAILED!${NC}"
    echo -e "${YELLOW}Please review the test results and fix any vulnerabilities.${NC}"
    echo -e "\n${BLUE}📊 Detailed report saved to: $RESULTS_DIR/security_report.md${NC}"
    echo -e "${BLUE}📋 Log files available in: $RESULTS_DIR/${NC}"
    exit 1
fi
