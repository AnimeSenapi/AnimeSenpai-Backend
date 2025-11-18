# Load Testing

This directory contains k6 load tests for the AnimeSenpai API.

## Prerequisites

Install k6:

```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
```

## Running Tests

### API Load Test

Tests general API endpoints under load:

```bash
# Basic test
k6 run tests/load/api-load-test.js

# Custom configuration
k6 run --vus 100 --duration 2m tests/load/api-load-test.js

# With custom API URL
API_URL=https://api.animesenpai.app k6 run tests/load/api-load-test.js
```

### Recommendations Load Test

Tests the recommendations endpoint (more computationally expensive):

```bash
# Basic test
k6 run tests/load/recommendations-load-test.js

# Custom configuration
k6 run --vus 50 --duration 2m tests/load/recommendations-load-test.js

# With authentication
API_URL=https://api.animesenpai.app TEST_TOKEN=your-token k6 run tests/load/recommendations-load-test.js
```

## Performance Targets

### API Endpoints

- **Response Time (p95):** < 200ms
- **Response Time (p99):** < 500ms
- **Error Rate:** < 1%
- **Concurrent Users:** Support 200+ users

### Recommendations

- **Response Time (p95):** < 2s
- **Response Time (p99):** < 5s
- **Error Rate:** < 5%
- **Concurrent Users:** Support 50+ users

## Test Scenarios

### Ramp Up Test

Gradually increase load to find breaking point:

```bash
k6 run --stage 30s:10,1m:50,1m:100,1m:200,30s:0 tests/load/api-load-test.js
```

### Spike Test

Sudden spike in traffic:

```bash
k6 run --stage 10s:0,10s:500,1m:500,10s:0 tests/load/api-load-test.js
```

### Stress Test

Find maximum capacity:

```bash
k6 run --stage 1m:100,5m:200,5m:300,5m:400,1m:0 tests/load/api-load-test.js
```

## CI/CD Integration

Load tests can be run in CI/CD:

```yaml
# .github/workflows/load-test.yml
- name: Run load tests
  run: |
    k6 run tests/load/api-load-test.js
    k6 run tests/load/recommendations-load-test.js
```

## Interpreting Results

### Key Metrics

- **http_req_duration** - Request duration
- **http_req_failed** - Failed request rate
- **vus** - Virtual users (concurrent)
- **iterations** - Total requests made

### Thresholds

Tests define thresholds that must pass:
- ✅ Green - Threshold passed
- ❌ Red - Threshold failed

### Common Issues

**High Error Rate:**
- Check database connection pool
- Verify rate limiting isn't too strict
- Check application logs

**Slow Response Times:**
- Review slow query logs
- Check cache hit rates
- Optimize database queries
- Consider scaling horizontally

**Memory Issues:**
- Monitor memory usage
- Check for memory leaks
- Review application code

## Best Practices

1. **Run tests regularly** - Catch performance regressions early
2. **Test in staging first** - Don't load test production
3. **Monitor during tests** - Watch metrics in real-time
4. **Document results** - Keep track of performance trends
5. **Set realistic targets** - Based on actual usage patterns

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Examples](https://k6.io/docs/examples/)
- [Performance Testing Guide](https://k6.io/docs/test-types/load-testing/)

