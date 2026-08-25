import { getProfileImageModel } from './apiProfiles'
import type { ApiProfile } from '../types'
import { buildApiUrl, readClientDevProxyConfig, shouldUseApiProxy } from './devProxy'
import { fetchImageUrlAsDataUrl, type CallApiOptions, type CallApiResult, getApiErrorMessage, isDataUrl, isHttpUrl, MIME_MAP, normalizeBase64Image } from './imageApiShared'

function getAllByPath(source: unknown, path: string): unknown[] {
  const parts = path.split('.').filter(Boolean)
  let current: unknown[] = [source]
  for (const key of parts) {
    const next: unknown[] = []
    for (const item of current) {
      if (item == null) continue
      if (key === '*') {
        if (Array.isArray(item)) next.push(...item)
        else if (typeof item === 'object') next.push(...Object.values(item as Record<string, unknown>))
      } else if (typeof item === 'object') {
        next.push((item as Record<string, unknown>)[key])
      }
    }
    current = next
  }
  return current.filter((item) => item != null)
}

function splitDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.*)$/)
  return match ? { mimeType: match[1], data: match[2] } : null
}

export function createGeminiRequestHeaders(profile: ApiProfile, useApiProxy: boolean): Record<string, string> {
  const apiKey = profile.apiKey.trim()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (!apiKey) return headers

  headers['x-goog-api-key'] = apiKey
  if (useApiProxy) headers.Authorization = `Bearer ${apiKey}`
  return headers
}

function getGeminiImageBase64Values(payload: unknown): string[] {
  return [
    ...getAllByPath(payload, 'candidates.*.content.parts.*.inlineData.data'),
    ...getAllByPath(payload, 'candidates.*.content.parts.*.inline_data.data'),
    ...getAllByPath(payload, 'candidates.*.content.parts.*.inlineData.imageBytes'),
    ...getAllByPath(payload, 'candidates.*.content.parts.*.inline_data.image_bytes'),
    ...getAllByPath(payload, 'generatedImages.*.image.imageBytes'),
    ...getAllByPath(payload, 'generated_images.*.image.image_bytes'),
    ...getAllByPath(payload, 'generatedImages.*.image.bytesBase64Encoded'),
    ...getAllByPath(payload, 'generated_images.*.image.bytes_base64_encoded'),
    ...getAllByPath(payload, 'images.*.b64_json'),
    ...getAllByPath(payload, 'images.*.base64'),
    ...getAllByPath(payload, 'images.*.data'),
    ...getAllByPath(payload, 'data.*.b64_json'),
    ...getAllByPath(payload, 'data.*.base64'),
    ...getAllByPath(payload, 'data.*.image'),
    ...getAllByPath(payload, 'data.*.data'),
    ...getAllByPath(payload, 'output.*.result'),
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

function getGeminiImageUrlValues(payload: unknown): string[] {
  return [
    ...getAllByPath(payload, 'candidates.*.content.parts.*.fileData.fileUri'),
    ...getAllByPath(payload, 'candidates.*.content.parts.*.file_data.file_uri'),
    ...getAllByPath(payload, 'images.*.url'),
    ...getAllByPath(payload, 'images.*.image_url'),
    ...getAllByPath(payload, 'data.*.url'),
    ...getAllByPath(payload, 'data.*.image_url'),
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

async function parseGeminiImageApiResponse(payload: unknown, mime: string, signal?: AbortSignal): Promise<CallApiResult> {
  const images: string[] = []
  const rawImageUrls = getGeminiImageUrlValues(payload).filter(isHttpUrl)

  try {
    for (const value of getGeminiImageBase64Values(payload)) {
      if (isDataUrl(value)) {
        images.push(value)
        continue
      }
      if (isHttpUrl(value)) {
        images.push(await fetchImageUrlAsDataUrl(value, mime, signal))
        continue
      }
      images.push(normalizeBase64Image(value, mime))
    }

    for (const value of getGeminiImageUrlValues(payload)) {
      if (isHttpUrl(value) || isDataUrl(value)) {
        images.push(await fetchImageUrlAsDataUrl(value, mime, signal))
      }
    }
  } catch (err) {
    if (rawImageUrls.length > 0 && err instanceof Error) {
      ;(err as any).rawImageUrls = rawImageUrls
    }
    throw err
  }

  const uniqueImages = Array.from(new Set(images))
  if (!uniqueImages.length) {
    const err = new Error('Gemini did not return recognizable image data')
    ;(err as any).rawResponsePayload = JSON.stringify(payload, null, 2)
    throw err
  }

  return {
    images: uniqueImages,
    actualParams: {},
    actualParamsList: uniqueImages.map(() => ({})),
    revisedPrompts: [],
    ...(rawImageUrls.length ? { rawImageUrls } : {}),
  }
}

export async function callGeminiImageApi(opts: CallApiOptions, profile: ApiProfile): Promise<CallApiResult> {
  if (opts.maskDataUrl) {
    throw new Error('Gemini native image API does not support mask editing')
  }

  const proxyConfig = readClientDevProxyConfig()
  const useApiProxy = shouldUseApiProxy(profile.apiProxy, proxyConfig)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), profile.timeout * 1000)
  const mime = MIME_MAP[opts.params.output_format] || 'image/png'

  try {
    const parts: Array<Record<string, unknown>> = [{ text: opts.prompt }]
    for (const dataUrl of opts.inputImageDataUrls) {
      const image = splitDataUrl(dataUrl)
      if (image) {
        parts.push({
          inlineData: {
            mimeType: image.mimeType,
            data: image.data,
          },
        })
      }
    }

    const path = `v1beta/models/${encodeURIComponent(getProfileImageModel(profile))}:generateContent`
    const query = profile.apiKey ? `key=${encodeURIComponent(profile.apiKey)}` : ''
    const response = await fetch(buildApiUrl(profile.baseUrl, query ? `${path}?${query}` : path, proxyConfig, useApiProxy), {
      method: 'POST',
      headers: createGeminiRequestHeaders(profile, useApiProxy),
      cache: 'no-store',
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(await getApiErrorMessage(response))
    const payload = await response.json()
    return parseGeminiImageApiResponse(payload, mime, controller.signal)
  } finally {
    clearTimeout(timeoutId)
  }
}
