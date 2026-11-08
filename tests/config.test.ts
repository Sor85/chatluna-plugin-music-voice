import { describe, expect, it } from 'vitest'
import { Config } from '../src/config'
import { musicArgs } from '../src/tool'

const config = (input: object = {}) => Config.parse(input)

describe('配置与工具参数', () => {
  it('默认使用模型链接模式', () => {
    expect(config()).toEqual({
      searchLimit: 5, enableNetEaseSearch: true, enableQQMusicSearch: false,
      sourceMode: 'preset', customMetingApi: 'https://api.injahow.cn/meting/',
      allowAISendMode: false, sendMode: 'audio-url-model', debug: false
    })
  })
  it('插件配置不提供工具名称与描述', () => {
    const fields = Object.assign({}, ...(Config.list ?? []).map((group) => group.dict))
    expect(fields).not.toHaveProperty('toolName')
    expect(fields).not.toHaveProperty('toolDescription')
    expect(config()).not.toHaveProperty('toolName')
    expect(config()).not.toHaveProperty('toolDescription')
  })
  it('不提供短链配置', () => {
    const fields = Object.assign({}, ...(Config.list ?? []).map((group) => group.dict))
    for (const key of ['enableAudioUrlModelShortLink', 'audioShortLinkBaseUrl']) {
      expect(fields).not.toHaveProperty(key)
      expect(config()).not.toHaveProperty(key)
    }
  })
  it.each([0, 11, 1.5, -1])('拒绝无效候选数量 %s', (searchLimit) => {
    expect(() => config({ searchLimit })).toThrow()
  })
  it.each(['audio-url-model', 'music-card'])('支持模式 %s', (sendMode) => {
    expect(config({ sendMode }).sendMode).toBe(sendMode)
  })
  it('模式 Schema 只有两个选项，不含隐藏转换分支', () => {
    const modes = Config.list?.[2]?.dict?.['sendMode'].list ?? []
    expect(modes.map((mode) => mode.value)).toEqual(['audio-url-model', 'music-card'])
    expect(modes.every((mode) => mode.type === 'const' && !mode.meta.hidden)).toBe(true)
  })
  it.each(['audio-buffer', 'audio-url', 'file', 'invalid'])('拒绝不支持的配置模式 %s，不自动转换', (sendMode) => {
    expect(() => config({ sendMode })).toThrow()
  })
  it('关闭 AI 切换时不暴露 sendMode', () => {
    expect(musicArgs(config()).dict).not.toHaveProperty('sendMode')
  })
  it('开启 AI 切换时只提供 default 与两种模式', () => {
    const schema = musicArgs(config({ allowAISendMode: true }))
    expect(schema.parse({ query: '歌曲' }).sendMode).toBe('default')
    expect(schema.dict?.['sendMode'].list?.map((item) => item.value)).toEqual([
      'default', 'audio-url-model', 'music-card'
    ])
    expect(schema.parse({ query: '歌曲', sendMode: 'audio-url-model' }).sendMode).toBe('audio-url-model')
    for (const sendMode of ['audio-buffer', 'audio-url', 'file', 'invalid']) {
      expect(() => schema.parse({ query: '歌曲', sendMode })).toThrow()
    }
  })
  it.each([{}, { query: '' }, { query: 1 }, { query: 'x', index: 0 }, { query: 'x', index: 1.5 }])('拒绝无效参数 %j', (input) => {
    expect(() => musicArgs(config()).parse(input)).toThrow()
  })
})
