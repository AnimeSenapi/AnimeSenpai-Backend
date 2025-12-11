/**
 * Database Query Optimizer
 * 
 * Provides query analysis, optimization suggestions, and performance monitoring
 * for database operations in the AnimeSenpai backend.
 */

import { getBaseClientForEvents } from './db.js'
import { logger } from './logger.js'

// Query performance metrics
interface QueryMetrics {
  query: string
  duration: number
  timestamp: number
  parameters?: any[]
  cached: boolean
  optimized: boolean
  suggestions: string[]
}

// Query optimization suggestions
interface OptimizationSuggestion {
  type: 'index' | 'join' | 'where' | 'select' | 'cache' | 'pagination'
  priority: 'low' | 'medium' | 'high' | 'critical'
  description: string
  impact: string
  query?: string
  index?: string
}

// Database index recommendations
interface IndexRecommendation {
  table: string
  columns: string[]
  type: 'btree' | 'hash' | 'gin' | 'gist'
  priority: 'low' | 'medium' | 'high' | 'critical'
  reason: string
  estimatedImpact: string
}

class QueryOptimizer {
  private queryMetrics: QueryMetrics[] = []
  private slowQueryThreshold = 1000 // 1 second
  private queryCache = new Map<string, { result: any; timestamp: number; ttl: number }>()
  private indexRecommendations: IndexRecommendation[] = []

  constructor() {
    this.initializeIndexRecommendations()
    this.startQueryAnalysis()
  }

  /**
   * Initialize recommended database indexes
   */
  private initializeIndexRecommendations(): void {
    this.indexRecommendations = [
      // User table indexes
      {
        table: 'User',
        columns: ['email'],
        type: 'btree',
        priority: 'critical',
        reason: 'Unique email lookups for authentication',
        estimatedImpact: 'High - used in every login request'
      },
      {
        table: 'User',
        columns: ['username'],
        type: 'btree',
        priority: 'high',
        reason: 'Username lookups for profile access',
        estimatedImpact: 'High - used in profile and social features'
      },
      {
        table: 'User',
        columns: ['createdAt'],
        type: 'btree',
        priority: 'medium',
        reason: 'User registration date sorting and filtering',
        estimatedImpact: 'Medium - used in admin and analytics queries'
      },
      {
        table: 'User',
        columns: ['lastLoginAt'],
        type: 'btree',
        priority: 'medium',
        reason: 'Active user filtering and analytics',
        estimatedImpact: 'Medium - used in user activity reports'
      },

      // Anime table indexes
      {
        table: 'Anime',
        columns: ['slug'],
        type: 'btree',
        priority: 'critical',
        reason: 'Slug-based anime lookups',
        estimatedImpact: 'High - used in all anime detail pages'
      },
      {
        table: 'Anime',
        columns: ['malId'],
        type: 'btree',
        priority: 'high',
        reason: 'MyAnimeList ID lookups for data synchronization',
        estimatedImpact: 'High - used in external API integrations'
      },
      {
        table: 'Anime',
        columns: ['title'],
        type: 'btree',
        priority: 'high',
        reason: 'Title-based search operations',
        estimatedImpact: 'High - used in search functionality'
      },
      {
        table: 'Anime',
        columns: ['averageRating'],
        type: 'btree',
        priority: 'medium',
        reason: 'Rating-based sorting and filtering',
        estimatedImpact: 'Medium - used in recommendation algorithms'
      },
      {
        table: 'Anime',
        columns: ['year'],
        type: 'btree',
        priority: 'medium',
        reason: 'Year-based filtering and sorting',
        estimatedImpact: 'Medium - used in browse and filter features'
      },
      {
        table: 'Anime',
        columns: ['status'],
        type: 'btree',
        priority: 'medium',
        reason: 'Status-based filtering',
        estimatedImpact: 'Medium - used in anime status filtering'
      },

      // UserAnimeList table indexes
      {
        table: 'UserAnimeList',
        columns: ['userId', 'status'],
        type: 'btree',
        priority: 'critical',
        reason: 'User anime list queries by status',
        estimatedImpact: 'High - used in user dashboard and lists'
      },
      {
        table: 'UserAnimeList',
        columns: ['userId', 'animeId'],
        type: 'btree',
        priority: 'critical',
        reason: 'Unique user-anime relationship lookups',
        estimatedImpact: 'High - used in duplicate prevention and updates'
      },
      {
        table: 'UserAnimeList',
        columns: ['userId', 'updatedAt'],
        type: 'btree',
        priority: 'high',
        reason: 'Recent activity sorting',
        estimatedImpact: 'High - used in activity feeds and recent updates'
      },

      // Review table indexes
      {
        table: 'UserAnimeReview',
        columns: ['animeId'],
        type: 'btree',
        priority: 'high',
        reason: 'Anime review lookups',
        estimatedImpact: 'High - used in anime detail pages'
      },
      {
        table: 'UserAnimeReview',
        columns: ['userId'],
        type: 'btree',
        priority: 'medium',
        reason: 'User review lookups',
        estimatedImpact: 'Medium - used in user profile pages'
      },
      {
        table: 'UserAnimeReview',
        columns: ['animeId', 'createdAt'],
        type: 'btree',
        priority: 'medium',
        reason: 'Recent reviews sorting',
        estimatedImpact: 'Medium - used in review sorting and pagination'
      },

      // Achievement table indexes
      {
        table: 'Achievement',
        columns: ['category'],
        type: 'btree',
        priority: 'medium',
        reason: 'Category-based achievement filtering',
        estimatedImpact: 'Medium - used in achievement browsing'
      },
      {
        table: 'Achievement',
        columns: ['tier'],
        type: 'btree',
        priority: 'medium',
        reason: 'Tier-based achievement sorting',
        estimatedImpact: 'Medium - used in achievement progression'
      },

      // UserAchievement table indexes
      {
        table: 'UserAchievement',
        columns: ['userId'],
        type: 'btree',
        priority: 'high',
        reason: 'User achievement lookups',
        estimatedImpact: 'High - used in user profile and progress tracking'
      },
      {
        table: 'UserAchievement',
        columns: ['achievementId'],
        type: 'btree',
        priority: 'medium',
        reason: 'Achievement statistics',
        estimatedImpact: 'Medium - used in achievement analytics'
      },

      // Genre table indexes
      {
        table: 'Genre',
        columns: ['name'],
        type: 'btree',
        priority: 'high',
        reason: 'Genre name lookups',
        estimatedImpact: 'High - used in genre filtering and search'
      },

      // AnimeGenre junction table indexes
      {
        table: 'AnimeGenre',
        columns: ['animeId', 'genreId'],
        type: 'btree',
        priority: 'high',
        reason: 'Anime-genre relationship queries',
        estimatedImpact: 'High - used in genre-based filtering'
      },
      {
        table: 'AnimeGenre',
        columns: ['genreId'],
        type: 'btree',
        priority: 'medium',
        reason: 'Genre-based anime lookups',
        estimatedImpact: 'Medium - used in genre pages'
      }
    ]
  }

