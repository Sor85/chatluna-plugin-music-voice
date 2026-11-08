// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Context } from 'cordis'
import { Schema } from '@chatluna/schema'
import { LocaleService, RootContext } from '@chatluna/ui-client/client'
import { SchemaForm, extensionOf } from '@chatluna/ui-schema-form/client'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import apply from '../client'
import { SendModeField } from '../client/send-mode-field'
import { Config } from '../src/config'

const sendModeSchema = Config.list?.[2]?.dict?.['sendMode']
if (!sendModeSchema) throw new Error('Missing sendMode schema')

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
afterAll(() => vi.unstubAllGlobals())
let root: Root | undefined
let ctx: Context | undefined
let container: HTMLDivElement
const schema = Schema.object({ sendMode: sendModeSchema, allowAISendMode: Schema.boolean().default(false) })
afterEach(async () => {
  await act(async () => root?.unmount())
  await ctx?.fiber.dispose()
  root = undefined
  ctx = undefined
  container?.remove()
})

async function mount(initial: Record<string, unknown> = {}) {
  ctx = new Context()
  await ctx.plugin(LocaleService)
  ctx.locale.setLocale('zh')
  await ctx.plugin({ inject: ['locale'], apply })
  const context = ctx
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  let current = initial
  function Form() {
    const [value, setValue] = useState(initial)
    current = value
    return <RootContext value={context}><SchemaForm schema={schema} value={value} initial={initial} onChange={setValue} /></RootContext>
  }
  await act(async () => root?.render(<Form />))
  return { current: () => current, context }
}

async function select(mode: string) {
  const control = container.querySelector(`label[for$="-${mode}"] [role="radio"]`)
  if (!control) throw new Error(`Missing radio: ${mode}`)
  await act(async () => control.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}

describe('ui-kit 发送模式配置', () => {
  it('在原 SchemaForm 仅显示两种模式与默认值，不写入草稿', async () => {
    const app = await mount()
    expect(container.querySelectorAll('[role="radio"]')).toHaveLength(2)
    expect(container.querySelector('label[for$="-audio-url"]')).toBeNull()
    expect(container.querySelector('label[for$="-file"]')).toBeNull()
    expect(container.textContent).toContain('由 ChatLuna 根据请求决定发送语音、文件或链接')
    expect(container.textContent).toContain('音源提供的原始链接')
    expect(container.textContent).not.toContain('302')
    expect(container.textContent).not.toContain('短链')
    expect(container.querySelector('[role="radio"][aria-checked="true"]')?.closest('label')?.htmlFor).toContain('audio-url-model')
    expect(container.querySelector('label[for$="-audio-buffer"]')).toBeNull()
    expect(app.current()).toEqual({})
  })
  it('切换所有模式，只修改该字段', async () => {
    const app = await mount({ allowAISendMode: true })
    for (const mode of ['music-card', 'audio-url-model']) {
      await select(mode)
      expect(app.current()).toEqual({ allowAISendMode: true, sendMode: mode })
      expect(Config.parse(app.current()).sendMode).toBe(mode)
    }
  })
  it('已保存模式回显，语言切换不改变配置', async () => {
    const app = await mount({ sendMode: 'audio-url-model' })
    expect(container.querySelector('[role="radio"][aria-checked="true"]')?.closest('label')?.htmlFor).toContain('audio-url-model')
    await act(async () => app.context.locale.setLocale('en'))
    expect(container.textContent).toContain('Return audio links to the model')
    expect(app.current()).toEqual({ sendMode: 'audio-url-model' })
  })
  it('未知模式不自动映射为默认值，也不改写草稿', async () => {
    const app = await mount({ sendMode: 'invalid' })
    expect(container.querySelectorAll('[role="radio"]')).toHaveLength(2)
    expect(container.querySelector('[role="radio"][aria-checked="true"]')).toBeNull()
    expect(app.current()).toEqual({ sendMode: 'invalid' })
    expect(() => Config.parse(app.current())).toThrow()
    await select('music-card')
    expect(app.current()).toEqual({ sendMode: 'music-card' })
  })
  it('恢复默认继续使用宿主操作菜单', async () => {
    const app = await mount({ sendMode: 'music-card', allowAISendMode: true })
    const menu = container.querySelector('button[aria-label="默认歌曲发送方式更多操作"]')
    if (!menu) throw new Error('Missing schema actions')
    await act(async () => menu.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    const restore = [...document.querySelectorAll('[role="menuitem"]')].find((element) => element.textContent?.includes('恢复默认'))
    if (!restore) throw new Error('Missing restore action')
    await act(async () => restore.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(app.current().sendMode).toBeUndefined()
    expect(app.current().allowAISendMode).toBe(true)
  })
  it('只注册插件专属 role，卸载恢复默认渲染', async () => {
    await mount()
    expect(extensionOf(sendModeSchema, 'audio-url-model')?.component).toBe(SendModeField)
    expect(extensionOf(Schema.enum(['a', 'b']).role('radio'), 'a')?.component).not.toBe(SendModeField)
    await act(async () => root?.unmount())
    root = undefined
    await ctx?.fiber.dispose()
    expect(extensionOf(sendModeSchema, 'audio-url-model')?.component).not.toBe(SendModeField)
  })
})
