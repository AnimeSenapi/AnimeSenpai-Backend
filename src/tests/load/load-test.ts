/**
 * Load Testing Utilities
 * 
 * Comprehensive load testing tools for the AnimeSenpai backend
 * to ensure performance under various load conditions.
 */

import { describe, test, expect } from 'bun:test'
import { appRouter } from '../../routers'
import { db } from '../../lib/db'
import { cache } from '../../lib/cache'

// Load test configuration
interface LoadTestConfig {
  concurrentUsers: number
  requestsPerUser: number
  rampUpTime: number // in milliseconds
  testDuration: number // in milliseconds
  targetRPS: number // requests per second
}

// Load test results
interface LoadTestResults {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  p50ResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  requestsPerSecond: number
  errorRate: number
  throughput: number
  duration: number
}

// Request metrics
interface RequestMetrics {
  startTime: number
  endTime: number
  duration: number
  success: boolean
  error?: string
  statusCode?: number
}

class LoadTester {
  private results: RequestMetrics[] = []
  private startTime: number = 0
  private endTime: number = 0

  /**
   * Run a load test
   */
  async runLoadTest(
    testName: string,
    config: LoadTestConfig,
    testFunction: () => Promise<any>
  ): Promise<LoadTestResults> {
    console.log(`Starting load test: ${testName}`)
    console.log(`Configuration:`, config)

    this.results = []
    this.startTime = Date.now()

    // Create concurrent users
    const userPromises = Array.from({ length: config.concurrentUsers }, (_, userIndex) =>
      this.simulateUser(userIndex, config, testFunction)
    )

    // Wait for all users to complete
    await Promise.all(userPromises)

    this.endTime = Date.now()

    // Calculate results
    const results = this.calculateResults()
    
    console.log(`Load test completed: ${testName}`)
    console.log(`Results:`, results)

    return results
  }

  /**
   * Simulate a single user
   */
  private async simulateUser(
    userIndex: number,
    config: LoadTestConfig,
    testFunction: () => Promise<any>
  ): Promise<void> {
    // Ramp up delay
    const rampUpDelay = (config.rampUpTime / config.concurrentUsers) * userIndex
    await this.sleep(rampUpDelay)

    const requestsPerUser = config.requestsPerUser
    const delayBetweenRequests = config.testDuration / requestsPerUser

    for (let i = 0; i < requestsPerUser; i++) {
      const startTime = Date.now()
      
      try {
        await testFunction()
        const endTime = Date.now()
        
        this.results.push({
          startTime,
          endTime,
          duration: endTime - startTime,
          success: true,
        })
      } catch (error) {
        const endTime = Date.now()
        
        this.results.push({
          startTime,
          endTime,
          duration: endTime - startTime,
          success: false,
          error: (error as Error).message,
        })
      }

      // Delay between requests
      if (i < requestsPerUser - 1) {
        await this.sleep(delayBetweenRequests)
      }
    }
  }

