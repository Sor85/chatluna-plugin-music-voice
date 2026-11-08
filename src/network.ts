import type { Context } from 'cordis'
import type { Config } from './config'
import { PRESET_METING_APIS, SEARCH_TIMEOUT_MS, SOURCE_TIMEOUT_MS } from './constants'
import { buildMetingUrl, parseAudioUrl, parseNetEaseSearch, parseQQSearch } from './parsers'
import type { MusicPlatform, Song } from './types'

interface Candidate<T> {
  label: string
  run(signal: AbortSignal): Promise<T | undefined>
}

async function readBody(response: Response, limit: number) {
  if (Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel()
    throw new Error('Response exceeds size limit')
  }
  if (!response.body) throw new Error('Empty response body')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) throw new Error('Response exceeds size limit')
      chunks.push(value)
    }
    return Buffer.concat(chunks, size)
  } finally {
    await reader.cancel()
    reader.releaseLock()
  }
}

export class MusicClient {
  constructor(
    private config: Config,
    private request: typeof fetch,
    private lifetime: AbortSignal,
    private logger: Context['logger']
  ) {}

  private async response(url: string, init: RequestInit) {
    const response = await this.request(url, init)
    if (!response.ok) {
      await response.body?.cancel()
      throw new Error(`HTTP ${response.status}`)
    }
    return response
  }

  private async race<T>(candidates: Candidate<T>[], timeout: number, signal: AbortSignal): Promise<T> {
    const controller = new AbortController()
    const combined = AbortSignal.any([signal, this.lifetime, controller.signal, AbortSignal.timeout(timeout)])
    combined.throwIfAborted()
    try {
      return await Promise.any(candidates.map(async ({ label, run }) => {
        const result = await run(combined)
        combined.throwIfAborted()
        if (result === undefined) throw new Error(`Invalid response: ${label}`)
        if (this.config.debug) this.logger.debug('Request matched: %s', label)
        return result
      }))
    } finally {
      controller.abort()
    }
  }

  private async searchPlatform(platform: MusicPlatform, query: string, signal: AbortSignal) {
    const url = platform === 'netease'
      ? `http://music.163.com/api/search/get/web?csrf_token=hlpretag=&hlposttag=&s=${encodeURIComponent(query)}&type=1&offset=0&total=true&limit=${this.config.searchLimit}`
      : `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?format=json&p=1&n=${this.config.searchLimit}&w=${encodeURIComponent(query)}`
    const parse = platform === 'netease' ? parseNetEaseSearch : parseQQSearch
    let empty = false
    const parseResponse = async (response: Response) => {
      const songs = parse((await readBody(response, 2 * 1024 * 1024)).toString('utf8'))
      if (songs?.length === 0) empty = true
      return songs?.length ? songs : undefined
    }
    try {
      return await this.race<Song[]>([
        {
          label: `${platform}:direct`,
          run: async (signal) => parseResponse(await this.response(url, {
            signal,
            headers: platform === 'qq' ? { Referer: 'https://y.qq.com/', 'User-Agent': 'Mozilla/5.0' } : undefined
          }))
        },
        {
          label: `${platform}:proxy`,
          run: async (signal) => parseResponse(await this.response('https://web-proxy.apifox.cn/api/v1/request', {
            method: 'POST',
            signal,
            headers: {
              'api-u': url,
              'api-o0': `method=GET, timings=true, timeout=${SEARCH_TIMEOUT_MS}`,
              'Content-Type': 'application/json'
            },
            body: '{}'
          }))
        }
      ], SEARCH_TIMEOUT_MS, signal)
    } catch (error) {
      signal.throwIfAborted()
      this.lifetime.throwIfAborted()
      if (empty) return []
      throw error
    }
  }

  async search(query: string, signal: AbortSignal): Promise<Song[]> {
    const platforms: MusicPlatform[] = []
    if (this.config.enableNetEaseSearch) platforms.push('netease')
    if (this.config.enableQQMusicSearch) platforms.push('qq')
    if (!platforms.length) return []
    const results = await Promise.allSettled(platforms.map((platform) => this.searchPlatform(platform, query, signal)))
    signal.throwIfAborted()
    this.lifetime.throwIfAborted()
    const errors = results.flatMap((result, index) => {
      if (result.status === 'fulfilled') return []
      this.logger.warn('Music search failed: %s', platforms[index])
      return [result.reason]
    })
    if (errors.length === results.length) throw new AggregateError(errors, 'All music searches failed')
    return results.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
  }

  resolve(song: Song, signal: AbortSignal) {
    const apis = this.config.sourceMode === 'custom' ? [this.config.customMetingApi] : PRESET_METING_APIS
    return this.race<string>(apis.map((api) => ({
      label: new URL(api).host,
      run: async (signal) => {
        const target = buildMetingUrl(api, song.sourceId ?? song.id, song.platform)
        const response = await this.response(target, { signal })
        const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
        if (/^(audio\/|video\/|application\/octet-stream)/.test(contentType)) {
          await response.body?.cancel()
          return parseAudioUrl(response.url || target)
        }
        return parseAudioUrl((await readBody(response, 1024 * 1024)).toString('utf8'))
      }
    })), SOURCE_TIMEOUT_MS, signal)
  }
}
