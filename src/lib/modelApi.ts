import type { ApiProfile } from '../types'
import { buildApiUrl, readClientDevProxyConfig, shouldUseApiProxy } from './devProxy'
import { getApiErrorMessage } from './imageApiShared'
import { createGeminiRequestHeaders } from './geminiImageApi'

export interface ProviderModel {
  id: string
  name: string
}

function getModelId(item: unknown): string | null {
  const normalize = (value: string) => value.trim().replace(/^models\//, '')
  if (typeof item === 'string') return normalize(item)
  if (!item || typeof item !== 'object') return null
  const record = item as Record<string, unknown>
  const id = record.id ?? record.name ?? record.model
  return typeof id === 'string' && id.trim() ? normalize(id) : null
}

function providerMatchesModel(provider: ApiProfile['provider'], model: string) {
  const value = model.toLowerCase()
  if (provider === 'claude') return value.includes('claude') || value.includes('anthropic')
  if (provider === 'gemini') return value.includes('gemini')
  if (provider === 'grok') return value.includes('grok') || value.includes('xai') || value.includes('x-ai')
  return true
}

function kindMatchesModel(model: string, kind: 'image' | 'chat') {
  const value = model.toLowerCase()
  const looksImage = value.includes('image') || value.includes('imagen') || value.includes('dall') || value.includes('flux') || value.includes('midjourney')
  return kind === 'image' ? looksImage : !looksImage
}


function getModelList(payload: unknown): unknown[] {
  const recordPayload = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  return Array.isArray(payload)
    ? payload
    : Array.isArray(recordPayload.data)
    ? recordPayload.data
    : Array.isArray(recordPayload.models)
    ? recordPayload.models
    : []
}

function createModelRequestCandidates(profile: ApiProfile, useApiProxy: boolean) {
  const apiKey = profile.apiKey.trim()
  const bearerHeaders: Record<string, string> = apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
  const claudeHeaders: Record<string, string> = apiKey ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } : { 'anthropic-version': '2023-06-01' }
  const geminiHeaders: Record<string, string> = apiKey ? { 'x-goog-api-key': apiKey } : {}
  const geminiNativeHeaders = createGeminiRequestHeaders(profile, useApiProxy)

  if (profile.provider === 'claude') {
    return [
      { path: 'models', headers: claudeHeaders },
      { path: 'models', headers: bearerHeaders },
    ]
  }

  if (profile.provider === 'gemini') {
    return [
      { path: 'models', headers: bearerHeaders },
      { path: 'models', headers: geminiHeaders },
      { path: apiKey ? `v1beta/models?key=${encodeURIComponent(apiKey)}` : 'v1beta/models', headers: geminiNativeHeaders },
      { path: 'v1beta/models', headers: geminiNativeHeaders },
    ]
  }

  return [{ path: 'models', headers: bearerHeaders }]
}

function appendModelRequestCacheBust(path: string) {
  return `${path}${path.includes('?') ? '&' : '?'}_t=${Date.now()}`
}

export async function fetchProviderModels(profile: ApiProfile, kind: 'image' | 'chat', signal?: AbortSignal): Promise<ProviderModel[]> {
  const proxyConfig = readClientDevProxyConfig()
  const useApiProxy = shouldUseApiProxy(profile.apiProxy, proxyConfig)
  let payload: unknown = null
  let lastError: Error | null = null

  for (const candidate of createModelRequestCandidates(profile, useApiProxy)) {
    const response = await fetch(buildApiUrl(profile.baseUrl, appendModelRequestCacheBust(candidate.path), proxyConfig, useApiProxy), {
      method: 'GET',
      headers: candidate.headers,
      cache: 'no-store',
      signal,
    })
    if (!response.ok) {
      lastError = new Error(await getApiErrorMessage(response))
      continue
    }
    payload = await response.json()
    if (getModelList(payload).length > 0) break
  }
  if (!payload) throw lastError ?? new Error('未拉取到模型列表')

  const rawModels = getModelList(payload)
    .map(getModelId)
    .filter((id): id is string => Boolean(id))
  const providerModels = rawModels.filter((id: string) => providerMatchesModel(profile.provider, id))
  const providerSelectedModels = providerModels.length > 0 ? providerModels : rawModels
  const kindModels = providerSelectedModels.filter((id: string) => kindMatchesModel(id, kind))
  const selectedModels = kindModels.length > 0 ? kindModels : providerSelectedModels

  const seen = new Set<string>()
  return selectedModels
    .filter((id: string) => {
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
    .sort((a: string, b: string) => a.localeCompare(b))
    .map((id: string) => ({ id, name: id }))
}
