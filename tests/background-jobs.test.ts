import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test'

const debugMock = mock(() => {})
const infoMock = mock(() => {})
const warnMock = mock(() => {})
const errorMock = mock(() => {})
const systemMock = mock(() => {})

mock.module('../src/lib/logger', () => ({
  logger: {
    debug: debugMock,
    info: infoMock,
    warn: warnMock,
    error: errorMock,
    system: systemMock,
  },
}))

let currentDbImplementation: any = {
  userAnimeList: {
    groupBy: async () => [],
  },
}

mock.module('../src/lib/db', () => ({
  get db() {
    return currentDbImplementation
  },
  getDbWithoutOptimize: () => currentDbImplementation,
}))

const {
  jobQueue,
  scheduleTrendingUpdate,
  resetBackgroundJobStateForTests,
} = await import('../src/lib/background-jobs')

async function flushMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
}

describe('Background job queue', () => {
  let originalSetTimeout: typeof globalThis.setTimeout
  let originalClearTimeout: typeof globalThis.clearTimeout
  let originalSetInterval: typeof globalThis.setInterval
  let originalClearInterval: typeof globalThis.clearInterval

  let nextTimerId: number
  let scheduledTimeouts: Map<number, () => void>
  let scheduledIntervals: Map<number, () => void>
  let waitForExecution: () => Promise<void>

  function runScheduledTimeouts() {
    const callbacks = Array.from(scheduledTimeouts.values())
    scheduledTimeouts.clear()
    callbacks.forEach((cb) => cb())
  }

  function runScheduledIntervals() {
    for (const cb of scheduledIntervals.values()) {
      cb()
    }
  }

  beforeEach(async () => {
    debugMock.mockReset()
    infoMock.mockReset()
    warnMock.mockReset()
    errorMock.mockReset()
    systemMock.mockReset()

    currentDbImplementation = {
      userAnimeList: {
        groupBy: async () => [],
      },
    }

    originalSetTimeout = globalThis.setTimeout
    originalClearTimeout = globalThis.clearTimeout
    originalSetInterval = globalThis.setInterval
    originalClearInterval = globalThis.clearInterval

    nextTimerId = 1
    scheduledTimeouts = new Map()
    scheduledIntervals = new Map()

    waitForExecution = () =>
      new Promise<void>((resolve) => {
        originalSetTimeout(resolve, 0)
      })

    globalThis.setTimeout = ((callback: TimerHandler): ReturnType<typeof setTimeout> => {
      const id = nextTimerId++
      scheduledTimeouts.set(id, () => {
        if (typeof callback === 'function') {
          callback()
        }
      })
      return id
    }) as typeof setTimeout

    globalThis.clearTimeout = ((timerId: number) => {
      scheduledTimeouts.delete(timerId)
    }) as typeof clearTimeout

    globalThis.setInterval = ((callback: TimerHandler): ReturnType<typeof setInterval> => {
      const id = nextTimerId++
      scheduledIntervals.set(id, () => {
        if (typeof callback === 'function') {
          callback()
        }
      })
      return id
    }) as typeof setInterval

    globalThis.clearInterval = ((timerId: number) => {
      scheduledIntervals.delete(timerId)
    }) as typeof clearInterval

    await resetBackgroundJobStateForTests()
  })

  afterEach(async () => {
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
    globalThis.setInterval = originalSetInterval
    globalThis.clearInterval = originalClearInterval
    await resetBackgroundJobStateForTests()
  })

  it('retries failed one-time jobs with exponential backoff', async () => {
    let attempt = 0
    const handler = mock(async () => {
      attempt += 1
      if (attempt === 1) {
        throw new Error('Transient failure')
      }
    })

    await jobQueue.enqueue('retry-job', handler, 3)
    await flushMicrotasks()
    await waitForExecution()

    // Simulate executing the scheduled retry
    runScheduledTimeouts()
    await flushMicrotasks()
    await waitForExecution()

    expect(handler.mock.calls.length).toBe(2)
    expect(errorMock.mock.calls.length).toBeGreaterThanOrEqual(1)
    expect(infoMock.mock.calls.some(([message]) => message.includes('Retrying job'))).toBe(true)
  })

  it('suppresses duplicate warnings when database is unavailable for trending update', async () => {
    currentDbImplementation = {
      userAnimeList: {
        groupBy: mock(async () => {
          throw new Error("Can't reach database server (P1001)")
        }),
      },
    }

    const jobId = scheduleTrendingUpdate()
    await flushMicrotasks()
    await waitForExecution()

    expect(warnMock.mock.calls.length).toBe(1)
    expect(warnMock.mock.calls[0][0]).toContain('Skipping trending update')

    // Trigger next scheduled run
    runScheduledIntervals()
    await flushMicrotasks()
    await waitForExecution()

    expect(warnMock.mock.calls.length).toBe(1)
    expect(
      debugMock.mock.calls.some(([message]) =>
        message.includes('Trending update still skipped - database unavailable')
      )
    ).toBe(true)
    expect(errorMock.mock.calls.length).toBe(0)

    jobQueue.cancel(jobId)
  })
})

