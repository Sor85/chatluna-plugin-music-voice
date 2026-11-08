import type { Context } from 'cordis'
import { httpFetch } from '@chatluna/utils'
import type {} from '@cordisjs/plugin-http'
import type {} from '@chatluna/ui-server'
import { Config } from './config'
import { MusicClient } from './network'
import { MusicPlayer } from './player'
import { registerTool } from './tool'

export const name = 'chatluna-music-voice'
export { Config }
export const inject = ['http', 'tools', 'chat']

export function apply(ctx: Context, config: Config) {
  const lifetime = new AbortController()
  ctx.effect(() => () => lifetime.abort())
  const client = new MusicClient(config, httpFetch(ctx.http), lifetime.signal, ctx.logger)
  const player = new MusicPlayer(ctx, config, client)
  registerTool(ctx, config, player, lifetime.signal)
  ctx.inject(['chatluna_webui'], (ctx) => {
    ctx.chatluna_webui.addEntry({
      baseUrl: import.meta.url,
      source: '../client/index.ts',
      bundle: '../dist/client.js'
    })
  })
}
