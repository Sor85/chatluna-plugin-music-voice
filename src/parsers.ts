import { isPlainObject } from '@chatluna/utils/object'
import type { MusicPlatform, Song } from './types'

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content)
  } catch {
    return undefined
  }
}

export function parseNetEaseSearch(content: string): Song[] | undefined {
  const data = parseJson(content)
  if (!isPlainObject(data) || !isPlainObject(data['result'])) return
  const songs: unknown = data['result']['songs']
  if (!Array.isArray(songs)) return

  return songs.flatMap((item: unknown): Song[] => {
    if (!isPlainObject(item)) return []
    const { id, name, artists, album } = item
    if (
      typeof id !== 'number' || !Number.isFinite(id) ||
      typeof name !== 'string' ||
      !Array.isArray(artists) || !isPlainObject(album) || typeof album['name'] !== 'string'
    ) return []
    const names = artists.flatMap((artist: unknown) =>
      isPlainObject(artist) && typeof artist['name'] === 'string' ? [artist['name']] : []
    )
    if (names.length !== artists.length) return []
    return [{ platform: 'netease', id, name, artists: names.join('/'), albumName: album['name'] }]
  })
}

export function parseQQSearch(content: string): Song[] | undefined {
  const data = parseJson(content)
  if (!isPlainObject(data) || !isPlainObject(data['data']) || !isPlainObject(data['data']['song'])) return
  const songs: unknown = data['data']['song']['list']
  if (!Array.isArray(songs)) return

  return songs.flatMap((item: unknown): Song[] => {
    if (!isPlainObject(item)) return []
    const { songid, songname, singer, songmid, media_mid, albumname } = item
    if (
      typeof songid !== 'number' || !Number.isFinite(songid) ||
      typeof songname !== 'string' || !Array.isArray(singer)
    ) return []
    const sourceId = typeof songmid === 'string' && songmid
      ? songmid
      : typeof media_mid === 'string' && media_mid ? media_mid : undefined
    return [{
      platform: 'qq',
      id: songid,
      sourceId,
      name: songname,
      artists: singer.flatMap((artist: unknown) =>
        isPlainObject(artist) && typeof artist['name'] === 'string' ? [artist['name']] : []
      ).join('/'),
      albumName: typeof albumname === 'string' ? albumname : ''
    }]
  })
}

export function parseAudioUrl(content: string): string | undefined {
  const value = content.trim()
  const parsed = parseJson(value)
  const candidate = isPlainObject(parsed) && typeof parsed['url'] === 'string' ? parsed['url'].trim() : value
  try {
    const url = new URL(candidate)
    if (url.protocol === 'http:' || url.protocol === 'https:') return candidate
  } catch {
    return undefined
  }
}

export function buildMetingUrl(baseUrl: string, songId: number | string, platform: MusicPlatform) {
  const url = new URL(baseUrl)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Invalid Meting protocol')
  url.searchParams.set('type', 'url')
  url.searchParams.set('id', String(songId))
  url.searchParams.set('server', platform === 'qq' ? 'tencent' : 'netease')
  url.hash = ''
  return url.toString()
}

export function qqSongPageUrl(song: Song) {
  return song.sourceId
    ? `https://y.qq.com/n/ryqq/songDetail/${encodeURIComponent(song.sourceId)}`
    : `https://i.y.qq.com/v8/playsong.html?songid=${song.id}`
}
