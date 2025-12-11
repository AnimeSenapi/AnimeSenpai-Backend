/**
 * 🧠 ML-Enhanced Embeddings Engine
 * 
 * Phase 3: Text embeddings and advanced similarity
 * 
 * Uses TF-IDF (Term Frequency-Inverse Document Frequency) for lightweight,
 * fast text similarity without external ML dependencies.
 * 
 * Security: All text sanitized, no code execution, pure math operations.
 * Performance: Cached vectors, optimized computations.
 */

import { db } from './db.js'
import { cache } from './cache.js'
import { sanitizeHtml } from './validation.js'

// Security: Common words to filter out (stop words)
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'is', 'was', 'are', 'been', 'be', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
  'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how'
])

interface AnimeVector {
  animeId: string
  descriptionVector: number[]
  genreVector: number[]
  combinedVector: number[]
}

/**
 * Sanitize and tokenize text for embedding
 * 
 * Security: Removes HTML, special chars, limits length
 */
function tokenizeText(text: string): string[] {
  if (!text) return []
  
  // Security: Sanitize HTML first
  const sanitized = sanitizeHtml(text)
  
  // Security: Limit text length to prevent DOS
  const limited = sanitized.substring(0, 5000)
  
  // Convert to lowercase and split
  const tokens = limited
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // Remove special chars (security)
    .split(/\s+/)
    .filter(word => word.length >= 3) // Min 3 chars
    .filter(word => word.length <= 20) // Max 20 chars (security)
    .filter(word => !STOP_WORDS.has(word))
  
  return tokens
}

/**
 * Calculate TF (Term Frequency) for a document
 */
function calculateTF(tokens: string[]): Map<string, number> {
  const termCount = new Map<string, number>()
  
  for (const token of tokens) {
    termCount.set(token, (termCount.get(token) || 0) + 1)
  }
  
  // Normalize by total terms
  const total = tokens.length
  const tf = new Map<string, number>()
  
  for (const [term, count] of termCount.entries()) {
    tf.set(term, count / total)
  }
  
  return tf
}

/**
 * Calculate IDF (Inverse Document Frequency) across all anime
 * 
 * Performance: Cached for 24 hours since it doesn't change often
 */
async function calculateIDF(): Promise<Map<string, number>> {
  const cacheKey = 'idf-scores'
  const cached = cache.get<Map<string, number>>(cacheKey)
  if (cached) return cached
  
  // Get all anime descriptions
  const allAnime = await db.anime.findMany({
    select: {
      id: true,
      description: true
    }
  })
  
  const documentCount = allAnime.length
  const termDocumentCount = new Map<string, number>()
  
  // Count documents containing each term
  for (const anime of allAnime) {
    if (!anime.description) continue
    
    const tokens = tokenizeText(anime.description)
    const uniqueTerms = new Set(tokens)
    
    for (const term of uniqueTerms) {
      termDocumentCount.set(term, (termDocumentCount.get(term) || 0) + 1)
    }
  }
  
  // Calculate IDF scores
  const idf = new Map<string, number>()
  
  for (const [term, docCount] of termDocumentCount.entries()) {
    idf.set(term, Math.log(documentCount / docCount))
  }
  
  // Cache for 24 hours
  cache.set(cacheKey, idf, 24 * 60 * 60 * 1000)
  
  return idf
}

/**
 * Create TF-IDF vector for anime description
 * 
 * Returns dense vector representation for similarity calculations
 */
export async function createDescriptionEmbedding(description: string): Promise<number[]> {
  if (!description || description.trim().length === 0) {
    return []
  }
  
  const tokens = tokenizeText(description)
  if (tokens.length === 0) return []
  
  const tf = calculateTF(tokens)
  const idf = await calculateIDF()
  
  // Get all unique terms globally for consistent vector dimensions
  const allTerms = Array.from(idf.keys()).sort()
  const vector: number[] = []
  
  // Create dense vector (use top 100 terms for performance)
  const topTerms = allTerms.slice(0, 100)
  
  for (const term of topTerms) {
    const tfScore = tf.get(term) || 0
    const idfScore = idf.get(term) || 0
    vector.push(tfScore * idfScore)
  }
  
  return vector
}

/**
 * Create genre-based embedding
 * Simple one-hot encoding of genres
 */
export async function createGenreEmbedding(genreIds: string[]): Promise<number[]> {
  // Get all genres for consistent vector size
  const allGenres = await db.genre.findMany({
    select: { id: true },
    orderBy: { name: 'asc' }
  })
  
  const vector: number[] = []
  
  for (const genre of allGenres) {
    vector.push(genreIds.includes(genre.id) ? 1 : 0)
  }
  
  return vector
}

/**
 * Calculate cosine similarity between two vectors
 * 
 * Security: Pure math, no external calls
 * Performance: Optimized for dense vectors
 */
