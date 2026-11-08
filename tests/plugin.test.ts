import { Context } from 'cordis'
import { Satori } from '@satorijs/core'
import Permissions from '@chatluna/permission'
import Tools from '@chatluna/tool'
import Http from '@cordisjs/plugin-http'
import Server from '@cordisjs/plugin-server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as music from '../src'

const roots: Context[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map((ctx) => ctx.fiber.dispose())) })

describe('插件生命周期', () => {
  it('注册工具，不注册 HTTP 重定向路由', async () => {
    const ctx = new Context()
    roots.push(ctx)
    await ctx.plugin(Satori)
    await ctx.plugin(Permissions, {})
    await ctx.plugin(Tools, {})
    await ctx.plugin(Http)
    await ctx.plugin(Server, { host: '127.0.0.1', port: 0 })
    ctx.provide('chat', { inbound: () => undefined })
    const register = vi.spyOn(ctx.server, 'get')
    const fiber = await ctx.plugin(music, music.Config.parse({}))
    expect(register).not.toHaveBeenCalled()
    register.mockRestore()
    expect(ctx.tools.list().some((tool) => tool.name === 'music_voice')).toBe(true)
    const address = ctx.server._http.address()
    if (!address || typeof address === 'string') throw new Error('Missing server address')
    const response = await fetch(`http://127.0.0.1:${address.port}/chatluna-music/audio/legacy`, { redirect: 'manual' })
    expect(response.status).toBe(404)
    expect(response.headers.get('location')).toBeNull()
    await fiber.dispose()
    expect(ctx.tools.list().some((tool) => tool.name === 'music_voice')).toBe(false)
  })
})
