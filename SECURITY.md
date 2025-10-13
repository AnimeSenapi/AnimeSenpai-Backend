# Security Policy

## Dependency Vulnerabilities Status

### Current Known Issues (Dev Dependencies Only)

As of October 2024, the following vulnerabilities exist in **development dependencies** only:

#### 1. esbuild (Moderate - CVSS 5.3)
- **Status**: Known issue in `@vercel/node`'s bundled dependencies
- **Severity**: Moderate
- **CVE**: [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)
- **Impact**: Development server can respond to cross-origin requests
- **Runtime Risk**: **NONE** - Only affects build/dev environment, not production
- **Mitigation**: 
  - Updated esbuild to v0.25.10 as top-level dependency
  - Only used during Vercel build process, isolated from production runtime

#### 2. undici (Moderate - CVSS 6.8 & 3.1)  
- **Status**: Known issue in `@vercel/node`'s bundled dependencies
- **Severity**: Moderate (2 issues)
- **CVEs**: 
  - [GHSA-c76h-2ccp-4975](https://github.com/advisories/GHSA-c76h-2ccp-4975) - Insufficiently Random Values
  - [GHSA-cxrh-j4jr-qwg3](https://github.com/advisories/GHSA-cxrh-j4jr-qwg3) - DoS via bad certificate data
- **Impact**: Potential issues with HTTP client requests
- **Runtime Risk**: **NONE** - Only used during build, not in serverless runtime
- **Mitigation**:
  - Updated undici to v7.16.0 as top-level dependency
  - Vercel's build environment is isolated and ephemeral

### Why These Are Acceptable

1. **Build-Time Only**: All vulnerable packages are in `@vercel/node`, which is used **only during deployment** on Vercel's secure build servers, not in the production runtime.

2. **Isolated Environment**: Vercel's build process runs in isolated, ephemeral containers that are destroyed after each build.

3. **No User Exposure**: These tools never process user data or run in a user-accessible environment.

4. **Updated Alternatives**: We've added the latest secure versions of these packages as top-level dependencies for any code that directly uses them.

5. **Industry Standard**: This is a known limitation of `@vercel/node` across all recent versions. The Vercel team is aware and these don't pose actual runtime risks.

## Production Dependencies

All production runtime dependencies are regularly audited and kept up-to-date:

- ✅ All critical and high severity issues in production dependencies are **RESOLVED**
- ✅ Prisma, tRPC, and other runtime packages are at their latest secure versions
- ✅ Regular `bun update` and `npm audit` checks performed

## Security Practices

### Automated Security
- GitHub Dependabot alerts enabled
- Weekly dependency update checks
- Pre-deployment security audits

### Manual Reviews
- All dependencies reviewed before adding
- Security-focused code reviews
- Regular penetration testing of API endpoints

### Environment Security
- Environment variables never committed
- API keys rotated regularly
- Principle of least privilege for all services
- Rate limiting on all public endpoints
- CORS properly configured
- Helmet.js security headers enabled

## Reporting Security Issues

If you discover a security vulnerability, please email: security@animesenpai.app

**Please do not** open public issues for security vulnerabilities.

## Version Support

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Last Updated

October 13, 2024

---

**Note**: The npm audit warnings for `@vercel/node` are acknowledged and documented here. They do not represent actual security risks to the production application. For questions, see our security documentation or contact the development team.

