# Logging Configuration

This document explains how to configure logging in the AnimeSenpai backend to control debug output and reduce terminal noise.

## Quick Start

### Clean Development Mode
For a cleaner development experience with reduced debug output:

```bash
bun run dev:clean
```

### Full Debug Mode
For full debugging with all log categories enabled:

```bash
bun run dev
```

## Environment Variables

You can control logging behavior using these environment variables:

### Log Level
- `LOG_LEVEL`: Set the minimum log level (`error`, `warn`, `info`, `debug`)
- `QUIET_MODE`: Set to `true` to disable most logging output

### Category Controls
- `ENABLE_REQUEST_LOGGING`: Enable/disable request logging (default: `true`)
- `ENABLE_PERFORMANCE_LOGGING`: Enable/disable performance logging (default: `false`)
- `ENABLE_SECURITY_LOGGING`: Enable/disable security logging (default: `true`)
- `ENABLE_CACHE_LOGGING`: Enable/disable cache logging (default: `false`)
- `ENABLE_DATABASE_LOGGING`: Enable/disable database logging (default: `false`)
- `ENABLE_MONITORING_LOGGING`: Enable/disable monitoring logging (default: `false`)

## Log Categories

The logger supports different categories for better control:

- **REQUEST**: HTTP request/response logging
- **PERFORMANCE**: Performance metrics and timing
- **SECURITY**: Security events and authentication
- **CACHE**: Cache hits, misses, and operations
- **DATABASE**: Database queries and operations
- **MONITORING**: System monitoring and health checks
- **AUTH**: Authentication and authorization events
- **API**: API endpoint calls and responses
- **ERROR**: Error logging (always enabled)
- **SYSTEM**: System-level events (always enabled)

## Usage in Code

```typescript
import { logger } from './lib/logger'

// Category-based logging
logger.request('User login attempt', context, { userId: '123' })
logger.performance('Database query completed', context, { duration: 150 })
logger.security('Suspicious activity detected', context, { ip: '192.168.1.1' })
logger.cache('Cache miss for user data', context, { key: 'user:123' })
logger.database('Query executed', context, { query: 'SELECT * FROM users' })
logger.monitoring('Health check completed', context, { status: 'healthy' })
logger.auth('User authenticated', context, { userId: '123' })
logger.api('API endpoint called', context, { endpoint: '/api/users' })
logger.system('Server started', context, { port: 3005 })

// Standard logging (respects LOG_LEVEL)
logger.info('General information message', context)
logger.warn('Warning message', context)
logger.error('Error message', context, error)
logger.debug('Debug message', context)
```

## Configuration Examples

### Development (Clean)
```bash
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true
ENABLE_PERFORMANCE_LOGGING=false
ENABLE_SECURITY_LOGGING=true
ENABLE_CACHE_LOGGING=false
ENABLE_DATABASE_LOGGING=false
ENABLE_MONITORING_LOGGING=false
```

### Development (Full Debug)
```bash
LOG_LEVEL=debug
ENABLE_REQUEST_LOGGING=true
ENABLE_PERFORMANCE_LOGGING=true
ENABLE_SECURITY_LOGGING=true
ENABLE_CACHE_LOGGING=true
ENABLE_DATABASE_LOGGING=true
ENABLE_MONITORING_LOGGING=true
```

### Production
```bash
LOG_LEVEL=warn
ENABLE_REQUEST_LOGGING=false
ENABLE_PERFORMANCE_LOGGING=false
ENABLE_SECURITY_LOGGING=true
ENABLE_CACHE_LOGGING=false
ENABLE_DATABASE_LOGGING=false
ENABLE_MONITORING_LOGGING=true
```

### Testing
```bash
QUIET_MODE=true
LOG_LEVEL=error
```

## Troubleshooting

### Too Much Debug Output
- Use `bun run dev:clean` instead of `bun run dev`
- Set `LOG_LEVEL=info` or `LOG_LEVEL=warn`
- Disable specific categories you don't need

### Missing Important Logs
- Check that the relevant category is enabled
- Verify the log level includes the message level
- Ensure `QUIET_MODE` is not set to `true`

### Performance Impact
- Disable `ENABLE_PERFORMANCE_LOGGING` in production
- Set `LOG_LEVEL=warn` or higher in production
- Use `QUIET_MODE=true` for testing
