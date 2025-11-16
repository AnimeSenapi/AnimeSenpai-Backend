import { logger } from './logger'

interface CircuitBreakerConfig {
  failureThreshold: number
  recoveryTimeout: number
  monitoringPeriod: number
  expectedException?: (error: Error) => boolean
}

interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  failureCount: number
  lastFailureTime: number
  nextAttemptTime: number
}

class CircuitBreaker {
  private config: CircuitBreakerConfig
  private state: CircuitBreakerState
  private name: string

  constructor(name: string, config: CircuitBreakerConfig) {
    this.name = name
    this.config = config
    this.state = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0
    }
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state.state === 'OPEN') {
      if (Date.now() < this.state.nextAttemptTime) {
        throw new Error(`Circuit breaker ${this.name} is OPEN`)
      }
      this.state.state = 'HALF_OPEN'
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      this.onFailure(errorObj)
      throw error
    }
  }

  private onSuccess(): void {
    if (this.state.state === 'HALF_OPEN') {
      this.state.state = 'CLOSED'
      this.state.failureCount = 0
      logger.info(`Circuit breaker ${this.name} closed after successful operation`)
    }
  }

  private onFailure(error: Error): void {
    this.state.failureCount++
    this.state.lastFailureTime = Date.now()

    if (this.config.expectedException && this.config.expectedException(error)) {
      return // Don't count expected exceptions
    }

    if (this.state.failureCount >= this.config.failureThreshold) {
      this.state.state = 'OPEN'
      this.state.nextAttemptTime = Date.now() + this.config.recoveryTimeout
      logger.warn(`Circuit breaker ${this.name} opened after ${this.state.failureCount} failures`)
    }
  }

  getState(): CircuitBreakerState {
    return { ...this.state }
  }

  reset(): void {
    this.state = {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0
    }
    logger.info(`Circuit breaker ${this.name} reset`)
  }

  isOpen(): boolean {
    return this.state.state === 'OPEN'
  }

  isClosed(): boolean {
    return this.state.state === 'CLOSED'
  }

  isHalfOpen(): boolean {
    return this.state.state === 'HALF_OPEN'
  }
}

// Circuit breaker manager
class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map()

  createBreaker(name: string, config: CircuitBreakerConfig): CircuitBreaker {
    const breaker = new CircuitBreaker(name, config)
    this.breakers.set(name, breaker)
    return breaker
  }

  getBreaker(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name)
  }

  getAllBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.breakers)
  }

  resetBreaker(name: string): void {
    const breaker = this.breakers.get(name)
    if (breaker) {
      breaker.reset()
    }
  }

  resetAllBreakers(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset()
    }
  }

  getStatus(): Array<{ name: string; state: CircuitBreakerState }> {
    return Array.from(this.breakers.entries()).map(([name, breaker]) => ({
      name,
      state: breaker.getState()
    }))
  }
}

// Global circuit breaker manager
export const circuitBreakerManager = new CircuitBreakerManager()

// Predefined circuit breakers
export const databaseBreaker = circuitBreakerManager.createBreaker('database', {
  failureThreshold: 5,
  recoveryTimeout: 30000, // 30 seconds
  monitoringPeriod: 60000, // 1 minute
  expectedException: (error) => error.message.includes('connection')
})

export const redisBreaker = circuitBreakerManager.createBreaker('redis', {
  failureThreshold: 3,
  recoveryTimeout: 15000, // 15 seconds
  monitoringPeriod: 30000, // 30 seconds
  expectedException: (error) => error.message.includes('connection')
})

export const externalApiBreaker = circuitBreakerManager.createBreaker('external-api', {
  failureThreshold: 10,
  recoveryTimeout: 60000, // 1 minute
  monitoringPeriod: 120000, // 2 minutes
  expectedException: (error) => error.message.includes('timeout')
})

// Circuit breaker decorator
export function withCircuitBreaker(breakerName: string, config?: CircuitBreakerConfig) {
  return function (_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value
    const breaker = config 
      ? circuitBreakerManager.createBreaker(breakerName, config)
      : circuitBreakerManager.getBreaker(breakerName)

    if (!breaker) {
      throw new Error(`Circuit breaker ${breakerName} not found`)
    }

    descriptor.value = async function (...args: any[]) {
      return breaker.execute(() => method.apply(this, args))
    }
  }
}

// Circuit breaker middleware for Express
export function circuitBreakerMiddleware(breakerName: string) {
  return (_req: any, res: any, next: any) => {
    const breaker = circuitBreakerManager.getBreaker(breakerName)
    if (!breaker) {
      return next()
    }

    if (breaker.isOpen()) {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        circuitBreaker: breakerName,
        state: 'OPEN'
      })
    }

    next()
  }
}

// Health check for circuit breakers
export function getCircuitBreakerHealth(): {
  status: 'healthy' | 'degraded' | 'unhealthy'
  breakers: Array<{ name: string; state: string; failureCount: number }>
} {
  const breakers = circuitBreakerManager.getStatus()
  const openBreakers = breakers.filter(b => b.state.state === 'OPEN')
  const halfOpenBreakers = breakers.filter(b => b.state.state === 'HALF_OPEN')

  let status: 'healthy' | 'degraded' | 'unhealthy'
  if (openBreakers.length === 0 && halfOpenBreakers.length === 0) {
    status = 'healthy'
  } else if (openBreakers.length === 0 && halfOpenBreakers.length > 0) {
    status = 'degraded'
  } else {
    status = 'unhealthy'
  }

  return {
    status,
    breakers: breakers.map(b => ({
      name: b.name,
      state: b.state.state,
      failureCount: b.state.failureCount
    }))
  }
}

export default circuitBreakerManager
