import type { Context } from 'cordis'
import { h, type Fragment, type Session } from '@satorijs/core'
import type {} from '@chatluna/chat'
import type { Config } from './config'
import { MODEL_LINK_DELIVERY_HINT } from './constants'
import type { MusicClient } from './network'
import { qqSongPageUrl } from './parsers'
import type { MusicInput, MusicResult, SendMode, Song } from './types'

export class MusicPlayer {
  constructor(
    private ctx: Context,
    private config: Config,
    private client: Pick<MusicClient, 'search' | 'resolve'>
  ) {}

  private async candidates(songs: Song[], mode: SendMode, signal: AbortSignal) {
    const linked = mode === 'audio-url-model'
    const urls = linked ? await Promise.all(songs.map(async (song) => {
      try {
        return await this.client.resolve(song, signal)
      } catch (error) {
        signal.throwIfAborted()
        this.ctx.logger.warn('Audio URL unavailable: %s', error)
        return '获取失败'
      }
    })) : []
    const multiple = new Set(songs.map((song) => song.platform)).size > 1
    const lines = multiple ? [] : ['找到以下候选歌曲：']
    let previous: Song['platform'] | undefined
    songs.forEach((song, index) => {
      if (multiple && previous !== song.platform) {
        if (lines.length) lines.push('')
        lines.push(song.platform === 'qq' ? 'QQ音乐搜索结果：' : '网易云音乐搜索结果：')
      }
      previous = song.platform
      lines.push(`${index + 1}. ${song.name} - ${song.artists}（${song.albumName}）`)
      if (linked) lines.push(`链接：${urls[index]}`)
    })
    return `${lines.join('\n')}\n\n${linked
      ? `请直接从以上链接中选择，不要再次调用本工具传入 index。\n${MODEL_LINK_DELIVERY_HINT}`
      : '请根据用户想听的歌曲，再次调用本工具并传入对应 index。'}`
  }

  private async deliver(session: Session, content: Fragment, signal: AbortSignal) {
    signal.throwIfAborted()
    const result = await this.ctx.chat.send(session.route, content)
    if (!result.messageIds.length) throw new Error('No message was delivered')
  }

  private async sendCard(session: Session, song: Song, signal: AbortSignal) {
    if (session.platform !== 'onebot') throw new Error('Music cards require OneBot')
    try {
      await this.deliver(session, h('onebot:music', {
        type: song.platform === 'netease' ? '163' : 'qq', id: String(song.id)
      }), signal)
    } catch (error) {
      signal.throwIfAborted()
      if (song.platform !== 'qq') throw error
      await this.deliver(session, h.text(qqSongPageUrl(song)), signal)
    }
  }

  async play(session: Session, input: MusicInput, signal: AbortSignal): Promise<MusicResult> {
    signal.throwIfAborted()
    const query = input.query.trim()
    if (!query) return { text: '没有找到合适歌曲。' }
    const mode = this.config.allowAISendMode && input.sendMode && input.sendMode !== 'default'
      ? input.sendMode : this.config.sendMode
    let songs: Song[]
    try {
      songs = await this.client.search(query, signal)
    } catch (error) {
      signal.throwIfAborted()
      this.ctx.logger.warn('Music search unavailable: %s', error)
      return { text: '音乐服务暂时不可用。' }
    }
    if (!songs.length) return { text: '没有找到合适歌曲。' }
    if (this.config.searchLimit > 1 && input.index === undefined) {
      return { text: await this.candidates(songs, mode, signal) }
    }
    const index = this.config.searchLimit === 1 ? 1 : input.index ?? 1
    if (!Number.isInteger(index) || index < 1 || index > songs.length) {
      return { text: `序号无效，请选择 1-${songs.length} 之间的数字。` }
    }
    const song = songs[index - 1]
    if (mode === 'audio-url-model') {
      try {
        const source = await this.client.resolve(song, signal)
        signal.throwIfAborted()
        return { text: `远程音频链接：${source}\n\n${MODEL_LINK_DELIVERY_HINT}` }
      } catch (error) {
        signal.throwIfAborted()
        this.ctx.logger.warn('Audio URL unavailable: %s', error)
        return { text: '找到了歌曲，但暂时无法获取播放地址。' }
      }
    }
    try {
      await this.sendCard(session, song, signal)
      return {
        text: `已发送：${song.name} - ${song.artists}`,
        endTurn: this.config.searchLimit > 1
      }
    } catch (error) {
      signal.throwIfAborted()
      this.ctx.logger.warn('Music delivery failed: %s', error)
      return { text: '找到了歌曲，但音乐卡片发送失败。' }
    }
  }
}
