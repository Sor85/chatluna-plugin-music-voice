export const TOOL_NAME = 'music_voice'
export const TOOL_DESCRIPTION =
  '搜索网易云音乐或 QQ 音乐，返回原始音频链接供 ChatLuna 发送，或在 OneBot 中发送音乐卡片。'

export const MODEL_LINK_DELIVERY_HINT =
  '用户未指定发送形式时，优先使用原始链接发送音频；明确要求文件或链接时遵从用户要求，音频无法发送时回退为原始链接。'

export const PRESET_METING_APIS = [
  'https://api.injahow.cn/meting/',
  'https://api.qijieya.cn/meting/',
  'https://api.moeyao.cn/meting/',
  'https://meting.jinghuashang.cn/',
  'https://meting.qjqq.cn/',
  'https://api.crowya.com/meting/',
  'https://meting-api.mlj-dragon.cn/meting/',
  'https://api.amarea.cn/meting/'
]

export const SEARCH_TIMEOUT_MS = 5000
export const SOURCE_TIMEOUT_MS = 5000
