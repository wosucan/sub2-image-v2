import { readRuntimeEnv } from './runtimeEnv'

export interface DevProxyConfig {
  enabled: boolean
  prefix: string
  target: string
  accountTarget?: string
  changeOrigin: boolean
  secure: boolean
}

const DEFAULT_PROXY_PREFIX = '/api-proxy'
const API_VERSION_SEGMENT_RE = /^v\d+(?:[a-z]+)?$/i

export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim()
  if (!trimmed) return ''

  const input = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    const url = new URL(input)
    if (trimmed.endsWith('/')) return `${url.origin}${url.pathname.replace(/\/+$/, '/')}`

    const pathSegments = url.pathname.split('/').filter(Boolean)
    const v1Index = pathSegments.indexOf('v1')
    const normalizedSegments = v1Index >= 0
      ? pathSegments.slice(0, v1Index + 1)
      : pathSegments.length
        ? [...pathSegments, 'v1']
        : []
    const pathname = normalizedSegments.length ? `/${normalizedSegments.join('/')}` : ''
    return `${url.origin}${pathname}`
  } catch {
    return trimmed.replace(/\/+$/, '')
  }
}

function getApiProxyTarget(baseUrl: string, proxyConfig?: DevProxyConfig | null): string {
  if (proxyConfig?.target) return proxyConfig.target

  const runtimeTarget = readRuntimeEnv(import.meta.env.VITE_API_PROXY_TARGET)
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(runtimeTarget)) {
    return normalizeBaseUrl(runtimeTarget)
  }

  return normalizeBaseUrl(baseUrl)
}

function pathStartsWithApiVersion(path: string): boolean {
  const firstSegment = path.split('/').find(Boolean) ?? ''
  return API_VERSION_SEGMENT_RE.test(firstSegment)
}

function targetEndsWithApiVersion(target: string): boolean {
  if (!target) return false
  try {
    const url = new URL(/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(target) ? target : `https://${target}`)
    const segments = url.pathname.split('/').filter(Boolean)
    const lastSegment = segments[segments.length - 1] ?? ''
    return API_VERSION_SEGMENT_RE.test(lastSegment)
  } catch {
    const segments = target.split(/[?#]/, 1)[0].split('/').filter(Boolean)
    const lastSegment = segments[segments.length - 1] ?? ''
    return API_VERSION_SEGMENT_RE.test(lastSegment)
  }
}

function stripTrailingApiVersion(baseUrl: string): string {
  if (!baseUrl) return ''
  try {
    const url = new URL(baseUrl)
    const segments = url.pathname.split('/').filter(Boolean)
    if (segments.length && API_VERSION_SEGMENT_RE.test(segments[segments.length - 1])) {
      segments.pop()
      url.pathname = segments.length ? `/${segments.join('/')}` : ''
    }
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/+$/, '')
  } catch {
    const [withoutHash] = baseUrl.split('#', 1)
    const [withoutQuery] = withoutHash.split('?', 1)
    const segments = withoutQuery.split('/').filter(Boolean)
    if (segments.length && API_VERSION_SEGMENT_RE.test(segments[segments.length - 1])) segments.pop()
    return segments.join('/').replace(/\/+$/, '')
  }
}

function buildProxyEndpointPath(baseUrl: string, path: string, proxyConfig?: DevProxyConfig | null): string {
  const endpointPath = path.replace(/^\/+/, '')
  if (!endpointPath || pathStartsWithApiVersion(endpointPath)) return endpointPath

  const target = getApiProxyTarget(baseUrl, proxyConfig)
  return target && !targetEndsWithApiVersion(target)
    ? `v1/${endpointPath}`
    : endpointPath
}

export function normalizeDevProxyConfig(input: unknown): DevProxyConfig | null {
  if (!input || typeof input !== 'object') return null

  const record = input as Record<string, unknown>
  const target = normalizeBaseUrl(typeof record.target === 'string' ? record.target : '')
  if (!target) return null

  const rawPrefix = typeof record.prefix === 'string' ? record.prefix : DEFAULT_PROXY_PREFIX
  const trimmedPrefix = rawPrefix.trim().replace(/^\/+/, '').replace(/\/+$/, '')
  const prefix = trimmedPrefix ? `/${trimmedPrefix}` : DEFAULT_PROXY_PREFIX

  return {
    enabled: Boolean(record.enabled),
    prefix,
    target,
    accountTarget: normalizeBaseUrl(typeof record.accountTarget === 'string' ? record.accountTarget : '') || undefined,
    changeOrigin: record.changeOrigin !== false,
    secure: Boolean(record.secure),
  }
}

export function buildApiUrl(
  baseUrl: string,
  path: string,
  proxyConfig?: DevProxyConfig | null,
  useApiProxy = false,
): string {
  const trimmedBaseUrl = baseUrl.trim()
  const endpointPath = path.replace(/^\/+/, '')

  if (useApiProxy) {
    return `${proxyConfig?.prefix ?? DEFAULT_PROXY_PREFIX}/${buildProxyEndpointPath(baseUrl, endpointPath, proxyConfig)}`
  }

  const normalizedBaseUrl = normalizeBaseUrl(trimmedBaseUrl)

  if (pathStartsWithApiVersion(endpointPath)) {
    const versionlessBaseUrl = stripTrailingApiVersion(normalizedBaseUrl)
    return versionlessBaseUrl ? `${versionlessBaseUrl}/${endpointPath}` : `/${endpointPath}`
  }

  if (trimmedBaseUrl.endsWith('/')) {
    return `${normalizedBaseUrl.replace(/\/+$/, '')}/${endpointPath}`
  }

  const apiPath = normalizedBaseUrl.endsWith('/v1')
    ? endpointPath
    : ['v1', endpointPath].join('/')

  return normalizedBaseUrl ? `${normalizedBaseUrl}/${apiPath}` : `/${apiPath}`
}

export function resolveDevProxyConfig(input: unknown, isDev: boolean): DevProxyConfig | null {
  if (!isDev) return null
  return normalizeDevProxyConfig(input)
}

export function readClientDevProxyConfig(): DevProxyConfig | null {
  return resolveDevProxyConfig(
    typeof __DEV_PROXY_CONFIG__ === 'undefined' ? null : __DEV_PROXY_CONFIG__,
    import.meta.env.DEV,
  )
}

export function isApiProxyAvailable(proxyConfig: DevProxyConfig | null = readClientDevProxyConfig()): boolean {
  return readRuntimeEnv(import.meta.env.VITE_API_PROXY_AVAILABLE) === 'true' || Boolean(proxyConfig?.enabled)
}

export function isApiProxyLocked(proxyConfig: DevProxyConfig | null = readClientDevProxyConfig()): boolean {
  return readRuntimeEnv(import.meta.env.VITE_API_PROXY_LOCKED) === 'true' && isApiProxyAvailable(proxyConfig)
}

export function shouldUseApiProxy(apiProxy: boolean, proxyConfig: DevProxyConfig | null = readClientDevProxyConfig()): boolean {
  return isApiProxyAvailable(proxyConfig) && (apiProxy || isApiProxyLocked(proxyConfig))
}
