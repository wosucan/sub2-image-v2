import { isApiProxyAvailable, readClientDevProxyConfig } from './devProxy'
import { getApiErrorMessage } from './imageApiShared'
import { readRuntimeEnv } from './runtimeEnv'

const DEFAULT_ACCOUNT_API_BASE = '/api/v1'
const DEFAULT_PROXY_PREFIX = '/api-proxy'

export interface Sub2ApiUser {
  id: number
  username: string
  email: string
  role?: string
  status?: string
  balance?: number
  concurrency?: number
  allowed_groups?: string[]
}

export interface Sub2ApiAuthTokens {
  accessToken: string
  refreshToken?: string
  tokenType?: string
  expiresIn?: number
  expiresAt?: number
}

export interface Sub2ApiApiKey {
  id: number
  key: string
  name: string
  group_id?: number
  status?: string
  quota?: number
  quota_used?: number
  expires_at?: string | null
  group?: {
    id?: number
    name?: string
    platform?: string
  } | null
}

export interface Sub2ApiAccountSnapshot {
  user: Sub2ApiUser | null
  keys: Sub2ApiApiKey[]
}

export type Sub2ApiLoginResult =
  | {
      requires2fa: false
      tokens: Sub2ApiAuthTokens
      user: Sub2ApiUser | null
    }
  | {
      requires2fa: true
      tempToken: string
      userEmailMasked?: string
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function getDefaultSub2ApiAccountBaseUrl(): string {
  const runtimeBaseUrl = readRuntimeEnv(import.meta.env.VITE_SUB2API_ACCOUNT_BASE_URL)
  if (runtimeBaseUrl) return normalizeSub2ApiAccountBaseUrl(runtimeBaseUrl)

  const proxyConfig = readClientDevProxyConfig()
  if (isApiProxyAvailable(proxyConfig)) {
    return `${proxyConfig?.prefix ?? DEFAULT_PROXY_PREFIX}${DEFAULT_ACCOUNT_API_BASE}`
  }
  return DEFAULT_ACCOUNT_API_BASE
}

export function normalizeSub2ApiAccountBaseUrl(baseUrl?: string | null): string {
  const value = (baseUrl ?? '').trim()
  const normalized: string = value || getDefaultSub2ApiAccountBaseUrl()
  const withoutTrailingSlash: string = normalized.replace(/\/+$/, '')
  if (/\/api\/v\d+$/i.test(withoutTrailingSlash)) return withoutTrailingSlash
  if (/\/api$/i.test(withoutTrailingSlash)) return `${withoutTrailingSlash}/v1`
  if (/^\/api-proxy$/i.test(withoutTrailingSlash)) return `${withoutTrailingSlash}/api/v1`
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:\/\/[^/]+$/i.test(withoutTrailingSlash)) return `${withoutTrailingSlash}/api/v1`
  return withoutTrailingSlash
}

function buildAccountUrl(baseUrl: string, path: string) {
  return `${normalizeSub2ApiAccountBaseUrl(baseUrl)}/${path.replace(/^\/+/, '')}`
}

function unwrapSub2ApiResponse(payload: unknown): unknown {
  if (!isRecord(payload) || !('code' in payload)) return payload
  if (payload.code === 0 || payload.code === '0') return payload.data
  const message = typeof payload.message === 'string' && payload.message.trim()
    ? payload.message.trim()
    : 'sub2api 请求失败'
  throw new Error(message)
}

function normalizeNumber(value: unknown): number | undefined {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(numeric) ? numeric : undefined
}

function normalizeUser(value: unknown): Sub2ApiUser | null {
  if (!isRecord(value)) return null
  const id = normalizeNumber(value.id)
  const username = typeof value.username === 'string' ? value.username : ''
  const email = typeof value.email === 'string' ? value.email : ''
  if (id == null || (!username && !email)) return null
  return {
    id,
    username,
    email,
    role: typeof value.role === 'string' ? value.role : undefined,
    status: typeof value.status === 'string' ? value.status : undefined,
    balance: normalizeNumber(value.balance),
    concurrency: normalizeNumber(value.concurrency),
    allowed_groups: Array.isArray(value.allowed_groups)
      ? value.allowed_groups.filter((item): item is string => typeof item === 'string')
      : undefined,
  }
}

