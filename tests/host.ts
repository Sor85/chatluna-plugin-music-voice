import { Context } from 'cordis'
import { Satori, Session, type Fragment } from '@satorijs/core'
import type {} from '@chatluna/chat'
import Permissions from '@chatluna/permission'
import Tools from '@chatluna/tool'
import { vi } from 'vitest'
import { Config } from '../src/config'
import { TOOL_NAME } from '../src/constants'
import { MusicPlayer } from '../src/player'
import { registerTool } from '../src/tool'
import type { Song } from '../src/types'

export const songs: Song[] = [
  { platform: 'netease', id: 1, name: '第一首', artists: '歌手一', albumName: '专辑一' },
  { platform: 'netease', id: 2, name: '第二首', artists: '歌手二', albumName: '专辑二' },
  { platform: 'qq', id: 3, sourceId: 'MID', name: 'QQ歌曲', artists: 'QQ歌手', albumName: 'QQ专辑' }
]

export async function host(overrides: Partial<Config> = {}) {
  const ctx = new Context()
  await ctx.plugin(Satori)
  await ctx.plugin(Permissions, {})
  await ctx.plugin(Tools, {})
  const config = Config.parse(overrides)
  const sent: Fragment[] = []
  const send = vi.fn(async (_route: unknown, content: Fragment) => {
    sent.push(content)
    return { messageIds: ['sent'] }
  })
  const bot = { ctx, platform: 'onebot', selfId: 'bot', user: { id: 'bot' }, logger: ctx.logger }
  const session = new Session(bot, {
    type: 'message', platform: 'onebot', selfId: 'bot', user: { id: 'user' },
    channel: { id: 'group', type: 0 }, guild: { id: 'group' }, message: { id: 'message' }
  })
  ctx.provide('chat', { inbound: (route: string) => route === 'test-route' ? session : undefined, send })
  const client = {
    search: vi.fn(async () => songs),
    resolve: vi.fn(async (song: Song) => `https://audio.example/${song.id}.mp3`)
  }
  const lifetime = new AbortController()
  let player: MusicPlayer
  const fiber = await ctx.plugin({
    inject: ['tools', 'chat'],
    apply(ctx: Context) {
      ctx.effect(() => () => lifetime.abort())
      player = new MusicPlayer(ctx, config, client)
      registerTool(ctx, config, player, lifetime.signal)
    }
  })
  return {
    ctx, config, sent, send, client, session, fiber, lifetime,
    play: (input: { query: string; index?: number; sendMode?: Config['sendMode'] | 'default' }, signal = lifetime.signal) => player.play(session, input, signal),
    execute: (args: Record<string, string | number>, routeId: string | undefined = 'test-route') =>
      ctx.tools.execute({ name: TOOL_NAME, routeId, args }),
    close: () => ctx.fiber.dispose()
  }
}
