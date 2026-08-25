import { getActiveApiProfile, getCustomProviderDefinition } from './apiProfiles'
import { callFalAiImageApi } from './falAiImageApi'
import { callOpenAICompatibleImageApi } from './openaiCompatibleImageApi'
import { callGeminiImageApi } from './geminiImageApi'
import type { CallApiOptions, CallApiResult } from './imageApiShared'
import { withImageRequestQueue } from './imageRequestQueue'

export type { CallApiOptions, CallApiResult } from './imageApiShared'
export { normalizeBaseUrl } from './devProxy'

export async function callImageApi(opts: CallApiOptions): Promise<CallApiResult> {
  return withImageRequestQueue(async () => {
    const profile = getActiveApiProfile(opts.settings)
    if (profile.provider === 'fal') return callFalAiImageApi(opts, profile)
    if (profile.provider === 'gemini') return callGeminiImageApi(opts, profile)
    if (profile.provider === 'claude') throw new Error('Claude 仅支持对话，不支持图片生成。')

    return callOpenAICompatibleImageApi(opts, profile, getCustomProviderDefinition(opts.settings, profile.provider))
  })
}