function normalizeKey(value: unknown): Sub2ApiApiKey | null {
  if (!isRecord(value)) return null
  const id = normalizeNumber(value.id)
  const key = typeof value.key === 'string' ? value.key : ''
  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : key ? `Key ${key.slice(-6)}` : ''
  if (id == null || !key) return null
  const group = isRecord(value.group)
    ? {
        id: normalizeNumber(value.group.id),
        name: typeof value.group.name === 'string' ? value.group.name : undefined,
        platform: typeof value.group.platform === 'string' ? value.group.platform : undefined,
      }
    : null

  return {
    id,
    key,
    name,
    group_id: normalizeNumber(value.group_id),
    status: typeof value.status === 'string' ? value.status : undefined,
    quota: normalizeNumber(value.quota),
    quota_used: normalizeNumber(value.quota_used),
    expires_at: typeof value.expires_at === 'string' || value.expires_at === null ? value.expires_at : undefined,
    group,
  }
}

function normalizeKeyList(value: unknown): Sub2ApiApiKey[] {
  const list = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.items)
      ? value.items
      : isRecord(value) && Array.isArray(value.data)
        ? value.data
        : []
  return list.map(normalizeKey).filter((item): item is Sub2ApiApiKey => Boolean(item))
}

function normalizeTokens(value: unknown): Sub2ApiAuthTokens | null {
  if (!isRecord(value)) return null
  const accessToken = typeof value.access_token === 'string' ? value.access_token : ''
  if (!accessToken) return null
  const expiresIn = normalizeNumber(value.expires_in)
  return {
    accessToken,
    refreshToken: typeof value.refresh_token === 'string' ? value.refresh_token : undefined,
    tokenType: typeof value.token_type === 'string' ? value.token_type : undefined,
    expiresIn,
    expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
  }
}

async function readJsonResponse(response: Response) {
  if (!response.ok) throw new Error(await getApiErrorMessage(response))
  return unwrapSub2ApiResponse(await response.json())
}

async function fetchSub2Api(baseUrl: string, path: string, init: RequestInit = {}) {
  const response = await fetch(buildAccountUrl(baseUrl, path), {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...init.headers,
    },
  })
  return readJsonResponse(response)
}

export async function loginSub2ApiAccount(args: {
  baseUrl: string
  email: string
  password: string
  turnstileToken?: string
}): Promise<Sub2ApiLoginResult> {
  const payload = await fetchSub2Api(args.baseUrl, 'auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: args.email,
      password: args.password,
      ...(args.turnstileToken ? { turnstile_token: args.turnstileToken } : {}),
    }),
  })

  if (isRecord(payload) && payload.requires_2fa === true && typeof payload.temp_token === 'string') {
    return {
      requires2fa: true,
      tempToken: payload.temp_token,
      userEmailMasked: typeof payload.user_email_masked === 'string' ? payload.user_email_masked : undefined,
    }
  }

  const tokens = normalizeTokens(payload)
  if (!tokens) throw new Error('登录响应中没有 access_token')
  return {
    requires2fa: false,
    tokens,
    user: isRecord(payload) ? normalizeUser(payload.user) : null,
  }
}

export async function loginSub2ApiAccount2FA(args: {
  baseUrl: string
  tempToken: string
  totpCode: string
}): Promise<{ tokens: Sub2ApiAuthTokens; user: Sub2ApiUser | null }> {
  const payload = await fetchSub2Api(args.baseUrl, 'auth/login/2fa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      temp_token: args.tempToken,
      totp_code: args.totpCode,
    }),
  })
  const tokens = normalizeTokens(payload)
  if (!tokens) throw new Error('登录响应中没有 access_token')
  return {
    tokens,
    user: isRecord(payload) ? normalizeUser(payload.user) : null,
  }
}

export async function getSub2ApiCurrentUser(args: {
  baseUrl: string
  accessToken: string
}): Promise<Sub2ApiUser | null> {
  const payload = await fetchSub2Api(args.baseUrl, 'auth/me', {
    headers: { Authorization: `Bearer ${args.accessToken}` },
  })
  return normalizeUser(payload)
}

export async function listSub2ApiKeys(args: {
  baseUrl: string
  accessToken: string
  pageSize?: number
}): Promise<Sub2ApiApiKey[]> {
  const pageSize = Math.max(1, Math.min(500, Math.trunc(args.pageSize ?? 100)))
  const payload = await fetchSub2Api(args.baseUrl, `keys?page=1&page_size=${pageSize}&_t=${Date.now()}`, {
    headers: { Authorization: `Bearer ${args.accessToken}` },
  })
  return normalizeKeyList(payload)
}

export async function fetchSub2ApiAccountSnapshot(args: {
  baseUrl: string
  accessToken: string
}): Promise<Sub2ApiAccountSnapshot> {
  const [user, keys] = await Promise.all([
    getSub2ApiCurrentUser(args),
    listSub2ApiKeys(args),
  ])
  return { user, keys }
}
