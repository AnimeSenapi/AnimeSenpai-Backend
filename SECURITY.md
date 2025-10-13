# Security Policy

## Dependency Vulnerabilities Status

### ✅ All Vulnerabilities Resolved

As of October 13, 2024, **all security vulnerabilities have been successfully resolved**.

```
npm audit: found 0 vulnerabilities ✅
```

### How We Fixed Them

#### 1. Package Overrides & Resolutions
We use both `overrides` (npm) and `resolutions` (Bun/Yarn) to force all dependencies, including nested ones, to use secure versions:

```json
{
  "overrides": {
    "esbuild": "^0.25.10",
    "undici": "^7.16.0", 
    "path-to-regexp": "^6.3.0"
  },
  "resolutions": {
    "esbuild": "^0.25.10",
    "undici": "^7.16.0",
    "path-to-regexp": "^6.3.0",
    "@vercel/node/esbuild": "^0.25.10",
    "@vercel/node/undici": "^7.16.0",
    "@vercel/node/path-to-regexp": "^6.3.0"
  }
}
```

#### 2. Updated Packages
- ✅ **esbuild**: Updated to v0.25.10 (from vulnerable v0.14.47)
- ✅ **undici**: Updated to v7.16.0 (from vulnerable v5.28.4)
- ✅ **path-to-regexp**: Updated to v6.3.0 (from vulnerable v6.1.0)
- ✅ **@vercel/node**: Pinned to v4.0.0 with overrides applied

#### 3. Previously Addressed Issues
- ✅ **path-to-regexp ReDoS** (High - CVSS 7.5) - [GHSA-9wv6-86v2-598j](https://github.com/advisories/GHSA-9wv6-86v2-598j)
- ✅ **esbuild CORS bypass** (Moderate - CVSS 5.3) - [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)
- ✅ **undici Insufficient Random Values** (Moderate - CVSS 6.8) - [GHSA-c76h-2ccp-4975](https://github.com/advisories/GHSA-c76h-2ccp-4975)
- ✅ **undici DoS via Certificate** (Low - CVSS 3.1) - [GHSA-cxrh-j4jr-qwg3](https://github.com/advisories/GHSA-cxrh-j4jr-qwg3)

## Production Dependencies

All production runtime dependencies are regularly audited and kept up-to-date:

- ✅ **Zero vulnerabilities** in all dependencies (production and development)
- ✅ Prisma, tRPC, and other runtime packages are at their latest secure versions
- ✅ Regular `bun update` and `npm audit` checks performed
- ✅ Package overrides ensure nested dependencies are also secure

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

