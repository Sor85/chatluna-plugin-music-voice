import type { Context } from 'cordis'
import { Schema } from '@chatluna/schema'
import type {} from '@chatluna/chat'
import type {} from '@chatluna/tool'
import type { Config } from './config'
import { MODEL_LINK_DELIVERY_HINT, TOOL_DESCRIPTION, TOOL_NAME } from './constants'
import type { MusicPlayer } from './player'
import type { MusicInput } from './types'

export function musicArgs(config: Config): Schema<MusicInput> {
  const shape = {
    query: Schema.string().min(1).required().description('Song name, artist, style or natural-language music search keywords.'),
    index: Schema.number().min(1).step(1).optional()
      .description('1-based candidate index. Reuse the same query. Do not select again when candidate audio links are already returned.')
  }
  if (!config.allowAISendMode) return Schema.object(shape)
  return Schema.object({
    ...shape,
    sendMode: Schema.enum(['default', 'audio-url-model', 'music-card'])
      .default('default').description(`Per-call delivery mode; default uses ${config.sendMode}. audio-url-model returns original links without sending so ChatLuna can deliver them as audio, files or links; music-card sends a OneBot music card.`)
  })
}

export function registerTool(ctx: Context, config: Config, player: MusicPlayer, lifetime: AbortSignal) {
  const instructions = config.sendMode === 'audio-url-model'
    ? 'Candidate results include audio links. Use the returned links without selecting an index again; ChatLuna handles delivery as audio, files or links according to the request.'
    : 'When numbered candidates without links are returned, call again with the same query and the chosen 1-based index.'
  const linkHint = config.sendMode === 'audio-url-model' || config.allowAISendMode
    ? ` 返回模型链接时：${MODEL_LINK_DELIVERY_HINT}` : ''
  ctx.tools.define({
    name: TOOL_NAME,
    description: `${TOOL_DESCRIPTION}${linkHint} ${instructions}${config.allowAISendMode
      ? ` Use sendMode=default unless another delivery mode is requested. Default: ${config.sendMode}. In audio-url-model mode, use candidate links directly.` : ''}`,
    locales: {
      zh: {
        description: `${TOOL_DESCRIPTION}${linkHint}`,
        args: {
          query: '歌曲名、歌手名、风格或自然语言音乐搜索词。',
          index: '不带链接的候选列表中的歌曲序号，从 1 开始。已有链接的结果不需要再次选歌。',
          sendMode: `本次调用的发送方式。default 使用已保存的 ${config.sendMode}，临时切换不修改配置。`
        }
      }
    },
    args: musicArgs(config),
    traits: { effect: 'write', parallel: false, background: false, timeout: 120000 },
    async run(input, call) {
      const session = call.routeId ? ctx.chat.inbound(call.routeId) : undefined
      if (!session) return '音乐工具无法获取当前会话。'
      const signal = AbortSignal.any([call.signal, lifetime])
      const result = await player.play(session, input, signal)
      if (result.endTurn) call.end()
      return result.text
    }
  })
}
