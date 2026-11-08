import { Schema } from '@chatluna/schema'
import type { SendMode } from './types'

export interface Config {
  searchLimit: number
  enableNetEaseSearch: boolean
  enableQQMusicSearch: boolean
  sourceMode: 'preset' | 'custom'
  customMetingApi: string
  allowAISendMode: boolean
  sendMode: SendMode
  debug: boolean
}

const sendModeSchema = Schema.union([
  Schema.const('audio-url-model').description('返回远程音频链接给模型'),
  Schema.const('music-card').description('按歌曲来源发送音乐卡片')
])

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    searchLimit: Schema.number().min(1).max(10).step(1).label('候选数量')
      .description('每个平台每次搜索返回的候选歌曲数量。设为 1 时直接发送第一首，否则返回候选列表。').default(5),
    enableNetEaseSearch: Schema.boolean().label('网易云音乐').description('启用网易云音乐搜索。').default(true),
    enableQQMusicSearch: Schema.boolean().label('QQ 音乐')
      .description('启用 QQ 音乐搜索。搜索接口与卡片发送受歌曲和平台限制，可能失败；单个平台失败不影响另一平台的结果。').default(false)
  }).description('基础设置'),
  Schema.object({
    sourceMode: Schema.union([
      Schema.const('preset').description('预设 Meting API'),
      Schema.const('custom').description('自定义 Meting API')
    ]).role('radio').label('歌曲直链来源').default('preset'),
    customMetingApi: Schema.string().role('link').label('自定义 Meting API')
      .description('自定义来源使用的 HTTP(S) 地址。请求会设置 type、id 与音乐平台 server 参数。')
      .default('https://api.injahow.cn/meting/')
  }).description('请求设置'),
  Schema.object({
    allowAISendMode: Schema.boolean().label('允许 AI 临时切换发送方式')
      .description('关闭时不向模型暴露 sendMode 参数，始终使用默认歌曲发送方式。临时切换不改变已保存配置。').default(false),
    sendMode: sendModeSchema.role('music-voice:send-mode').label('默认歌曲发送方式')
      .description('关闭 AI 临时切换时始终使用此方式。').default('audio-url-model')
  }).description('发送设置'),
  Schema.object({
    debug: Schema.boolean().label('调试日志').description('输出请求命中信息，不记录音频内容。').default(false)
  }).description('开发者选项')
])
