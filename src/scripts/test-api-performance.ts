/**
 * ⚡ API Endpoint Performance Test
 * 
 * Tests all public API endpoints for speed
 */

interface TestResult {
  endpoint: string
  duration: number
  status: number
  size?: number
}

async function testEndpoint(name: string, url: string): Promise<TestResult> {
  const start = Date.now()
  
  try {
    const response = await fetch(url)
    const duration = Date.now() - start
    const text = await response.text()
    
    return {
      endpoint: name,
      duration,
      status: response.status,
      size: text.length
    }
  } catch (error) {
    return {
      endpoint: name,
      duration: Date.now() - start,
      status: 0
    }
  }
}

async function runTests() {
  console.log('⚡ API Performance Test Suite\n')
  console.log('Testing all public endpoints...\n')
  
  const tests = [
    // Backend API
    ['Get Trending Anime', 'http://localhost:3003/api/trpc/anime.getTrending'],
    ['Get All Anime', 'http://localhost:3003/api/trpc/anime.getAll'],
    ['Get All Series', 'http://localhost:3003/api/trpc/anime.getAllSeries'],
    ['Get Genres', 'http://localhost:3003/api/trpc/anime.getGenres'],
    ['Search: Naruto', 'http://localhost:3003/api/trpc/anime.search?input={"q":"naruto"}'],
    ['Get Top Rated', 'http://localhost:3003/api/trpc/anime.getTopRated'],
    
    // Frontend Pages
    ['Homepage', 'http://localhost:3002/'],
    ['Dashboard', 'http://localhost:3002/dashboard'],
    ['Search Page', 'http://localhost:3002/search'],
    ['Leaderboards', 'http://localhost:3002/leaderboards'],
  ]
  
  const results: TestResult[] = []
  
  for (const [name, url] of tests) {
    const result = await testEndpoint(name, url)
    results.push(result)
    
    const icon = result.status === 200 
      ? (result.duration < 100 ? '🟢' : result.duration < 500 ? '🟡' : '🟠')
      : '🔴'
    
    const sizeStr = result.size ? `${(result.size / 1024).toFixed(1)}KB` : 'N/A'
    console.log(`${icon} ${name.padEnd(25)} ${result.duration}ms (${result.status}) ${sizeStr}`)
  }
  
  // Summary
  const fast = results.filter(r => r.duration < 100 && r.status === 200).length
  const ok = results.filter(r => r.duration >= 100 && r.duration < 500 && r.status === 200).length
  const slow = results.filter(r => r.duration >= 500 && r.status === 200).length
  const failed = results.filter(r => r.status !== 200).length
  
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length
  
  console.log('\n' + '='.repeat(60))
  console.log('📊 Summary:')
  console.log(`  🟢 Fast (<100ms):   ${fast}`)
  console.log(`  🟡 OK (100-500ms):  ${ok}`)
  console.log(`  🟠 Slow (>500ms):   ${slow}`)
  console.log(`  🔴 Failed:          ${failed}`)
  console.log(`  ⚡ Average:         ${avgDuration.toFixed(0)}ms`)
  console.log('='.repeat(60))
  
  if (failed === 0 && slow === 0) {
    console.log('\n✅ Excellent! All endpoints are fast and responsive!')
  } else if (failed === 0) {
    console.log('\n✅ Good! All endpoints working, some could be optimized.')
  } else {
    console.log('\n⚠️  Some endpoints need attention.')
  }
}

runTests()

