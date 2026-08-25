import type { ApiProfile, AppSettings } from '../types'
import { useStore } from '../store'
import {
  DEFAULT_SETTINGS,
  getActiveApiProfile,
  normalizeSettings,
} from './apiProfiles'
import {
  fetchSub2ApiAccountSnapshot,
  getDefaultSub2ApiAccountBaseUrl,
  normalizeSub2ApiAccountBaseUrl,
  type Sub2ApiApiKey,
} from './sub2apiAccount'
import { isApiProxyAvailable, readClientDevProxyConfig } from './devProxy'
import { isSub2ApiEmbeddedMode } from './embeddedMode'

const EMBEDDED_SYNC_QUERY_KEYS = ['token', 'user_id', 'src_host', 'src_url'] as const

let lastSuccessfulSyncSignature = ''
let activeSync: Promise<void> | null = null

function getEmbeddedHashParams() {
  if (typeof window === 'undefined') return new URLSearchParams()
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  return new URLSearchParams(hash)
}

function getEmbeddedToken(searchParams: URLSearchParams) {
  const hashParams = getEmbeddedHashParams()
  const token = searchParams.get('token')?.trim() || hashParams.get('token')?.trim()
  if (token) return token
  return useStore.getState().sub2ApiAccount.tokens?.accessToken?.trim() || ''
}

function removeSensitiveEmbeddedParams(searchParams: URLSearchParams) {
  let changed = false
  for (const key of EMBEDDED_SYNC_QUERY_KEYS) {
    if (!searchParams.has(key)) continue
    searchParams.delete(key)
    changed = true
  }

  const hashParams = getEmbeddedHashParams()
  let hashChanged = false
  for (const key of EMBEDDED_SYNC_QUERY_KEYS) {
    if (!hashParams.has(key)) continue
    hashParams.delete(key)
    hashChanged = true
  }
  if (!changed && !hashChanged) return

  const nextSearch = searchParams.toString()
  const nextHash = hashParams.toString()
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${nextHash ? `#${nextHash}` : ''}`
  window.history.replaceState(null, '', nextUrl)
}

function sub2ApiKeyMatchesProvider(key: Sub2ApiApiKey, provider: ApiProfile['provider']) {
  const platform = key.group?.platform?.toLowerCase()
  if (platform) {
    if (provider === 'openai') return /(openai|gpt|chatgpt)/i.test(platform)
    if (provider === 'grok') return /(grok|xai|x-ai)/i.test(platform)
    if (provider === 'gemini') return /(gemini|google)/i.test(platform)
    if (provider === 'claude') return /(claude|anthropic)/i.test(platform)
    return false
  }

  const text = `${key.name || ''} ${key.group?.name || ''}`.toLowerCase()
  const hasProviderMarker = /(openai|gpt|chatgpt|grok|xai|x-ai|gemini|google|claude|anthropic)/i.test(text)
  if (!hasProviderMarker) return true
  if (provider === 'openai') return /(openai|gpt|chatgpt)/i.test(text)
  if (provider === 'grok') return /(grok|xai|x-ai)/i.test(text)
  if (provider === 'gemini') return /(gemini|google)/i.test(text)
  if (provider === 'claude') return /(claude|anthropic)/i.test(text)
  return true
}

function pickSub2ApiKeyForProvider(keys: Sub2ApiApiKey[], provider: ApiProfile['provider']) {
  if (provider === 'fal') return null
  return keys.find((key) => sub2ApiKeyMatchesProvider(key, provider)) ?? keys[0] ?? null
}

function applySub2ApiKeysToSettings(settingsInput: AppSettings, keys: Sub2ApiApiKey[]) {
  const settings = normalizeSettings(settingsInput)
  const activeProfile = getActiveApiProfile(settings)
  const proxyAvailable = isApiProxyAvailable(readClientDevProxyConfig())
  let selectedKeyId: number | null = null
  let changed = false

  const profiles = settings.profiles.map((profile) => {
    const selectedKey = pickSub2ApiKeyForProvider(keys, profile.provider)
    if (!selectedKey) return profile
    if (profile.id === activeProfile.id) selectedKeyId = selectedKey.id

    const nextProfile = {
      ...profile,
      apiKey: selectedKey.key,
      apiProxy: proxyAvailable ? true : profile.apiProxy,
      baseUrl: proxyAvailable ? DEFAULT_SETTINGS.baseUrl : profile.baseUrl,
    }

    if (
      nextProfile.apiKey !== profile.apiKey ||
      nextProfile.apiProxy !== profile.apiProxy ||
      nextProfile.baseUrl !== profile.baseUrl
    ) {
      changed = true
    }
    return nextProfile
  })

  if (selectedKeyId == null) {
    selectedKeyId = pickSub2ApiKeyForProvider(keys, activeProfile.provider)?.id ?? keys[0]?.id ?? null
  }

  return {
    settings: changed ? normalizeSettings({ ...settings, profiles }) : settings,
    selectedKeyId,
    changed,
  }
}

export async function syncEmbeddedSub2ApiAccountFromUrl() {
  if (typeof window === 'undefined') return

  const searchParams = new URLSearchParams(window.location.search)
  if (!isSub2ApiEmbeddedMode(searchParams)) return

  const accessToken = getEmbeddedToken(searchParams)
  if (!accessToken) return

  const baseUrl = normalizeSub2ApiAccountBaseUrl(getDefaultSub2ApiAccountBaseUrl())
  const syncSignature = `${baseUrl}\n${accessToken}`
  if (syncSignature === lastSuccessfulSyncSignature) {
    removeSensitiveEmbeddedParams(searchParams)
    return
  }

  if (activeSync) return activeSync

  activeSync = (async () => {
    removeSensitiveEmbeddedParams(searchParams)

    try {
      const snapshot = await fetchSub2ApiAccountSnapshot({ baseUrl, accessToken })
      const { settings, selectedKeyId, changed } = applySub2ApiKeysToSettings(
        useStore.getState().settings,
        snapshot.keys,
      )

      if (changed) {
        useStore.getState().setSettings(settings)
      }

      useStore.getState().setSub2ApiAccount({
        baseUrl,
        tokens: { accessToken },
        user: snapshot.user,
        keys: snapshot.keys,
        selectedKeyId,
        updatedAt: Date.now(),
      })

      lastSuccessfulSyncSignature = syncSignature
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      useStore.getState().showToast(`中转站账号同步失败：${message}`, 'error')
      throw error
    } finally {
      activeSync = null
    }
  })()

  return activeSync
}