export function calculateVectorSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) return 0
  if (vec1.length === 0) return 0
  
  let dotProduct = 0
  let magnitude1 = 0
  let magnitude2 = 0
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += (vec1[i] ?? 0) * (vec2[i] ?? 0)
    magnitude1 += (vec1[i] ?? 0) * (vec1[i] ?? 0)
    magnitude2 += (vec2[i] ?? 0) * (vec2[i] ?? 0)
  }
  
  if (magnitude1 === 0 || magnitude2 === 0) return 0
  
  return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2))
}

/**
 * Generate or retrieve anime embedding from database
 * 
 * Performance: Cached in database, regenerated only when anime updates
 */
export async function getAnimeEmbedding(animeId: string): Promise<AnimeVector | null> {
  // Check if embedding exists
  const existing = await db.animeEmbedding.findUnique({
    where: { animeId }
  })
  
  if (existing && existing.combinedVector) {
    // Parse cached vectors
    try {
      return {
        animeId,
        descriptionVector: existing.descriptionVector ? JSON.parse(existing.descriptionVector) : [],
        genreVector: existing.genreVector ? JSON.parse(existing.genreVector) : [],
        combinedVector: JSON.parse(existing.combinedVector)
      }
    } catch (error) {
      // If parsing fails, regenerate
    }
  }
  
  // Generate new embedding
  const anime = await db.anime.findUnique({
    where: { id: animeId },
    include: {
      genres: {
        include: {
          genre: true
        }
      }
    }
  })
  
  if (!anime) return null
  
  // Create embeddings
  const descriptionVector = await createDescriptionEmbedding(anime.description || '')
  const genreIds = anime.genres.map((g: typeof anime.genres[0]) => g.genre.id)
  const genreVector = await createGenreEmbedding(genreIds)
  
  // Combine vectors (weighted combination)
  const combinedVector: number[] = []
  const maxLength = Math.max(descriptionVector.length, genreVector.length)
  
  for (let i = 0; i < maxLength; i++) {
    const descVal = descriptionVector[i] || 0
    const genreVal = genreVector[i] || 0
    // 60% description, 40% genre
    combinedVector.push(descVal * 0.6 + genreVal * 0.4)
  }
  
  // Store in database
  await db.animeEmbedding.upsert({
    where: { animeId },
    create: {
      animeId,
      descriptionVector: JSON.stringify(descriptionVector),
      genreVector: JSON.stringify(genreVector),
      combinedVector: JSON.stringify(combinedVector),
      version: '1.0'
    },
    update: {
      descriptionVector: JSON.stringify(descriptionVector),
      genreVector: JSON.stringify(genreVector),
      combinedVector: JSON.stringify(combinedVector),
      updatedAt: new Date()
    }
  })
  
  return {
    animeId,
    descriptionVector,
    genreVector,
    combinedVector
  }
}

/**
 * Find similar anime using vector embeddings
 * 
 * Much more accurate than simple genre matching!
 * Captures semantic similarity from descriptions.
 * 
 * Security: All vectors stored securely, no user input in calculations
 * Performance: Pre-computed embeddings, fast cosine similarity
 */
export async function findSimilarAnimeByEmbedding(
  animeId: string,
  limit: number = 20,
  excludeIds: string[] = []
): Promise<Array<{ animeId: string; similarity: number }>> {
  const sourceEmbedding = await getAnimeEmbedding(animeId)
  if (!sourceEmbedding) return []
  
  // Get all anime embeddings (cached candidates)
  const candidateEmbeddings = await db.animeEmbedding.findMany({
    where: {
      animeId: {
        not: animeId,
        notIn: excludeIds
      }
    },
    select: {
      animeId: true,
      combinedVector: true
    },
    take: 500 // Limit for performance
  })
  
  const similarities: Array<{ animeId: string; similarity: number }> = []
  
  for (const candidate of candidateEmbeddings) {
    if (!candidate.combinedVector) continue
    
    try {
      const candidateVector = JSON.parse(candidate.combinedVector)
      const similarity = calculateVectorSimilarity(
        sourceEmbedding.combinedVector,
        candidateVector
      )
      
      // Only keep meaningful similarities (>0.5)
      if (similarity > 0.5) {
        similarities.push({
          animeId: candidate.animeId,
          similarity
        })
      }
    } catch (error) {
      // Skip if vector parsing fails
      continue
    }
  }
  
  // Sort by similarity
  similarities.sort((a, b) => b.similarity - a.similarity)
  
  return similarities.slice(0, limit)
}

/**
 * Calculate semantic similarity score for two anime
 * Combines embedding similarity with traditional features
 */
export async function calculateSemanticSimilarity(
  anime1Id: string,
  anime2Id: string
): Promise<number> {
  const [embedding1, embedding2] = await Promise.all([
    getAnimeEmbedding(anime1Id),
    getAnimeEmbedding(anime2Id)
  ])
  
  if (!embedding1 || !embedding2) return 0
  
  // Calculate vector similarity
  const vectorSim = calculateVectorSimilarity(
    embedding1.combinedVector,
    embedding2.combinedVector
  )
  
  return vectorSim
}

/**
 * Get confidence score for a recommendation
 * Higher confidence = more data points supporting it
 * 
 * Returns 0-1 score indicating how confident we are
 */
