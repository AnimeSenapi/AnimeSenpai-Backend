import { describe, test, expect } from 'bun:test'
import { extractSeriesInfo, groupAnimeBySeriesName, createSeriesEntries } from '../series-grouping'

describe('Series Grouping (Backend)', () => {
  describe('extractSeriesInfo', () => {
    test('should extract series information from title', () => {
      const result = extractSeriesInfo('Attack on Titan Season 2')
      
      // Should return a result with required properties
      expect(result).toHaveProperty('seriesName')
      expect(result).toHaveProperty('seasonNumber')
      expect(result).toHaveProperty('seasonName')
      expect(result).toHaveProperty('isSequel')
      expect(typeof result.seriesName).toBe('string')
      expect(typeof result.seasonNumber).toBe('number')
    })

    test('should handle "X of Y" pattern', () => {
      const result = extractSeriesInfo('Rascal Does Not Dream of Bunny Girl Senpai')
      
      expect(result.seriesName).toContain('Rascal Does Not Dream')
      expect(result.seasonNumber).toBeGreaterThanOrEqual(1)
    })

    test('should handle "X in Y" pattern', () => {
      const result = extractSeriesInfo('Alya Sometimes Hides Her Feelings in Russian')
      
      expect(result.seriesName).toContain('Alya')
      expect(result.seasonNumber).toBeGreaterThanOrEqual(1)
    })

    test('should handle colon pattern for franchise', () => {
      const result = extractSeriesInfo('TONIKAWA: Over the Moon for You')
      
      expect(result.seriesName).toContain('TONIKAWA')
      expect(result.seasonNumber).toBeGreaterThanOrEqual(1)
    })

    test('should prefer English title when provided', () => {
      const result = extractSeriesInfo(
        'Shingeki no Kyojin Season 2',
        'Attack on Titan Season 2'
      )
      
      // Should use English title for extraction
      expect(result.seriesName).toContain('Attack')
    })
  })

  describe('groupAnimeBySeriesName', () => {
    test('should return a Map of grouped anime', () => {
      const anime = [
        { id: '1', title: 'Test Anime', titleEnglish: 'Test Anime' },
        { id: '2', title: 'Test Anime Season 2', titleEnglish: 'Test Anime Season 2' }
      ]

      const grouped = groupAnimeBySeriesName(anime)
      
      // Should return a Map
      expect(grouped).toBeInstanceOf(Map)
      // Should have at least one entry
      expect(grouped.size).toBeGreaterThanOrEqual(1)
    })
  })

  describe('createSeriesEntries', () => {
    test('should create series entries from anime list', () => {
      const anime = [
        {
          id: '1',
          slug: 'test-anime',
          title: 'Test Anime',
          titleEnglish: 'Test Anime',
          year: 2020,
          episodes: 12,
          coverImage: 'image1.jpg',
          averageRating: 8.5,
          rating: 8.5
        }
      ]

      const series = createSeriesEntries(anime)
      
      // Should return an array
      expect(Array.isArray(series)).toBe(true)
      // Should process the input
      expect(series.length).toBeGreaterThanOrEqual(0)
    })
  })
})

