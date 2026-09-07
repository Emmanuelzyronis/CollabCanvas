export type RuntimeEnvironment = 'development' | 'test' | 'production'

export interface RuntimeConfig {
  environment: RuntimeEnvironment
  port: number
  databaseUrl?: string
}

export class RuntimeConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuntimeConfigError'
  }
}

function environment(value: string | undefined): RuntimeEnvironment {
  if (value === 'production' || value === 'test' || value === 'development') return value
  if (value === undefined || value === '') return 'development'
  throw new RuntimeConfigError('NODE_ENV must be development, test, or production.')
}

function port(value: string | undefined): number {
  const parsed = value === undefined || value === '' ? 8787 : Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) throw new RuntimeConfigError('PORT must be an integer between 1 and 65535.')
  return parsed
}

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const currentEnvironment = environment(env.NODE_ENV)
  const databaseUrl = env.DATABASE_URL?.trim() || undefined
  if (currentEnvironment === 'production' && !databaseUrl) throw new RuntimeConfigError('DATABASE_URL is required in production.')
  return Object.freeze({
    environment: currentEnvironment,
    port: port(env.PORT),
    ...(databaseUrl ? { databaseUrl } : {}),
  })
}
