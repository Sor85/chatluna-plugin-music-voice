export type MusicPlatform = 'netease' | 'qq'
export type SendMode = 'audio-url-model' | 'music-card'

export interface Song {
  platform: MusicPlatform
  id: number
  sourceId?: string
  name: string
  artists: string
  albumName: string
}

export interface MusicInput {
  query: string
  index?: number
  sendMode?: SendMode | 'default'
}

export interface MusicResult {
  text: string
  endTurn?: boolean
}