  /**
   * Start query analysis and monitoring
   */
  private startQueryAnalysis(): void {
    // Monitor Prisma queries
    // Use base client for event listeners since extended clients don't expose $on
    const baseClient = getBaseClientForEvents()
    if (process.env.NODE_ENV === 'development' && baseClient) {
      // @ts-ignore - Prisma event emitter
      baseClient.$on('query', (e: any) => {
        this.analyzeQuery(e.query, e.duration, e.params)
      })
    }

    // Cleanup old metrics every hour
    setInterval(() => {
      this.cleanupOldMetrics()
    }, 60 * 60 * 1000)
  }

  /**
   * Analyze a database query
   */
  private analyzeQuery(query: string, duration: number, params?: any[]): void {
    const metrics: QueryMetrics = {
      query: this.normalizeQuery(query),
      duration,
      timestamp: Date.now(),
      ...(params !== undefined && { parameters: params }),
      cached: false,
      optimized: false,
      suggestions: []
    }

    // Check if query is slow
    if (duration > this.slowQueryThreshold) {
      metrics.suggestions = this.generateOptimizationSuggestions(query, duration)
      logger.warn('Slow query detected', undefined, {
        query: metrics.query,
        duration,
        suggestions: metrics.suggestions
      })
    }

    // Check for optimization opportunities
    const optimizations = this.identifyOptimizationOpportunities(query)
    if (optimizations.length > 0) {
      metrics.optimized = true
      metrics.suggestions.push(...optimizations)
    }

    this.queryMetrics.push(metrics)

    // Store in cache for analysis
    this.cacheQueryMetrics(metrics)
  }

  /**
   * Normalize query for analysis
   */
  private normalizeQuery(query: string): string {
    return query
      .replace(/\s+/g, ' ')
      .replace(/\$\d+/g, '?')
      .trim()
      .toLowerCase()
  }

