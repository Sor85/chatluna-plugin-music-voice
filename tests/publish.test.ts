import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))
const temporary: string[] = []
afterEach(() => { for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true }) })

interface Command {
  command: string
  args: string[]
  cwd: string
}

function fixture(options: Record<string, unknown> = {}) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), 'music-publish-test-')))
  temporary.push(directory)
  const source = join(directory, 'source')
  const host = join(directory, 'host')
  const target = join(host, 'external/music-voice')
  const bin = join(directory, 'bin')
  const temp = join(directory, 'tmp')
  const log = join(directory, 'commands.jsonl')
  for (const path of [join(source, 'scripts'), join(target, 'lib'), join(target, 'dist'), bin, temp]) mkdirSync(path, { recursive: true })
  for (const name of ['publish.mjs', 'sync-to-v2.mjs']) copyFileSync(join(root, 'scripts', name), join(source, 'scripts', name))
  writeFileSync(join(source, 'package.json'), JSON.stringify({ name: 'chatluna-plugin-music-voice', version: options['version'] ?? '0.0.1', main: 'lib/index.js', types: 'lib/index.d.ts' }))
  writeFileSync(join(source, 'README.md'), '# 发布测试夹具\n')
  writeFileSync(join(source, 'LICENSE'), 'MIT\n')
  writeFileSync(join(host, 'package.json'), '{"name":"fixture-host"}')
  for (const name of ['lib/stale.js', 'dist/stale.js', 'tsconfig.tsbuildinfo']) writeFileSync(join(target, name), 'stale')
  const executable = `#!${process.execPath}
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const command = path.basename(process.argv[1]), args = process.argv.slice(2)
const options = JSON.parse(process.env.PUBLISH_TEST_OPTIONS)
const target = path.join(process.env.CHATLUNA_V2_ROOT, 'external/music-voice')
fs.appendFileSync(process.env.PUBLISH_TEST_LOG, JSON.stringify({ command, args, cwd: process.cwd() }) + '\\n')
const stage = command === 'yarn' && args[0] === 'yakumo' ? 'build' : args[0]
if (options.fail === stage) process.exit(1)
if (command === 'git') {
  if (stage === 'status' && (options.dirty || (options.dirtyAfterBuild && fs.existsSync(path.join(target, 'lib/index.js'))))) console.log(' M package.json')
  else if (stage === 'symbolic-ref') { if (options.detached) process.exit(1); console.log('main') }
  else if (stage === 'tag' && args[1] === '--list' && options.tagExists) console.log('v0.0.1')
  else if (stage === 'rev-parse') console.log(args[1] === 'HEAD'
    ? options.headChanged && fs.existsSync(path.join(target, 'lib/index.js')) ? 'changed' : 'revision'
    : options.remoteMismatch ? 'other' : 'revision')
  else assert.ok(['status', 'tag', 'fetch', 'push'].includes(stage), stage)
} else if (command === 'yarn') {
  if (stage === 'build') {
    assert.equal(process.cwd(), process.env.CHATLUNA_V2_ROOT)
    for (const name of ['lib/stale.js', 'dist/stale.js', 'tsconfig.tsbuildinfo']) assert.ok(!fs.existsSync(path.join(target, name)), 'stale output: ' + name)
    for (const name of ['lib', 'dist']) fs.mkdirSync(path.join(target, name), { recursive: true })
    for (const name of ['lib/index.js', 'lib/index.d.ts', 'dist/client.js']) fs.writeFileSync(path.join(target, name), 'export {}')
  } else if (stage === 'pack') {
    assert.equal(process.cwd(), target)
    const output = args[2], packed = path.join(path.dirname(output), 'package')
    fs.mkdirSync(packed, { recursive: true })
    for (const name of ['package.json', 'README.md', 'LICENSE', 'lib/index.js', 'lib/index.d.ts', 'dist/client.js']) {
      if (options.missingArtifact === name) continue
      fs.mkdirSync(path.dirname(path.join(packed, name)), { recursive: true })
      fs.copyFileSync(path.join(target, name), path.join(packed, name))
    }
    fs.writeFileSync(output, 'tarball fixture')
  } else { assert.ok(['typecheck', 'test'].includes(stage), stage); assert.equal(process.cwd(), target) }
} else if (command === 'tar') {
  assert.deepEqual(args.slice(0, 1), ['-xzf'])
  assert.equal(args[2], '-C')
} else if (command === 'npm') {
  if (stage === 'whoami') console.log('fixture-user')
  else {
    assert.equal(stage, 'publish')
    assert.ok(fs.statSync(args[1]).isDirectory())
    assert.ok(fs.existsSync(path.join(args[1], 'README.md')))
  }
} else throw new Error('Unexpected executable: ' + command)
`
  for (const command of ['git', 'yarn', 'npm', 'tar']) writeFileSync(join(bin, command), executable, { mode: 0o755 })
  const result = (args: string[] = []) => {
    const completed = spawnSync(process.execPath, [join(source, 'scripts/publish.mjs'), ...args], {
      cwd: source,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env['PATH']}`, TMPDIR: temp, CHATLUNA_V2_ROOT: host, PUBLISH_TEST_OPTIONS: JSON.stringify(options), PUBLISH_TEST_LOG: log }
    })
    const commands: Command[] = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : []
    return { ...completed, commands }
  }
  return { result, target }
}

const published = (commands: Command[]) => commands.find(item => item.command === 'npm' && item.args[0] === 'publish')
const tagged = (commands: Command[]) => commands.some(item => item.command === 'git' && item.args[0] === 'tag' && item.args[1] !== '--list')

describe('本地 npm 发布脚本', () => {
  it('演练允许未提交改动，真实同步和清理后按序验证、打包，不登录或操作 Git', () => {
    const app = fixture({ dirty: true })
    const run = app.result(['--dry-run'])
    expect(run.status, run.stderr).toBe(0)
    expect(run.commands.map(item => [item.command, ...item.args.slice(0, 2)])).toEqual([
      ['yarn', 'yakumo', 'build'], ['yarn', 'typecheck'], ['yarn', 'test'],
      ['yarn', 'pack', '--out'], ['tar', '-xzf', expect.stringContaining('package.tgz')],
      ['npm', 'publish', expect.stringContaining('package')]
    ])
    expect(published(run.commands)?.args).toContain('--dry-run')
    expect(basename(published(run.commands)?.args[1] ?? '')).toBe('package')
    expect(existsSync(join(app.target, 'scripts/publish.mjs'))).toBe(true)
    expect(run.stdout).toContain('未发布、未创建或推送 tag')
  })

  it('正式发布校验提交，成功后仅为已验证提交打 tag 并推送', () => {
    const run = fixture().result()
    expect(run.status, run.stderr).toBe(0)
    expect(run.commands).toContainEqual(expect.objectContaining({ command: 'npm', args: ['whoami'] }))
    expect(published(run.commands)?.args).toEqual(['publish', expect.any(String), '--access', 'public'])
    expect(run.commands.slice(-2)).toEqual([
      expect.objectContaining({ command: 'git', args: ['tag', 'v0.0.1', 'revision'] }),
      expect.objectContaining({ command: 'git', args: ['push', 'origin', 'refs/tags/v0.0.1'] })
    ])
  })

  it.each(['alpha', 'beta', 'rc', 'next'])('预发布 %s 不覆盖 latest，验证码只传给 npm', (tag) => {
    const run = fixture({ version: `0.0.2-${tag}.1` }).result(['--dry-run', '--otp=123456'])
    expect(run.status, run.stderr).toBe(0)
    expect(published(run.commands)?.args).toEqual(['publish', expect.any(String), '--access', 'public', '--tag', tag, '--dry-run', '--otp=123456'])
    expect(run.stdout + run.stderr).not.toContain('123456')
  })

  it.each([{ dirty: true }, { tagExists: true }, { remoteMismatch: true }, { detached: true }, { fail: 'whoami' }])('正式发布前置条件不满足时不构建或发布 %j', (options) => {
    const run = fixture(options).result()
    expect(run.status).toBe(1)
    expect(run.commands.some(item => item.command === 'yarn')).toBe(false)
    expect(published(run.commands)).toBeUndefined()
    expect(tagged(run.commands)).toBe(false)
  })

  it.each(['build', 'typecheck', 'test', 'pack'])('%s 失败后不发布、不打 tag', (fail) => {
    const run = fixture({ fail }).result()
    expect(run.status).toBe(1)
    expect(run.commands.at(-1)).toEqual(expect.objectContaining({ command: 'yarn', args: expect.arrayContaining([fail === 'build' ? 'yakumo' : fail]) }))
    expect(published(run.commands)).toBeUndefined()
    expect(tagged(run.commands)).toBe(false)
  })

  it.each([{ dirtyAfterBuild: true }, { headChanged: true }, { missingArtifact: 'lib/index.d.ts' }])('包或验证后提交状态异常时不发布 %j', (options) => {
    const run = fixture(options).result()
    expect(run.status).toBe(1)
    expect(published(run.commands)).toBeUndefined()
    expect(tagged(run.commands)).toBe(false)
  })

  it('npm 发布失败不打 tag，也不在异常中回显 OTP', () => {
    const run = fixture({ fail: 'publish' }).result(['--otp=123456'])
    expect(run.status).toBe(1)
    expect(published(run.commands)).toBeDefined()
    expect(tagged(run.commands)).toBe(false)
    expect(run.stdout + run.stderr).not.toContain('123456')
  })

  it.each([['--dryrun'], ['--otp='], ['unexpected']])('拒绝错误参数 %j，避免误发布', (args) => {
    const run = fixture().result(args)
    expect(run.status).toBe(1)
    expect(run.commands).toEqual([])
  })

  it('帮助和未知预发布标识均不触发外部命令', () => {
    const help = fixture().result(['--help'])
    expect(help.status).toBe(0)
    expect(help.commands).toEqual([])
    const unknown = fixture({ version: '0.0.2-preview.1' }).result(['--dry-run'])
    expect(unknown.status).toBe(1)
    expect(unknown.commands).toEqual([])
  })
})