  /**
   * Calculate test results
   */
  private calculateResults(): LoadTestResults {
    const successfulRequests = this.results.filter(r => r.success)
    const failedRequests = this.results.filter(r => !r.success)
    const responseTimes = successfulRequests.map(r => r.duration).sort((a, b) => a - b)

    const totalRequests = this.results.length
    const duration = this.endTime - this.startTime

    return {
      totalRequests,
      successfulRequests: successfulRequests.length,
      failedRequests: failedRequests.length,
      averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length || 0,
      minResponseTime: responseTimes[0] || 0,
      maxResponseTime: responseTimes[responseTimes.length - 1] || 0,
      p50ResponseTime: this.percentile(responseTimes, 50),
      p95ResponseTime: this.percentile(responseTimes, 95),
      p99ResponseTime: this.percentile(responseTimes, 99),
      requestsPerSecond: (totalRequests / duration) * 1000,
      errorRate: (failedRequests.length / totalRequests) * 100,
      throughput: (successfulRequests.length / duration) * 1000,
      duration,
    }
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedArray: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedArray.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    const weight = index % 1

    if (upper >= sortedArray.length) {
      return sortedArray[sortedArray.length - 1]
    }

    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

describe('Load Tests', () => {
  const loadTester = new LoadTester()

  test('Anime List Endpoint - Light Load', async () => {
    const config: LoadTestConfig = {
      concurrentUsers: 10,
      requestsPerUser: 10,
      rampUpTime: 1000,
      testDuration: 10000,
      targetRPS: 10,
    }

    const results = await loadTester.runLoadTest(
      'Anime List - Light Load',
      config,
      () => appRouter.createCaller({}).anime.getList({ page: 1, limit: 20 })
    )

    // Assertions for light load
    expect(results.errorRate).toBeLessThan(1) // Less than 1% error rate
    expect(results.averageResponseTime).toBeLessThan(500) // Less than 500ms average
    expect(results.p95ResponseTime).toBeLessThan(1000) // 95th percentile under 1s
    expect(results.requestsPerSecond).toBeGreaterThan(5) // At least 5 RPS
  })

  test('Anime List Endpoint - Medium Load', async () => {
    const config: LoadTestConfig = {
      concurrentUsers: 50,
      requestsPerUser: 20,
      rampUpTime: 5000,
      testDuration: 30000,
      targetRPS: 50,
    }

    const results = await loadTester.runLoadTest(
      'Anime List - Medium Load',
      config,
      () => appRouter.createCaller({}).anime.getList({ page: 1, limit: 20 })
    )

    // Assertions for medium load
    expect(results.errorRate).toBeLessThan(5) // Less than 5% error rate
    expect(results.averageResponseTime).toBeLessThan(1000) // Less than 1s average
    expect(results.p95ResponseTime).toBeLessThan(2000) // 95th percentile under 2s
    expect(results.requestsPerSecond).toBeGreaterThan(20) // At least 20 RPS
  })

  test('Anime Search Endpoint - High Load', async () => {
    const config: LoadTestConfig = {
      concurrentUsers: 100,
      requestsPerUser: 30,
      rampUpTime: 10000,
      testDuration: 60000,
      targetRPS: 100,
    }

    const searchQueries = [
      'Attack on Titan',
      'Naruto',
      'One Piece',
      'Dragon Ball',
      'Death Note',
      'Fullmetal Alchemist',
      'My Hero Academia',
      'Demon Slayer',
      'Jujutsu Kaisen',
      'Tokyo Ghoul',
    ]

    const results = await loadTester.runLoadTest(
      'Anime Search - High Load',
      config,
      () => {
        const query = searchQueries[Math.floor(Math.random() * searchQueries.length)]
        return appRouter.createCaller({}).anime.search({ query, page: 1, limit: 10 })
      }
    )

    // Assertions for high load
    expect(results.errorRate).toBeLessThan(10) // Less than 10% error rate
    expect(results.averageResponseTime).toBeLessThan(2000) // Less than 2s average
    expect(results.p95ResponseTime).toBeLessThan(5000) // 95th percentile under 5s
    expect(results.requestsPerSecond).toBeGreaterThan(50) // At least 50 RPS
  })

  test('User Authentication - Concurrent Logins', async () => {
    const config: LoadTestConfig = {
      concurrentUsers: 20,
      requestsPerUser: 5,
      rampUpTime: 2000,
      testDuration: 15000,
      targetRPS: 20,
    }

    // Create test users first
    const testUsers = await createTestUsers(20)

    const results = await loadTester.runLoadTest(
      'Authentication - Concurrent Logins',
      config,
      () => {
        const user = testUsers[Math.floor(Math.random() * testUsers.length)]
        return appRouter.createCaller({}).auth.login({
          email: user.email,
          password: user.password,
          rememberMe: false,
        })
      }
    )

    // Cleanup test users
    await cleanupTestUsers(testUsers)

    // Assertions for authentication load
    expect(results.errorRate).toBeLessThan(5) // Less than 5% error rate
    expect(results.averageResponseTime).toBeLessThan(1000) // Less than 1s average
    expect(results.p95ResponseTime).toBeLessThan(2000) // 95th percentile under 2s
  })

  test('Database Connection Pool - Stress Test', async () => {
    const config: LoadTestConfig = {
      concurrentUsers: 200,
      requestsPerUser: 10,
      rampUpTime: 5000,
      testDuration: 30000,
      targetRPS: 200,
    }

    const results = await loadTester.runLoadTest(
      'Database Connection Pool - Stress Test',
      config,
      () => appRouter.createCaller({}).anime.getList({ page: 1, limit: 10 })
    )

    // Assertions for database stress test
    expect(results.errorRate).toBeLessThan(15) // Less than 15% error rate
    expect(results.averageResponseTime).toBeLessThan(3000) // Less than 3s average
    expect(results.requestsPerSecond).toBeGreaterThan(100) // At least 100 RPS
  })

  test('Cache Performance - Cache Hit/Miss Ratio', async () => {
    // Clear cache first
    await cache.clear()

    const config: LoadTestConfig = {
      concurrentUsers: 30,
      requestsPerUser: 20,
      rampUpTime: 3000,
      testDuration: 20000,
      targetRPS: 30,
    }

    // First run - should have cache misses
    const results1 = await loadTester.runLoadTest(
      'Cache Performance - First Run (Misses)',
      config,
      () => appRouter.createCaller({}).anime.getList({ page: 1, limit: 20 })
    )

    // Second run - should have cache hits
    const results2 = await loadTester.runLoadTest(
      'Cache Performance - Second Run (Hits)',
      config,
      () => appRouter.createCaller({}).anime.getList({ page: 1, limit: 20 })
    )

    // Second run should be significantly faster
    expect(results2.averageResponseTime).toBeLessThan(results1.averageResponseTime)
    expect(results2.p95ResponseTime).toBeLessThan(results1.p95ResponseTime)

    console.log('Cache Performance Comparison:')
    console.log(`First run (misses): ${results1.averageResponseTime}ms avg, ${results1.p95ResponseTime}ms p95`)
    console.log(`Second run (hits): ${results2.averageResponseTime}ms avg, ${results2.p95ResponseTime}ms p95`)
  })

  test('Memory Usage - Long Running Test', async () => {
    const config: LoadTestConfig = {
      concurrentUsers: 50,
      requestsPerUser: 100,
      rampUpTime: 10000,
      testDuration: 300000, // 5 minutes
      targetRPS: 50,
    }

    const results = await loadTester.runLoadTest(
      'Memory Usage - Long Running Test',
      config,
      () => appRouter.createCaller({}).anime.getList({ page: 1, limit: 20 })
    )

    // Assertions for long running test
    expect(results.errorRate).toBeLessThan(10) // Less than 10% error rate
    expect(results.averageResponseTime).toBeLessThan(2000) // Less than 2s average
    expect(results.requestsPerSecond).toBeGreaterThan(20) // At least 20 RPS

    // Check memory usage
    const memoryUsage = process.memoryUsage()
    console.log('Memory Usage:', {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
    })
  })
})

// Helper functions
async function createTestUsers(count: number): Promise<Array<{ email: string; password: string }>> {
  const users = []
  
  for (let i = 0; i < count; i++) {
    const userData = {
      email: `loadtest${i}@example.com`,
      username: `loadtest${i}`,
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!',
      gdprConsent: true,
      dataProcessingConsent: true,
      marketingConsent: false,
    }

    try {
      await appRouter.createCaller({}).auth.register(userData)
      users.push({
        email: userData.email,
        password: userData.password,
      })
    } catch (error) {
      console.warn(`Failed to create test user ${i}:`, (error as Error).message)
    }
  }

  return users
}

async function cleanupTestUsers(users: Array<{ email: string; password: string }>): Promise<void> {
  for (const user of users) {
    try {
      // Find user by email and delete
      const dbUser = await db.user.findUnique({ where: { email: user.email } })
      if (dbUser) {
        await db.user.delete({ where: { id: dbUser.id } })
      }
    } catch (error) {
      console.warn(`Failed to cleanup user ${user.email}:`, (error as Error).message)
    }
  }
}
