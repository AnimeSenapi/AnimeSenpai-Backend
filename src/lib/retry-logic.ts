import { logger } from './logger'

interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  jitter: boolean
  retryCondition?: (error: Error) => boolean
}

interface RetryResult<T> {
  success: boolean
  result?: T
  error?: Error
  attempts: number
  totalTime: number
}

class RetryLogic {
  private config: RetryConfig

  constructor(config: RetryConfig) {
    this.config = config
  }

  async execute<T>(operation: () => Promise<T>): Promise<RetryResult<T>> {
    const startTime = Date.now()
    let lastError: Error
    let attempts = 0

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      attempts = attempt
      
      try {
        const result = await operation()
        const totalTime = Date.now() - startTime
        
        logger.info(`Operation succeeded on attempt ${attempt}`, {
          attempts,
          totalTime,
          operation: operation.name || 'anonymous'
        })
        
        return {
          success: true,
          result,
          attempts,
          totalTime
        }
      } catch (error) {
        lastError = error as Error
        
        // Check if we should retry this error
        if (this.config.retryCondition && !this.config.retryCondition(lastError)) {
          logger.warn(`Operation failed with non-retryable error on attempt ${attempt}`, undefined, {
            error: lastError.message,
            attempts,
            totalTime: Date.now() - startTime
          })
          
          return {
            success: false,
            error: lastError,
            attempts,
            totalTime: Date.now() - startTime
          }
        }
        
        // Don't wait after the last attempt
        if (attempt < this.config.maxAttempts) {
          const delay = this.calculateDelay(attempt)
          logger.warn(`Operation failed on attempt ${attempt}, retrying in ${delay}ms`, undefined, {
            error: lastError.message,
            attempt,
            delay,
            maxAttempts: this.config.maxAttempts
          })
          
          await this.sleep(delay)
        }
      }
    }
    
    const totalTime = Date.now() - startTime
    logger.error(`Operation failed after ${attempts} attempts`, lastError!, undefined, {
      attempts,
      totalTime,
      operation: operation.name || 'anonymous'
    })
    
    return {
      success: false,
      error: lastError!,
      attempts,
      totalTime
    }
  }

  private calculateDelay(attempt: number): number {
    let delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1)
    
    // Apply jitter to prevent thundering herd
    if (this.config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5)
    }
    
    // Cap the delay at maxDelay
    return Math.min(delay, this.config.maxDelay)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Retry logic manager
class RetryLogicManager {
  private retryConfigs: Map<string, RetryConfig> = new Map()

  createConfig(name: string, config: RetryConfig): RetryConfig {
    this.retryConfigs.set(name, config)
    return config
  }

  getConfig(name: string): RetryConfig | undefined {
    return this.retryConfigs.get(name)
  }

  getAllConfigs(): Map<string, RetryConfig> {
    return new Map(this.retryConfigs)
  }
}

// Global retry logic manager
export const retryLogicManager = new RetryLogicManager()

// Predefined retry configurations
export const databaseRetryConfig = retryLogicManager.createConfig('database', {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  jitter: true,
  retryCondition: (error) => 
    error.message.includes('connection') || 
    error.message.includes('timeout') ||
    error.message.includes('ECONNRESET')
})

export const redisRetryConfig = retryLogicManager.createConfig('redis', {
  maxAttempts: 5,
  baseDelay: 500,
  maxDelay: 5000,
  backoffMultiplier: 1.5,
  jitter: true,
  retryCondition: (error) => 
    error.message.includes('connection') || 
    error.message.includes('timeout')
})

export const externalApiRetryConfig = retryLogicManager.createConfig('external-api', {
  maxAttempts: 3,
  baseDelay: 2000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryCondition: (error) => 
    error.message.includes('timeout') ||
    error.message.includes('ECONNRESET') ||
    error.message.includes('ENOTFOUND')
})

// Retry decorator
export function withRetry(configName: string, customConfig?: RetryConfig) {
  return function (_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value
    const config = customConfig || retryLogicManager.getConfig(configName)
    
    if (!config) {
      throw new Error(`Retry config ${configName} not found`)
    }

    const retryLogic = new RetryLogic(config)

    descriptor.value = async function (...args: any[]) {
      const result = await retryLogic.execute(() => method.apply(this, args))
      
      if (!result.success) {
        throw result.error
      }
      
      return result.result
    }
  }
}

// Retry utility functions
export async function retry<T>(
  operation: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  const retryLogic = new RetryLogic(config)
  const result = await retryLogic.execute(operation)
  
  if (!result.success) {
    throw result.error
  }
  
  return result.result!
}

export async function retryWithConfig<T>(
  operation: () => Promise<T>,
  configName: string
): Promise<T> {
  const config = retryLogicManager.getConfig(configName)
  if (!config) {
    throw new Error(`Retry config ${configName} not found`)
  }
  
  return retry(operation, config)
}

// Exponential backoff retry
export async function exponentialBackoffRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000
): Promise<T> {
  const config: RetryConfig = {
    maxAttempts,
    baseDelay,
    maxDelay,
    backoffMultiplier: 2,
    jitter: true
  }
  
  return retry(operation, config)
}

// Linear backoff retry
export async function linearBackoffRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  const config: RetryConfig = {
    maxAttempts,
    baseDelay: delay,
    maxDelay: delay,
    backoffMultiplier: 1,
    jitter: false
  }
  
  return retry(operation, config)
}

// Fixed delay retry
export async function fixedDelayRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  const config: RetryConfig = {
    maxAttempts,
    baseDelay: delay,
    maxDelay: delay,
    backoffMultiplier: 1,
    jitter: false
  }
  
  return retry(operation, config)
}

// Retry with circuit breaker
export async function retryWithCircuitBreaker<T>(
  operation: () => Promise<T>,
  retryConfig: RetryConfig,
  circuitBreakerName: string
): Promise<T> {
  const { circuitBreakerManager } = await import('./circuit-breaker')
  const circuitBreaker = circuitBreakerManager.getBreaker(circuitBreakerName)
  
  if (!circuitBreaker) {
    throw new Error(`Circuit breaker ${circuitBreakerName} not found`)
  }
  
  return circuitBreaker.execute(async () => {
    const retryLogic = new RetryLogic(retryConfig)
    const result = await retryLogic.execute(operation)
    
    if (!result.success) {
      throw result.error
    }
    
    return result.result!
  })
}

// Health check for retry logic
export function getRetryLogicHealth(): {
  status: 'healthy' | 'degraded' | 'unhealthy'
  configs: Array<{ name: string; maxAttempts: number; baseDelay: number }>
} {
  const configs = retryLogicManager.getAllConfigs()
  const configArray = Array.from(configs.entries()).map(([name, config]) => ({
    name,
    maxAttempts: config.maxAttempts,
    baseDelay: config.baseDelay
  }))
  
  return {
    status: 'healthy',
    configs: configArray
  }
}

export default retryLogicManager
