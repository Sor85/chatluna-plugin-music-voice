import { afterEach, describe, expect, it } from 'vitest'
import { h } from '@satorijs/core'
import { host, songs } from './host'
import { MODEL_LINK_DELIVERY_HINT, TOOL_DESCRIPTION } from '../src/constants'

const running: Awaited<ReturnType<typeof host>>[] = []
async function setup(...args: Parameters<typeof host>) {
  const app = await host(...args)
  running.push(app)
  return app
}
afterEach(async () => { await Promise.all(running.splice(0).map((app) => app.close())) })

describe('搜索选歌与两种发送方式', () => {
  it('默认返回多平台分组、连续序号和原始链接，不发送', async () => {
    const app = await setup()
    const result = await app.play({ query: '  歌曲  ' })
    expect(result.text).toContain('网易云音乐搜索结果：\n1. 第一首')
    expect(result.text).toContain('QQ音乐搜索结果：\n3. QQ歌曲')
    expect(result).toEqual({ text: expect.stringContaining('链接：https://audio.example/3.mp3') })
    expect(app.client.search.mock.calls[0]?.[0]).toBe('歌曲')
    expect(app.sent).toHaveLength(0)
  })
  it('limit > 1 即使仅一首仍返回候选', async () => {
    const app = await setup()
    app.client.search.mockResolvedValue([songs[0]])
    expect((await app.play({ query: 'x' })).text).toContain('找到以下候选歌曲：')
    expect(app.sent).toHaveLength(0)
  })
  it('卡片二次调用重新搜索并以 1-based index 选歌，标记静默', async () => {
    const app = await setup({ sendMode: 'music-card' })
    await app.play({ query: 'x' })
    const result = await app.play({ query: 'x', index: 2 })
    expect(app.client.search).toHaveBeenCalledTimes(2)
    expect(app.client.resolve).not.toHaveBeenCalled()
    expect(result.endTurn).toBe(true)
    expect(h.normalize(app.sent[0])[0].attrs).toEqual({ type: '163', id: '2' })
  })
  it('limit=1 忽略 index，直接发送第一首卡片但返回成功文本', async () => {
    const app = await setup({ searchLimit: 1, sendMode: 'music-card' })
    const result = await app.play({ query: 'x', index: 50 })
    expect(result.text).toBe('已发送：第一首 - 歌手一')
    expect(result.endTurn).toBe(false)
    expect(h.normalize(app.sent[0])[0].attrs).toEqual({ type: '163', id: '1' })
    expect(app.client.resolve).not.toHaveBeenCalled()
  })
  it('默认 limit=1 忽略 index，只返回第一首原始链接和提示', async () => {
    const app = await setup({ searchLimit: 1 })
    const result = await app.execute({ query: 'x', index: 50 })
    expect(result).toMatchObject({ ok: true, value: `远程音频链接：https://audio.example/1.mp3\n\n${MODEL_LINK_DELIVERY_HINT}` })
    expect(result).not.toHaveProperty('ends')
    expect(app.client.resolve).toHaveBeenCalledWith(songs[0], expect.any(AbortSignal))
    expect(app.sent).toHaveLength(0)
  })
  it('卡片跳过直链解析，区分 QQ 和网易云', async () => {
    const app = await setup({ sendMode: 'music-card' })
    await app.play({ query: 'x', index: 1 })
    await app.play({ query: 'x', index: 3 })
    expect(h.normalize(app.sent[0])[0].attrs).toEqual({ type: '163', id: '1' })
    expect(h.normalize(app.sent[1])[0].attrs).toEqual({ type: 'qq', id: '3' })
    expect(app.client.resolve).not.toHaveBeenCalled()
  })
  it('QQ 卡片失败回退网页，网易云保持错误', async () => {
    const app = await setup({ sendMode: 'music-card' })
    app.send.mockRejectedValueOnce(new Error('unsupported'))
    expect((await app.play({ query: 'x', index: 3 })).endTurn).toBe(true)
    expect(String(app.sent[0])).toContain('songDetail/MID')
    app.send.mockRejectedValueOnce(new Error('unsupported'))
    expect((await app.play({ query: 'x', index: 1 })).text).toContain('音乐卡片发送失败')
  })
  it('空 messageIds 不误报成功，QQ 仍回退', async () => {
    const app = await setup({ sendMode: 'music-card' })
    app.send.mockResolvedValueOnce({ messageIds: [] })
    expect((await app.play({ query: 'x', index: 3 })).endTurn).toBe(true)
    expect(app.send).toHaveBeenCalledTimes(2)
  })
  it('模型链接候选与单曲返回原始音源地址，不发送', async () => {
    const app = await setup()
    expect((await app.play({ query: 'x' })).text).toContain('链接：https://audio.example/3.mp3')
    expect((await app.play({ query: 'x', index: 1 })).text).toBe(`远程音频链接：https://audio.example/1.mp3\n\n${MODEL_LINK_DELIVERY_HINT}`)
    expect(app.sent).toHaveLength(0)
  })
  it('模型链接部分失败保留全部候选', async () => {
    const app = await setup()
    app.client.resolve.mockRejectedValueOnce(new Error('missing'))
    const result = await app.play({ query: 'x' })
    expect(result.text).toContain('链接：获取失败')
    expect(result.text).toContain('链接：https://audio.example/2.mp3')
  })
  it('返回原始链接及签名参数，不结束模型循环', async () => {
    const app = await setup()
    const source = 'https://audio.example/1.mp3?sign=a%2Fb%3D&name=a%20b#part'
    app.client.resolve.mockResolvedValue(source)
    const candidates = await app.execute({ query: 'x' })
    expect(candidates).toMatchObject({ ok: true, value: expect.stringContaining(`链接：${source}`) })
    const selected = await app.execute({ query: 'x', index: 1 })
    expect(selected).toMatchObject({ ok: true, value: `远程音频链接：${source}\n\n${MODEL_LINK_DELIVERY_HINT}` })
    expect(candidates).not.toHaveProperty('ends')
    expect(selected).not.toHaveProperty('ends')
    expect(app.send).not.toHaveBeenCalled()
  })
  it('AI 切换开关与 default 不改变已保存配置', async () => {
    const off = await setup()
    const ignored = await off.play({ query: 'x', index: 1, sendMode: 'music-card' })
    expect(ignored.text).toContain('https://audio.example/1.mp3')
    expect(off.sent).toHaveLength(0)
    const on = await setup({ allowAISendMode: true })
    await on.play({ query: 'x', index: 1, sendMode: 'music-card' })
    expect(h.normalize(on.sent[0])[0].type).toBe('onebot:music')
    const linked = await on.play({ query: 'x', index: 1, sendMode: 'default' })
    expect(linked.text).toContain('https://audio.example/1.mp3')
    expect(on.sent).toHaveLength(1)
    expect(on.config.sendMode).toBe('audio-url-model')
  })
  it.each([0, 4, 1.5])('拒绝无效序号 %s', async (index) => {
    const app = await setup()
    expect((await app.play({ query: 'x', index })).text).toContain('序号无效')
    expect(app.sent).toHaveLength(0)
  })
  it('空白搜索不请求网络', async () => {
    const app = await setup()
    expect((await app.play({ query: ' ' })).text).toBe('没有找到合适歌曲。')
    expect(app.client.search).not.toHaveBeenCalled()
  })
  it('区分无结果、搜索失败和解析失败', async () => {
    const app = await setup()
    app.client.search.mockResolvedValueOnce([])
    expect((await app.play({ query: 'x' })).text).toBe('没有找到合适歌曲。')
    app.client.search.mockRejectedValueOnce(new Error('search'))
    expect((await app.play({ query: 'x' })).text).toBe('音乐服务暂时不可用。')
    app.client.resolve.mockRejectedValueOnce(new Error('source'))
    expect((await app.play({ query: 'x', index: 1 })).text).toContain('无法获取播放地址')
  })
  it('取消不返回成功链接、不伪装成普通服务错误', async () => {
    const app = await setup()
    const controller = new AbortController()
    app.client.resolve.mockImplementationOnce(async () => { controller.abort(); return 'https://audio.example/1.mp3' })
    await expect(app.play({ query: 'x', index: 1 }, controller.signal)).rejects.toBeDefined()
    expect(app.sent).toHaveLength(0)
  })
  it('取消后不发送 QQ 卡片或兜底网页', async () => {
    const app = await setup({ sendMode: 'music-card' })
    const controller = new AbortController()
    app.client.search.mockImplementationOnce(async () => { controller.abort(); return songs })
    await expect(app.play({ query: 'x', index: 3 }, controller.signal)).rejects.toBeDefined()
    expect(app.send).not.toHaveBeenCalled()
  })
})

