import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api'
import { BasicTracerProvider, SimpleSpanProcessor, BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { PrismaInstrumentation } from '@prisma/instrumentation'

// Ensure tracing is initialized only once
declare global {
  // eslint-disable-next-line no-var
  var __PRISMA_TRACING_INITIALIZED__: boolean | undefined
}

if (!globalThis.__PRISMA_TRACING_INITIALIZED__) {
  globalThis.__PRISMA_TRACING_INITIALIZED__ = true

  const isDevelopment = process.env.NODE_ENV !== 'production'

  const provider = new BasicTracerProvider()

  if (isDevelopment) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO)
    provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()))
  } else {
    provider.addSpanProcessor(new BatchSpanProcessor(new ConsoleSpanExporter()))
  }

  provider.register()

  registerInstrumentations({
    instrumentations: [
      new PrismaInstrumentation(),
    ],
  })
}