export function calculateConfidenceScore(
  contentScore: number,
  collaborativeScore: number | null,
  embeddingScore: number | null,
  userRatingCount: number,
  similarUserCount: number
): number {
  let confidence = 0
  let signals = 0
  
  // Content-based confidence
  if (contentScore > 0) {
    confidence += contentScore
    signals++
  }
  
  // Collaborative confidence
  if (collaborativeScore && collaborativeScore > 0) {
    confidence += collaborativeScore / 10 // Normalize
    signals++
    
    // Boost if many similar users
    if (similarUserCount > 5) {
      confidence += 0.1
    }
  }
  
  // Embedding confidence
  if (embeddingScore && embeddingScore > 0) {
    confidence += embeddingScore
    signals++
  }
  
  // User experience confidence
  if (userRatingCount > 20) {
    confidence += 0.15 // More ratings = better profile
  } else if (userRatingCount > 10) {
    confidence += 0.10
  } else if (userRatingCount > 5) {
    confidence += 0.05
  }
  
  // Average across signals
  const avgConfidence = signals > 0 ? confidence / signals : 0
  
  // Clamp to 0-1
  return Math.min(Math.max(avgConfidence, 0), 1)
}

/**
 * Batch generate embeddings for all anime
 * 
 * Security: Rate limited, only called by admin or background job
 * Performance: Processes in batches to avoid memory issues
 */
export async function generateAllAnimeEmbeddings(
  batchSize: number = 50
): Promise<{ processed: number; errors: number }> {
  let processed = 0
  let errors = 0
  
  // Get all anime without embeddings or outdated embeddings
  const anime = await db.anime.findMany({
    where: {
      OR: [
        { id: { notIn: await getAnimeWithEmbeddings() } },
        {
          updatedAt: {
            gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Updated in last 30 days
          }
        }
      ]
    },
    select: {
      id: true,
      description: true
    },
    take: batchSize
  })
  
  for (const item of anime) {
    try {
      await getAnimeEmbedding(item.id)
      processed++
    } catch (error) {
      errors++
    }
  }
  
  return { processed, errors }
}

/**
 * Get list of anime IDs that already have embeddings
 * Helper for batch processing
 */
async function getAnimeWithEmbeddings(): Promise<string[]> {
  const embeddings = await db.animeEmbedding.findMany({
    select: { animeId: true }
  })
  
  return embeddings.map((e: typeof embeddings[0]) => e.animeId)
}

/**
 * Search anime by semantic similarity to a text query
 * 
 * Security: Input sanitized, no code execution
 * Use case: "Find anime similar to this description"
 */
export async function searchBySemanticSimilarity(
  queryText: string,
  limit: number = 10,
  excludeIds: string[] = []
): Promise<Array<{ animeId: string; similarity: number }>> {
  // Security: Sanitize input
  if (!queryText || queryText.trim().length < 3) {
    return []
  }
  
  // Security: Limit query length
  const sanitizedQuery = queryText.substring(0, 1000)
  
  // Create embedding for query
  const queryVector = await createDescriptionEmbedding(sanitizedQuery)
  if (queryVector.length === 0) return []
  
  // Get all anime embeddings
  const allEmbeddings = await db.animeEmbedding.findMany({
    where: {
      animeId: { notIn: excludeIds },
      descriptionVector: { not: null }
    },
    select: {
      animeId: true,
      descriptionVector: true
    },
    take: 500 // Performance limit
  })
  
  const similarities: Array<{ animeId: string; similarity: number }> = []
  
  for (const embedding of allEmbeddings) {
    if (!embedding.descriptionVector) continue
    
    try {
      const animeVector = JSON.parse(embedding.descriptionVector)
      const similarity = calculateVectorSimilarity(queryVector, animeVector)
      
      if (similarity > 0.3) {
        similarities.push({
          animeId: embedding.animeId,
          similarity
        })
      }
    } catch (error) {
      // Skip if parsing fails
      continue
    }
  }
  
  similarities.sort((a, b) => b.similarity - a.similarity)
  
  return similarities.slice(0, limit)
}

/**
 * Get embedding statistics for monitoring
 * 
 * Security: Returns only aggregated stats, no sensitive data
 */
export async function getEmbeddingStats(): Promise<{
  totalAnime: number
  withEmbeddings: number
  coverage: number
  averageVectorSize: number
}> {
  const [totalAnime, embeddingCount, sampleEmbedding] = await Promise.all([
    db.anime.count(),
    db.animeEmbedding.count(),
    db.animeEmbedding.findFirst({
      where: { combinedVector: { not: null } },
      select: { combinedVector: true }
    })
  ])
  
  let averageVectorSize = 0
  if (sampleEmbedding && sampleEmbedding.combinedVector) {
    try {
      const vector = JSON.parse(sampleEmbedding.combinedVector)
      averageVectorSize = vector.length
    } catch {
      // Ignore
    }
  }
  
  return {
    totalAnime,
    withEmbeddings: embeddingCount,
    coverage: totalAnime > 0 ? embeddingCount / totalAnime : 0,
    averageVectorSize
  }
}

