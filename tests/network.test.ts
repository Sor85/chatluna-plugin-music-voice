import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { Context } from 'cordis'
import { afterEach, describe, expect, it } from 'vitest'
import { Config } from '../src/config'
import { MusicClient } from '../src/network'
import { songs } from './host'

const cleanup: (() => Promise<void>)[] = []
afterEach(async () => { await Promise.all(cleanup.splice(0).map((close) => close())) })

async function fixture(
  handler: (url: URL, request: IncomingMessage, response: ServerResponse, origin: string) => void,
  overrides: Partial<Config> = {}
) {
  let origin = ''
  const requests: { url: URL; init?: RequestInit }[] = []
  const lifetime = new AbortController()
  const started = Promise.withResolvers<void>()
  const server = createServer((request, response) => {
    started.resolve()
    handler(new URL(String(request.headers['x-test-target'])), request, response, origin)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing fixture port')
  origin = `http://127.0.0.1:${address.port}`
  const request: typeof fetch = (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    requests.push({ url, init })
    return fetch(origin, { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), 'x-test-target': url.href } })
  }
  const ctx = new Context()
  const config = Config.parse({ sourceMode: 'custom', customMetingApi: `${origin}/meting`, ...overrides })
  const client = new MusicClient(config, request, lifetime.signal, ctx.logger)
  cleanup.push(async () => {
    lifetime.abort()
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await ctx.fiber.dispose()
  })
  return { client, requests, lifetime, origin, started: started.promise }
}

function netease(name = '网络歌曲') {
  return JSON.stringify({ result: { songs: [{ id: 1, name, artists: [{ name: '歌手' }], album: { name: '专辑' } }] } })
}

const signal = () => new AbortController().signal

describe('真实 HTTP 请求与取消', () => {
  it('搜索并发直连和代理，编码关键词并携带 limit', async () => {
    const app = await fixture((_url, _req, res) => res.end(netease()))
    expect(await app.client.search('歌 & 曲', signal())).toHaveLength(1)
    expect(app.requests).toHaveLength(2)
    expect(app.requests[0].url.searchParams.get('s')).toBe('歌 & 曲')
    expect(app.requests[0].url.searchParams.get('limit')).toBe('5')
    expect(app.requests[1].init?.method).toBe('POST')
    expect(new Headers(app.requests[1].init?.headers).get('api-u')).toBe(app.requests[0].url.href)
    expect(app.requests.every((request) => request.init?.signal?.aborted)).toBe(true)
  })
  it('直连空结果不会抢先取消有效代理结果', async () => {
    const app = await fixture((url, _req, res) => res.end(url.hostname === 'music.163.com' ? '{"result":{"songs":[]}}' : netease()))
    expect(await app.client.search('x', signal())).toHaveLength(1)
  })
  it('所有有效结果为空时返回空列表', async () => {
    const app = await fixture((_url, _req, res) => res.end('{"result":{"songs":[]}}'))
    expect(await app.client.search('x', signal())).toEqual([])
  })
  it('QQ 失败不丢弃网易云结果', async () => {
    const app = await fixture((url, req, res) => {
      const target = url.hostname === 'web-proxy.apifox.cn' ? String(req.headers['api-u']) : url.href
      if (target.includes('qq.com')) { res.writeHead(503); res.end('unavailable') }
      else res.end(netease())
    }, { enableQQMusicSearch: true })
    expect(await app.client.search('x', signal())).toHaveLength(1)
    const qq = app.requests.find((request) => request.url.hostname === 'c.y.qq.com')
    expect(new Headers(qq?.init?.headers).get('referer')).toBe('https://y.qq.com/')
  })
  it('所有平台关闭时不请求网络', async () => {
    const app = await fixture((_url, _req, res) => res.end(), { enableNetEaseSearch: false })
    expect(await app.client.search('x', signal())).toEqual([])
    expect(app.requests).toHaveLength(0)
  })
  it('全部搜索失败不伪装成无结果', async () => {
    const app = await fixture((_url, _req, res) => { res.writeHead(502); res.end('failure') })
    await expect(app.client.search('x', signal())).rejects.toThrow('All music searches failed')
  })
  it('Meting 请求使用 QQ mid 与 tencent 平台', async () => {
    const app = await fixture((_url, _req, res) => res.end('{"url":"https://audio.example/music.mp3"}'))
    expect(await app.client.resolve(songs[2], signal())).toBe('https://audio.example/music.mp3')
    expect(app.requests[0].url.searchParams.get('id')).toBe('MID')
    expect(app.requests[0].url.searchParams.get('server')).toBe('tencent')
  })
  it('Meting 媒体响应不等待整曲正文，只返回最终地址', async () => {
    const app = await fixture((_url, _req, res) => { res.writeHead(200, { 'Content-Type': 'audio/mpeg' }); res.flushHeaders() })
    expect(await app.client.resolve(songs[0], signal())).toBe(`${app.origin}/`)
    expect(app.requests).toHaveLength(1)
  })
  it.each([true, false])('直链响应超过 1 MiB 时拒绝（声明长度：%s）', async (declared) => {
    const app = await fixture((_url, _req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        ...(declared ? { 'Content-Length': 1024 * 1024 + 1 } : {})
      })
      if (declared) res.flushHeaders()
      else res.end('x'.repeat(1024 * 1024 + 1))
    })
    await expect(app.client.resolve(songs[0], signal())).rejects.toMatchObject({
      errors: [expect.objectContaining({ message: 'Response exceeds size limit' })]
    })
  })
  it('取消与插件卸载终止挂起的请求', async () => {
    const app = await fixture(() => {})
    const controller = new AbortController()
    const pending = app.client.search('x', controller.signal)
    await app.started
    controller.abort(new Error('stop'))
    await expect(pending).rejects.toThrow('stop')
    const lifetime = await fixture(() => {})
    const search = lifetime.client.search('x', signal())
    await lifetime.started
    lifetime.lifetime.abort(new Error('unload'))
    await expect(search).rejects.toThrow('unload')
  })
  it('单次搜索遵守 5 秒超时', async () => {
    const app = await fixture(() => {})
    const started = Date.now()
    await expect(app.client.search('x', signal())).rejects.toThrow('All music searches failed')
    expect(Date.now() - started).toBeLessThan(8000)
  })
})
