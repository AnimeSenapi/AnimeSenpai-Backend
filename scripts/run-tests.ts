#!/usr/bin/env bun
/**
 * Test Runner Script
 * 
 * Comprehensive test runner for all test suites including
 * unit tests, integration tests, and load tests.
 */

import { spawn } from 'bun'
import { existsSync } from 'fs'
import { join } from 'path'

// Test configuration
interface TestConfig {
  suites: {
    unit: boolean
    integration: boolean
    load: boolean
    e2e: boolean
  }
  coverage: boolean
  watch: boolean
  verbose: boolean
  parallel: boolean
  timeout: number
}

// Test results
interface TestResults {
  suite: string
  passed: number
  failed: number
  skipped: number
  duration: number
  coverage?: number
}

class TestRunner {
  private config: TestConfig
  private results: TestResults[] = []

  constructor() {
    this.config = {
      suites: {
        unit: true,
        integration: true,
        load: false, // Disabled by default as it's resource intensive
        e2e: false,
      },
      coverage: false,
      watch: false,
      verbose: false,
      parallel: true,
      timeout: 30000,
    }
  }

  /**
   * Parse command line arguments
   */
  parseArgs(args: string[]): void {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      
      switch (arg) {
        case '--unit-only':
          this.config.suites = { unit: true, integration: false, load: false, e2e: false }
          break
        case '--integration-only':
          this.config.suites = { unit: false, integration: true, load: false, e2e: false }
          break
        case '--load-only':
          this.config.suites = { unit: false, integration: false, load: true, e2e: false }
          break
        case '--e2e-only':
          this.config.suites = { unit: false, integration: false, load: false, e2e: true }
          break
        case '--coverage':
          this.config.coverage = true
          break
        case '--watch':
          this.config.watch = true
          break
        case '--verbose':
          this.config.verbose = true
          break
        case '--no-parallel':
          this.config.parallel = false
          break
        case '--timeout':
          this.config.timeout = parseInt(args[++i]) || 30000
          break
        case '--help':
          this.showHelp()
          process.exit(0)
          break
      }
    }
  }

  /**
   * Show help information
   */
  showHelp(): void {
    console.log(`
AnimeSenpai Test Runner

Usage: bun run scripts/run-tests.ts [options]

Options:
  --unit-only          Run only unit tests
  --integration-only   Run only integration tests
  --load-only          Run only load tests
  --e2e-only           Run only end-to-end tests
  --coverage           Generate coverage report
  --watch              Watch for file changes and re-run tests
  --verbose            Show verbose output
  --no-parallel        Run tests sequentially
  --timeout <ms>       Set test timeout (default: 30000)
  --help               Show this help message

Examples:
  bun run scripts/run-tests.ts                    # Run all enabled tests
  bun run scripts/run-tests.ts --unit-only        # Run only unit tests
  bun run scripts/run-tests.ts --coverage         # Run with coverage
  bun run scripts/run-tests.ts --load-only        # Run load tests
  bun run scripts/run-tests.ts --watch            # Watch mode
`)
  }

  /**
   * Run all tests
   */
  async runTests(): Promise<void> {
    console.log('🚀 Starting AnimeSenpai Test Suite')
    console.log('Configuration:', this.config)
    console.log('')

    const startTime = Date.now()

    try {
      // Run test suites
      if (this.config.suites.unit) {
        await this.runTestSuite('unit', 'src/lib/__tests__/**/*.test.ts')
      }

      if (this.config.suites.integration) {
        await this.runTestSuite('integration', 'src/tests/integration/**/*.test.ts')
      }

      if (this.config.suites.load) {
        await this.runTestSuite('load', 'src/tests/load/**/*.test.ts')
      }

      if (this.config.suites.e2e) {
        await this.runTestSuite('e2e', 'src/tests/e2e/**/*.test.ts')
      }

      // Print summary
      this.printSummary(startTime)

    } catch (error) {
      console.error('❌ Test runner failed:', error)
      process.exit(1)
    }
  }

  /**
   * Run a specific test suite
   */
  private async runTestSuite(suiteName: string, pattern: string): Promise<void> {
    console.log(`📋 Running ${suiteName} tests...`)
    
    const startTime = Date.now()
    
    try {
      // Check if test files exist
      if (!this.hasTestFiles(pattern)) {
        console.log(`⚠️  No ${suiteName} test files found matching pattern: ${pattern}`)
        return
      }

      // Build bun test command
      const args = ['test', pattern]
      
      if (this.config.coverage) {
        args.push('--coverage')
      }
      
      if (this.config.watch) {
        args.push('--watch')
      }
      
      if (this.config.verbose) {
        args.push('--verbose')
      }
      
      if (!this.config.parallel) {
        args.push('--no-parallel')
      }

      // Run tests
      const proc = spawn({
        cmd: ['bun', ...args],
        stdio: ['inherit', 'inherit', 'inherit'],
        env: { ...process.env, NODE_ENV: 'test' },
      })

      const exitCode = await proc.exited
      const duration = Date.now() - startTime

      // Store results
      this.results.push({
        suite: suiteName,
        passed: exitCode === 0 ? 1 : 0, // Simplified - in real implementation, parse output
        failed: exitCode === 0 ? 0 : 1,
        skipped: 0,
        duration,
      })

      if (exitCode === 0) {
        console.log(`✅ ${suiteName} tests passed (${duration}ms)`)
      } else {
        console.log(`❌ ${suiteName} tests failed (${duration}ms)`)
      }

    } catch (error) {
      console.error(`❌ ${suiteName} tests failed:`, error)
      this.results.push({
        suite: suiteName,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: Date.now() - startTime,
      })
    }
  }

  /**
   * Check if test files exist
   */
  private hasTestFiles(pattern: string): boolean {
    // Simple check - in real implementation, use glob matching
    const testDirs = [
      'src/lib/__tests__',
      'src/tests/integration',
      'src/tests/load',
      'src/tests/e2e',
    ]
    
    return testDirs.some(dir => existsSync(dir))
  }

  /**
   * Print test summary
   */
  private printSummary(startTime: number): void {
    const totalDuration = Date.now() - startTime
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0)
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0)
    const totalSkipped = this.results.reduce((sum, r) => sum + r.skipped, 0)

    console.log('')
    console.log('📊 Test Summary')
    console.log('==============')
    
    this.results.forEach(result => {
      const status = result.failed > 0 ? '❌' : '✅'
      console.log(`${status} ${result.suite.padEnd(12)} ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped (${result.duration}ms)`)
    })
    
    console.log('')
    console.log(`Total: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped (${totalDuration}ms)`)
    
    if (totalFailed > 0) {
      console.log('❌ Some tests failed')
      process.exit(1)
    } else {
      console.log('✅ All tests passed!')
    }
  }
}

// Main execution
async function main() {
  const runner = new TestRunner()
  runner.parseArgs(process.argv.slice(2))
  await runner.runTests()
}

// Run if called directly
if (import.meta.main) {
  main().catch(console.error)
}

export default TestRunner
