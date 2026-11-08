import type { Context } from 'cordis'
import { registerReactFormExtension } from '@chatluna/ui-schema-form/client'
import { SendModeField } from './send-mode-field'
import zh from './locales/zh.yml'
import en from './locales/en.yml'

export default function apply(ctx: Context) {
  ctx.locale.register('music-voice', { zh, en })
  ctx.effect(() => registerReactFormExtension({
    type: 'union',
    role: 'music-voice:send-mode',
    component: SendModeField,
    priority: 30
  }))
}