describe('v2 原生工具集成', () => {
  it.each([1, 5])('模型链接 limit=%s 的描述和结果包含音频优先提示，不直接发送', async (searchLimit) => {
    const app = await setup({ searchLimit })
    const definition = app.ctx.tools.list().find((tool) => tool.name === 'music_voice')
    expect(definition?.description).toContain(MODEL_LINK_DELIVERY_HINT)
    expect(definition?.locales?.zh?.description).toContain(MODEL_LINK_DELIVERY_HINT)
    const inputs: Parameters<typeof app.execute>[0][] = [{ query: 'x' }, { query: 'x', index: 1 }]
    for (const args of inputs) {
      const result = await app.execute(args)
      expect(result).toMatchObject({ ok: true, value: expect.stringContaining('优先使用原始链接发送音频') })
      expect(result).toMatchObject({ value: expect.stringContaining('明确要求文件或链接时遵从用户要求') })
      expect(result).toMatchObject({ value: expect.stringContaining('音频无法发送时回退为原始链接') })
      expect(result).not.toHaveProperty('ends')
    }
    expect(app.send).not.toHaveBeenCalled()
  })
  it('AI 临时切换为模型链接也有提示，普通卡片候选不附加提示', async () => {
    const app = await setup({ sendMode: 'music-card', allowAISendMode: true })
    const definition = app.ctx.tools.list().find((tool) => tool.name === 'music_voice')
    expect(definition?.description).toContain(MODEL_LINK_DELIVERY_HINT)
    expect(definition?.locales?.zh?.description).toContain(MODEL_LINK_DELIVERY_HINT)
    const normal = await app.execute({ query: 'x' })
    expect(normal).toMatchObject({ ok: true, value: expect.not.stringContaining(MODEL_LINK_DELIVERY_HINT) })
    const inputs: Parameters<typeof app.execute>[0][] = [
      { query: 'x', sendMode: 'audio-url-model' }, { query: 'x', index: 1, sendMode: 'audio-url-model' }
    ]
    for (const args of inputs) {
      const linked = await app.execute(args)
      expect(linked).toMatchObject({ ok: true, value: expect.stringContaining(MODEL_LINK_DELIVERY_HINT) })
      expect(linked).not.toHaveProperty('ends')
    }
    expect(app.config.sendMode).toBe('music-card')
    expect(app.send).not.toHaveBeenCalled()
  })
  it('注册固定原生工具标识和内置描述', async () => {
    const app = await setup()
    const definition = app.ctx.tools.list().find((tool) => tool.name === 'music_voice')
    expect(definition?.description).toContain(TOOL_DESCRIPTION)
    expect(definition?.locales?.zh?.description).toContain(TOOL_DESCRIPTION)
    expect((await app.execute({ query: 'x' })).ok).toBe(true)
  })
  it('卡片候选不结束循环，选歌成功调用 end，防止重复回复', async () => {
    const app = await setup({ sendMode: 'music-card' })
    const candidates = await app.execute({ query: 'x' })
    expect(candidates.ok).toBe(true)
    expect(candidates).not.toHaveProperty('ends')
    const selected = await app.execute({ query: 'x', index: 1 })
    expect(selected).toMatchObject({ ok: true, ends: true, value: '已发送：第一首 - 歌手一' })
    expect(app.sent).toHaveLength(1)
  })
  it('缺会话返回明确错误', async () => {
    const app = await setup()
    expect(await app.execute({ query: 'x' }, 'missing')).toMatchObject({ ok: true, value: '音乐工具无法获取当前会话。' })
  })
  it('非法参数由原生工具服务验证', async () => {
    const app = await setup()
    expect((await app.execute({ query: '', index: 0 })).ok).toBe(false)
    expect(app.client.search).not.toHaveBeenCalled()
  })
  it.each(['audio-buffer', 'audio-url', 'file'])('原生工具拒绝已删除参数 %s，不产生发送副作用', async (sendMode) => {
    const app = await setup({ allowAISendMode: true })
    expect((await app.execute({ query: 'x', index: 1, sendMode })).ok).toBe(false)
    expect(app.client.search).not.toHaveBeenCalled()
    expect(app.send).not.toHaveBeenCalled()
  })
  it('卡片发送失败不设置 ends', async () => {
    const app = await setup({ sendMode: 'music-card' })
    app.send.mockResolvedValueOnce({ messageIds: [] })
    const result = await app.execute({ query: 'x', index: 1 })
    expect(result).not.toHaveProperty('ends')
    expect(result).toMatchObject({ value: '找到了歌曲，但音乐卡片发送失败。' })
  })
  it('单曲卡片直发与模型链接模式保留结果文本，不强制结束', async () => {
    const app = await setup({ searchLimit: 1, sendMode: 'music-card', allowAISendMode: true })
    expect(await app.execute({ query: 'x' })).toMatchObject({ ok: true, value: '已发送：第一首 - 歌手一' })
    const result = await app.execute({ query: 'x', sendMode: 'audio-url-model' })
    expect(result).not.toHaveProperty('ends')
    expect(result).toMatchObject({ value: `远程音频链接：https://audio.example/1.mp3\n\n${MODEL_LINK_DELIVERY_HINT}` })
    expect(app.sent).toHaveLength(1)
  })
  it('卸载撤销工具并取消生命周期', async () => {
    const app = await setup()
    await app.fiber.dispose()
    expect(app.lifetime.signal.aborted).toBe(true)
    expect((await app.execute({ query: 'x' })).ok).toBe(false)
  })
})
