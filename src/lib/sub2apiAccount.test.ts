import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getDefaultSub2ApiAccountBaseUrl,
  listSub2ApiKeys,
  loginSub2ApiAccount,
  normalizeSub2ApiAccountBaseUrl,
} from './sub2apiAccount'

describe('sub2api account client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('uses the same-origin API proxy for account APIs when proxy is available', () => {
    vi.stubEnv('VITE_API_PROXY_AVAILABLE', 'true')

    expect(getDefaultSub2ApiAccountBaseUrl()).toBe('/api-proxy/api/v1')
    expect(normalizeSub2ApiAccountBaseUrl('/api-proxy')).toBe('/api-proxy/api/v1')
  })

  it('uses a dedicated account API base URL when configured', () => {
    vi.stubEnv('VITE_API_PROXY_AVAILABLE', 'true')
    vi.stubEnv('VITE_SUB2API_ACCOUNT_BASE_URL', 'https://sub2.luoyv.net/api/v1')

    expect(getDefaultSub2ApiAccountBaseUrl()).toBe('https://sub2.luoyv.net/api/v1')
  })

  it('logs in through the sub2api auth endpoint and unwraps tokens', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      code: 0,
      data: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        user: {
          id: 7,
          username: 'luoyv',
          email: 'user@example.com',
          balance: 12.3456,
        },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    const result = await loginSub2ApiAccount({
      baseUrl: '/api-proxy/api/v1',
      email: 'user@example.com',
      password: 'password',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api-proxy/api/v1/auth/login')
    expect(result).toMatchObject({
      requires2fa: false,
      tokens: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      },
      user: {
        username: 'luoyv',
        balance: 12.3456,
      },
    })
  })

  it('keeps API key names when listing account keys', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      code: 0,
      data: {
        items: [
          {
            id: 3,
            key: 'sk-test-abcdef',
            name: 'production key',
            status: 'active',
            group: { name: 'OpenAI', platform: 'openai' },
          },
        ],
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    const keys = await listSub2ApiKeys({
      baseUrl: '/api-proxy/api/v1',
      accessToken: 'access-token',
    })

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^\/api-proxy\/api\/v1\/keys\?page=1&page_size=100&_t=\d+$/)
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer access-token',
    })
    expect(keys).toEqual([
      {
        id: 3,
        key: 'sk-test-abcdef',
        name: 'production key',
        status: 'active',
        group: { id: undefined, name: 'OpenAI', platform: 'openai' },
        group_id: undefined,
        quota: undefined,
        quota_used: undefined,
        expires_at: undefined,
      },
    ])
  })
})