  /**
   * Generate optimization suggestions for slow queries
   */
  private generateOptimizationSuggestions(query: string, duration: number): string[] {
    const suggestions: string[] = []

    // Check for missing indexes
    if (query.includes('where') && !query.includes('order by')) {
      suggestions.push('Consider adding an index on WHERE clause columns')
    }

    // Check for inefficient joins
    if (query.includes('join') && duration > 2000) {
      suggestions.push('Consider optimizing JOIN conditions or adding indexes')
    }

    // Check for SELECT * usage
    if (query.includes('select *')) {
      suggestions.push('Avoid SELECT * - specify only needed columns')
    }

    // Check for missing LIMIT
    if (!query.includes('limit') && !query.includes('count(')) {
      suggestions.push('Consider adding LIMIT clause for large result sets')
    }

    // Check for complex WHERE clauses
    const whereClause = query.split('where')[1]
    if (query.includes('where') && whereClause && whereClause.split(' ').length > 10) {
      suggestions.push('Consider simplifying WHERE clause or adding composite indexes')
    }

    return suggestions
  }

  /**
   * Identify optimization opportunities
   */
  private identifyOptimizationOpportunities(query: string): string[] {
    const opportunities: string[] = []

    // Check for cacheable queries
    if (this.isCacheableQuery(query)) {
      opportunities.push('Query is cacheable - consider implementing caching')
    }

    // Check for pagination opportunities
    if (query.includes('select') && !query.includes('limit')) {
      opportunities.push('Consider implementing pagination for better performance')
    }

    // Check for N+1 query patterns
    if (this.detectNPlusOnePattern(query)) {
      opportunities.push('Potential N+1 query pattern - consider eager loading')
    }

    return opportunities
  }

  /**
   * Check if query is cacheable
   */
  private isCacheableQuery(query: string): boolean {
    const cacheablePatterns = [
      'select',
      'from',
      'where',
      'order by'
    ]

    const nonCacheablePatterns = [
      'insert',
      'update',
      'delete',
      'create',
      'drop',
      'alter'
    ]

    const hasCacheablePattern = cacheablePatterns.some(pattern => query.includes(pattern))
    const hasNonCacheablePattern = nonCacheablePatterns.some(pattern => query.includes(pattern))

    return hasCacheablePattern && !hasNonCacheablePattern
  }

  /**
   * Detect N+1 query patterns
   */
  private detectNPlusOnePattern(query: string): boolean {
    // This is a simplified detection - in practice, you'd analyze query patterns over time
    return query.includes('where') && query.includes('in (') && query.includes('select')
  }

  /**
   * Cache query metrics for analysis
   */
  private cacheQueryMetrics(metrics: QueryMetrics): void {
    const cacheKey = `query:${metrics.query}`
    this.queryCache.set(cacheKey, {
      result: metrics,
      timestamp: Date.now(),
      ttl: 3600000 // 1 hour
    })
  }

