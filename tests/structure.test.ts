import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = new URL('..', import.meta.url).pathname

describe('项目边界', () => {
  it('子目录说明均在根清单登记，登记路径存在', () => {
    const entry = readFileSync(join(root, 'AGENTS.md'), 'utf8')
    const registered = [...entry.matchAll(/`([^`]+\/AGENTS\.md)`/g)].map((match) => match[1])
    const found: string[] = []
    for (const name of ['src', 'client', 'tests']) {
      const walk = (directory: string) => {
        for (const file of readdirSync(join(root, directory), { withFileTypes: true })) {
          const relative = `${directory}/${file.name}`
          if (file.isDirectory()) walk(relative)
          else if (file.name === 'AGENTS.md') found.push(relative)
        }
      }
      walk(name)
    }
    expect(new Set(registered)).toEqual(new Set(found))
    for (const path of registered) expect(existsSync(join(root, path))).toBe(true)
  })

  it('运行依赖不引入旧 ChatLuna、LangChain 或 Zod，许可证为 MIT', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    const dependencies = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies })
    expect(dependencies.some((name) => /langchain|zod|koishi-plugin-chatluna/.test(name))).toBe(false)
    expect(pkg.license).toBe('MIT')
  })
})
