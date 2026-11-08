import { describe, expect, it } from 'vitest'
import { buildMetingUrl, parseAudioUrl, parseNetEaseSearch, parseQQSearch, qqSongPageUrl } from '../src/parsers'

const neteaseItem = { id: 1, name: '测试歌曲', artists: [{ name: '歌手' }], album: { name: '专辑' } }
const qqItem = { songid: 2, songname: 'QQ 歌曲', singer: [{ name: 'QQ 歌手' }], albumname: 'QQ 专辑', songmid: 'MID' }

describe('提供方数据边界', () => {
  it('解析网易云歌曲并跳过损坏记录', () => {
    const data = JSON.stringify({ result: { songs: [null, {}, { ...neteaseItem, artists: [null] }, neteaseItem] } })
    expect(parseNetEaseSearch(data)).toEqual([{ platform: 'netease', id: 1, name: '测试歌曲', artists: '歌手', albumName: '专辑' }])
  })
  it('QQ 空成员不破坏其他歌曲，mid 与 card id 分离', () => {
    const data = JSON.stringify({ data: { song: { list: [null, {}, { ...qqItem, singer: [null, { name: '有效歌手' }] }] } } })
    expect(parseQQSearch(data)).toEqual([{ platform: 'qq', id: 2, sourceId: 'MID', name: 'QQ 歌曲', artists: '有效歌手', albumName: 'QQ 专辑' }])
  })
  it.each([undefined, null, 'invalid', 180])('忽略未使用的时长元数据 %s，不丢弃可用歌曲', (duration) => {
    const netease = JSON.stringify({ result: { songs: [{ ...neteaseItem, duration }] } })
    const qq = JSON.stringify({ data: { song: { list: [{ ...qqItem, interval: duration }] } } })
    expect(parseNetEaseSearch(netease)).toEqual([
      { platform: 'netease', id: 1, name: '测试歌曲', artists: '歌手', albumName: '专辑' }
    ])
    expect(parseQQSearch(qq)).toEqual([
      { platform: 'qq', id: 2, sourceId: 'MID', name: 'QQ 歌曲', artists: 'QQ 歌手', albumName: 'QQ 专辑' }
    ])
  })
  it('QQ media_mid 作为回退 ID', () => {
    const data = JSON.stringify({ data: { song: { list: [{ ...qqItem, songmid: '', media_mid: 'media' }] } } })
    expect(parseQQSearch(data)?.[0]?.sourceId).toBe('media')
  })
  it.each(['', 'null', '{}', '<html/>', '[]'])('非法结构不成为空结果 %s', (input) => {
    expect(parseNetEaseSearch(input)).toBeUndefined()
    expect(parseQQSearch(input)).toBeUndefined()
  })
  it('区分合法空结果', () => {
    expect(parseNetEaseSearch('{"result":{"songs":[]}}')).toEqual([])
    expect(parseQQSearch('{"data":{"song":{"list":[]}}}')).toEqual([])
  })
  it.each(['https://audio.example/song.mp3', 'http://audio.example/song.wav'])('接受 HTTP 链接 %s', (url) => {
    expect(parseAudioUrl(` ${url}\n`)).toBe(url)
    expect(parseAudioUrl(JSON.stringify({ url: ` ${url} ` }))).toBe(url)
  })
  it.each(['file:///tmp/song', 'javascript:alert(1)', 'data:audio/wav;base64,AA', '{"url":1}', 'null', '{}'])('拒绝非法音频链接 %s', (url) => {
    expect(parseAudioUrl(url)).toBeUndefined()
  })
  it('Meting 覆盖平台、type 与 id，保留其他参数并清 hash', () => {
    const url = new URL(buildMetingUrl('https://example.test/meting?token=x&server=tencent&type=old#hash', 1, 'netease'))
    expect(Object.fromEntries(url.searchParams)).toEqual({ token: 'x', server: 'netease', type: 'url', id: '1' })
    expect(url.hash).toBe('')
    expect(new URL(buildMetingUrl('https://example.test/', 'MID', 'qq')).searchParams.get('server')).toBe('tencent')
  })
  it('QQ 网页回退优先 mid，否则数字 id', () => {
    const song = parseQQSearch(JSON.stringify({ data: { song: { list: [qqItem] } } }))?.[0]
    if (!song) throw new Error('fixture')
    expect(qqSongPageUrl(song)).toContain('songDetail/MID')
    expect(qqSongPageUrl({ ...song, sourceId: undefined })).toContain('songid=2')
  })
})
