#!/usr/bin/env node
// 本地发布：同步到 v2、清理旧产物、构建与验证、yarn pack，再从解压目录发布以保留 npm README。
// 用法：node scripts/publish.mjs [--dry-run] [--otp=123456]
// 源码目录没有依赖和锁文件，直接用 node 运行，不经 yarn，也不注册 npm 的 publish 生命周期脚本。

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const host = path.resolve(process.env.CHATLUNA_V2_ROOT ?? path.join(source, '../../chatluna-v2-mirror'))
const target = path.join(host, 'external/music-voice')

function run(command, args, cwd = source, capture = false) {
  try {
    return execFileSync(command, args, {
      cwd,
      stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
      encoding: 'utf8'
    })?.trim()
  } catch {
    // execFileSync 的默认错误含完整命令，不回显可能携带 OTP 的参数。
    throw new Error(`${path.basename(command)} 执行失败，发布流程已停止`)
  }
}

const read = (command, args) => run(command, args, source, true)
const assertClean = () => {
  if (read('git', ['status', '--porcelain'])) throw new Error('工作区有未提交的改动，正式发布前先提交并推送')
}

function main() {
  const { values } = parseArgs({ options: {
    'dry-run': { type: 'boolean', default: false },
    otp: { type: 'string' },
    help: { type: 'boolean', default: false }
  } })
  if (values.help) {
    console.log('用法：node scripts/publish.mjs [--dry-run] [--otp=123456]\n--dry-run：构建、验证和打包后执行 npm publish --dry-run，不发布、不打 tag；允许未提交改动。\n正式发布：工作区须干净、HEAD 与 origin 当前分支一致、版本 tag 不存在且 npm 已登录。\n宿主默认 ../../chatluna-v2-mirror，可通过 CHATLUNA_V2_ROOT 指定。')
    return
  }
  if (values.otp === '') throw new Error('--otp 不能为空')
  const dryRun = values['dry-run']
  const pkg = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'))
  const { name, version } = pkg
  const tag = `v${version}`
  const prerelease = version.split('+')[0].match(/-([^.]+)/)?.[1]
  if (prerelease && !['alpha', 'beta', 'rc', 'next'].includes(prerelease)) {
    throw new Error('预发布版本须使用 alpha、beta、rc 或 next 标识，避免发布到 latest')
  }
  let revision
  if (!dryRun) {
    assertClean()
    const branch = read('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'])
    run('git', ['fetch', 'origin', '--tags', '--quiet'])
    if (read('git', ['tag', '--list', tag])) throw new Error(`tag ${tag} 已存在，先更新 package.json 的版本`)
    revision = read('git', ['rev-parse', 'HEAD'])
    if (revision !== read('git', ['rev-parse', `refs/remotes/origin/${branch}`])) {
      throw new Error('HEAD 与 origin 当前分支不一致，先同步提交后再发布')
    }
    read('npm', ['whoami'])
  }

  console.log(`[publish] ${name}@${version}${dryRun ? '（演练）' : ''}`)
  run(process.execPath, [path.join(source, 'scripts/sync-to-v2.mjs'), '--once'])
  // 同步不会移除已删除模块的生成物；增量状态必须一并清除，才能重新生成声明文件。
  for (const entry of ['lib', 'dist', 'tsconfig.tsbuildinfo']) {
    fs.rmSync(path.join(target, entry), { recursive: true, force: true })
  }
  run('yarn', ['yakumo', 'build', 'music-voice'], host)
  run('yarn', ['typecheck'], target)
  run('yarn', ['test'], target)

  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'music-voice-publish-'))
  const tarball = path.join(workdir, 'package.tgz')
  // yarn pack 会改写 workspace:*；从解压目录发布才能让 npm 元数据包含 README。
  run('yarn', ['pack', '--out', tarball], target)
  run('tar', ['-xzf', tarball, '-C', workdir])
  const packageDir = path.join(workdir, 'package')
  const packed = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'))
  if (packed.name !== name || packed.version !== version) throw new Error('打包结果的名称或版本与源码不一致')
  for (const file of [pkg.main, pkg.types, 'dist/client.js', 'README.md', 'LICENSE']) {
    if (!fs.statSync(path.join(packageDir, file)).isFile()) throw new Error(`发布包缺少文件：${file}`)
  }
  if (!dryRun) {
    assertClean()
    if (read('git', ['rev-parse', 'HEAD']) !== revision) throw new Error('验证期间 HEAD 已变化，停止发布')
  }

  const args = ['publish', packageDir, '--access', 'public']
  if (prerelease) args.push('--tag', prerelease)
  if (dryRun) args.push('--dry-run')
  if (values.otp) args.push(`--otp=${values.otp}`)
  run('npm', args)
  if (dryRun) {
    console.log(`[publish] 演练完成，未发布、未创建或推送 tag。包文件：${tarball}；解压目录：${packageDir}`)
    return
  }
  console.log(`[publish] npm 已发布 ${name}@${version}，正在推送 ${tag}`)
  run('git', ['tag', tag, revision])
  run('git', ['push', 'origin', `refs/tags/${tag}`])
  console.log(`[publish] 已发布 ${name}@${version}，tag ${tag} 已推送`)
}

try {
  main()
} catch (error) {
  console.error(`[publish] ${error.message}`)
  process.exitCode = 1
}
