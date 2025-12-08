import { readFileSync } from 'node:fs'

const MIN_LINES = 0.8 // 80% - required minimum coverage

try {
  const lcov = readFileSync('./coverage/lcov.info', 'utf8')
  let totalLF = 0
  let totalLH = 0
  for (const line of lcov.split('\n')) {
    if (line.startsWith('LF:')) totalLF += parseInt(line.slice(3))
    if (line.startsWith('LH:')) totalLH += parseInt(line.slice(3))
  }
  const pct = totalLF === 0 ? 1 : totalLH / totalLF
  console.log(`Lines coverage: ${(pct * 100).toFixed(2)}%`)
  if (pct < MIN_LINES) {
    console.error(`Coverage below threshold: ${(pct * 100).toFixed(2)}% < ${(MIN_LINES * 100).toFixed(0)}%`)
    process.exit(1)
  }
} catch (e) {
  console.error('Coverage check failed:', e?.message || e)
  process.exit(1)
}