  /**
   * Get query performance statistics
   */
  getQueryStats(): {
    totalQueries: number
    slowQueries: number
    averageDuration: number
    slowestQuery: QueryMetrics | null
    mostCommonQueries: Array<{ query: string; count: number; avgDuration: number }>
    optimizationSuggestions: OptimizationSuggestion[]
    indexRecommendations: IndexRecommendation[]
  } {
    const totalQueries = this.queryMetrics.length
    const slowQueries = this.queryMetrics.filter(q => q.duration > this.slowQueryThreshold).length
    const averageDuration = this.queryMetrics.reduce((sum, q) => sum + q.duration, 0) / totalQueries || 0
    const slowestQuery = this.queryMetrics.reduce((slowest, current) => 
      current.duration > slowest.duration ? current : slowest, 
      this.queryMetrics[0] || { duration: 0 } as QueryMetrics
    )

    // Group queries by normalized query
    const queryGroups = new Map<string, { count: number; totalDuration: number }>()
    this.queryMetrics.forEach(metric => {
      const existing = queryGroups.get(metric.query) || { count: 0, totalDuration: 0 }
      queryGroups.set(metric.query, {
        count: existing.count + 1,
        totalDuration: existing.totalDuration + metric.duration
      })
    })

    const mostCommonQueries = Array.from(queryGroups.entries())
      .map(([query, stats]) => ({
        query,
        count: stats.count,
        avgDuration: stats.totalDuration / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      totalQueries,
      slowQueries,
      averageDuration: Math.round(averageDuration),
      slowestQuery: slowestQuery.duration > 0 ? slowestQuery : null,
      mostCommonQueries,
      optimizationSuggestions: this.generateComprehensiveOptimizationSuggestions(),
      indexRecommendations: this.indexRecommendations
    }
  }

  /**
   * Generate comprehensive optimization suggestions
   */
  private generateComprehensiveOptimizationSuggestions(): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = []

    // Analyze query patterns
    const queryStats = this.getQueryStats()
    
    if (queryStats.slowQueries > queryStats.totalQueries * 0.1) {
      suggestions.push({
        type: 'index',
        priority: 'high',
        description: 'High number of slow queries detected',
        impact: 'Consider adding indexes or optimizing query patterns',
        query: 'Multiple queries'
      })
    }

    if (queryStats.averageDuration > 500) {
      suggestions.push({
        type: 'cache',
        priority: 'medium',
        description: 'High average query duration',
        impact: 'Implement query caching to reduce database load',
        query: 'All queries'
      })
    }

    // Add specific index recommendations
    this.indexRecommendations
      .filter(rec => rec.priority === 'critical')
      .forEach(rec => {
        suggestions.push({
          type: 'index',
          priority: 'critical',
          description: `Missing critical index on ${rec.table}.${rec.columns.join(', ')}`,
          impact: rec.estimatedImpact,
          index: `${rec.table}_${rec.columns.join('_')}_idx`
        })
      })

    return suggestions
  }

  /**
   * Optimize a specific query
   */
  async optimizeQuery(originalQuery: string, _parameters?: any[]): Promise<{
    optimized: boolean
    suggestions: string[]
    estimatedImprovement: number
  }> {
    const suggestions: string[] = []
    let estimatedImprovement = 0

    // Check for common optimization patterns
    if (originalQuery.includes('select *')) {
      suggestions.push('Replace SELECT * with specific columns')
      estimatedImprovement += 20
    }

    if (originalQuery.includes('order by') && !originalQuery.includes('limit')) {
      suggestions.push('Add LIMIT clause to ORDER BY queries')
      estimatedImprovement += 30
    }

    if (originalQuery.includes('where') && originalQuery.includes('like')) {
      suggestions.push('Consider using full-text search instead of LIKE for better performance')
      estimatedImprovement += 40
    }

    // Check for missing indexes
    const missingIndexes = this.findMissingIndexes(originalQuery)
    if (missingIndexes.length > 0) {
      suggestions.push(`Add indexes: ${missingIndexes.join(', ')}`)
      estimatedImprovement += 50
    }

    return {
      optimized: suggestions.length > 0,
      suggestions,
      estimatedImprovement: Math.min(estimatedImprovement, 80) // Cap at 80%
    }
  }

  /**
   * Find missing indexes for a query
   */
  private findMissingIndexes(query: string): string[] {
    const missingIndexes: string[] = []

    // This is a simplified implementation
    // In practice, you'd parse the query and analyze the WHERE clauses
    if (query.includes('where user_id =')) {
      missingIndexes.push('idx_user_id')
    }
    if (query.includes('where anime_id =')) {
      missingIndexes.push('idx_anime_id')
    }
    if (query.includes('where email =')) {
      missingIndexes.push('idx_email')
    }

    return missingIndexes
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000) // 24 hours
    this.queryMetrics = this.queryMetrics.filter(m => m.timestamp > cutoff)
    
    // Clean up query cache
    for (const [key, value] of this.queryCache.entries()) {
      if (value.timestamp + value.ttl < Date.now()) {
        this.queryCache.delete(key)
      }
    }

    logger.debug('Query metrics cleanup completed', {
      remainingMetrics: this.queryMetrics.length,
      remainingCacheEntries: this.queryCache.size
    })
  }

  /**
   * Generate database optimization report
   */
  generateOptimizationReport(): {
    summary: {
      totalQueries: number
      slowQueries: number
      averageDuration: number
      optimizationScore: number
    }
    recommendations: {
      indexes: IndexRecommendation[]
      queries: OptimizationSuggestion[]
    }
    performance: {
      topSlowQueries: QueryMetrics[]
      mostFrequentQueries: Array<{ query: string; count: number; avgDuration: number }>
    }
  } {
    const stats = this.getQueryStats()
    const optimizationScore = Math.max(0, 100 - (stats.slowQueries / stats.totalQueries) * 100)

    return {
      summary: {
        totalQueries: stats.totalQueries,
        slowQueries: stats.slowQueries,
        averageDuration: stats.averageDuration,
        optimizationScore: Math.round(optimizationScore)
      },
      recommendations: {
        indexes: this.indexRecommendations.filter(rec => rec.priority === 'critical' || rec.priority === 'high'),
        queries: stats.optimizationSuggestions
      },
      performance: {
        topSlowQueries: this.queryMetrics
          .filter(q => q.duration > this.slowQueryThreshold)
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 10),
        mostFrequentQueries: stats.mostCommonQueries
      }
    }
  }
}

// Singleton instance
export const queryOptimizer = new QueryOptimizer()

export default queryOptimizer
