import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { compiler as ClosureCompiler } from 'google-closure-compiler'
import { getNativeImagePath } from 'google-closure-compiler/lib/utils.js'
import { JSDOM, VirtualConsole } from 'jsdom'
import { compilerArtifacts, checkCompilerArtifacts } from '../scripts/compiler-support.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const externs = path.join(root, 'compiler/closure.externs.js')
const { properties } = JSON.parse(await readFile(path.join(root, 'compiler/properties.json'), 'utf8'))
const fixture = await readFile(new URL('./compiler.fixture.mjs', import.meta.url), 'utf8')
const helperNames = new Set(['On', 'on', 'off', 'group', 'add', 'defer', 'stop', 'first', 'once', 'capture', 'passive', 'delegate', 'event', 'batch', 'hover', 'ready'])
const eventNames = properties.filter(name => !helperNames.has(name))
const escapedProperties = properties.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
const preserve = new RegExp(`^(?:${escapedProperties})$`)
const mangleProtocol = new RegExp(`^(?:tick_|${escapedProperties})$`)

async function bundle(contents, entry, options = {}) {
  return build({
    stdin: { contents, resolveDir: root, sourcefile: 'consumer.js' },
    alias: { 'on-events': path.join(root, entry) }, bundle: true, write: false,
    format: 'iife', platform: 'browser', target: 'es2020', legalComments: 'none',
    ...options,
  })
}

async function advanced(code, directory, name, extra = {}) {
  const input = path.join(directory, name + '.js'), output = path.join(directory, name + '.advanced.js')
  await writeFile(input, code)
  const compiler = new ClosureCompiler({
    js: input, js_output_file: output, compilation_level: 'ADVANCED',
    language_in: 'ECMASCRIPT_NEXT', language_out: 'ECMASCRIPT_2020',
    env: 'BROWSER', warning_level: 'QUIET', ...extra,
  })
  const native = getNativeImagePath()
  if (native) { compiler.JAR_PATH = null; compiler.javaPath = native }
  await new Promise((resolve, reject) => {
    const child = compiler.run((code, stdout, stderr) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(`Closure failed (${code}): ${stderr || stdout}`))
    })
    const timer = setTimeout(() => { child.kill(); reject(new Error('Closure compilation exceeded 60 seconds')) }, 60_000)
  })
  return readFile(output, 'utf8')
}

function execute(code) {
  const errors = []
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('jsdomError', error => errors.push(error))
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only', virtualConsole })
  const logs = []
  dom.window.console.log = value => logs.push(JSON.parse(value))
  try {
    dom.window.eval(code)
    assert.deepEqual(errors, [], 'consumer listener callbacks must not throw')
    return logs
  } finally { dom.window.close() }
}

function probe(code) {
  const dom = new JSDOM('', { runScripts: 'outside-only' })
  const calls = []
  const pending = new Map()
  for (const method of ['addEventListener', 'removeEventListener']) {
    const native = dom.window.document[method]
    dom.window.document[method] = function(type, callback, options) {
      const capture = !!options?.capture
      calls.push([method === 'addEventListener' ? 'add' : 'remove', type, capture])
      if (method === 'addEventListener') pending.set(callback, [type, capture])
      else {
        assert.deepEqual(pending.get(callback), [type, capture], 'removal matches the registered callback, event and capture')
        pending.delete(callback)
      }
      return native.call(this, type, callback, options)
    }
  }
  try {
    dom.window.eval(code)
    assert.equal(pending.size, 0, 'group removes every actual registration')
  }
  finally { dom.window.close() }
  return calls
}

test('compiler preservation files match the public declarations', checkCompilerArtifacts)

test('compiler consumers cannot hide errors thrown inside event callbacks', () => {
  assert.throws(() => execute(`
    document.addEventListener('probe', () => { throw new Error('callback failed') });
    document.dispatchEvent(new Event('probe'));
  `), /consumer listener callbacks must not throw/)
})

test('compiler generation rejects invalid public declarations', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'on-events-compiler-'))
  t.after(async () => {
    assert.equal(path.dirname(directory), path.resolve(tmpdir()))
    assert.ok(path.basename(directory).startsWith('on-events-compiler-'))
    await rm(directory, { recursive: true, force: true })
  })
  const declaration = path.join(directory, 'invalid.d.ts')
  await writeFile(declaration, 'export type OnAPI = MissingPublicType; export type OnGroup = MissingPublicType;')
  assert.throws(() => compilerArtifacts(declaration), /Cannot find name 'MissingPublicType'/)
})

for (const [name, entry] of [['source', 'src/on-events.js'], ['minified', 'dist/on-events.min.js']]) {
  await test(`${name}: bundler and Closure ADVANCED compatibility`, { timeout: 180_000 }, async t => {
    const directory = await mkdtemp(path.join(tmpdir(), 'on-events-compiler-'))
    t.after(async () => {
      assert.equal(path.dirname(directory), path.resolve(tmpdir()))
      assert.ok(path.basename(directory).startsWith('on-events-compiler-'))
      await rm(directory, { recursive: true, force: true })
    })
    // Dot accesses must themselves pass through the renamer. Computed string
    // lookups would pass even if an event property disappeared from the externs.
    const standard = eventNames.map(type => `{
      let count = 0;
      const stop = On.capture.${type}(button, () => count++);
      fire(button, ${JSON.stringify(type)}); stop(); fire(button, ${JSON.stringify(type)});
      check(count === 1, ${JSON.stringify('standard event: ' + type)});
    }`).join('\n')
    assert.ok(fixture.includes('// STANDARD_EVENT_CHECKS'))
    const consumer = fixture.replace('// STANDARD_EVENT_CHECKS', standard)
    const baseline = await bundle(consumer, entry)
    const expected = execute(baseline.outputFiles[0].text)
    assert.equal(expected[0].filter(label => label.startsWith('standard event: ')).length, eventNames.length)
    for (const [stage, options] of [
      ['bundled', {}],
      ['minified-bundle', { minify: true }],
      ['reserved-properties', { minify: true, mangleCache: {}, mangleProps: mangleProtocol, reserveProps: preserve }],
    ]) {
      await t.test(stage, async () => {
        const bundled = stage === 'bundled' ? baseline : await bundle(consumer, entry, options)
        if (stage === 'reserved-properties') assert.ok(bundled.mangleCache.tick_ && bundled.mangleCache.tick_ !== 'tick_')
        const code = await advanced(bundled.outputFiles[0].text, directory, stage, { externs })
        assert.deepEqual(execute(code), expected)
      })
    }

    await t.test('quoted access still needs externs after bundling', async () => {
      const code = `import { On } from 'on-events'; const g=On.group(); g['capture']['pointerdown'](document,()=>{}); g.stop();`
      const bundled = (await bundle(code, entry, { minify: true })).outputFiles[0].text
      const expected = [['add', 'pointerdown', true], ['remove', 'pointerdown', true]]
      assert.deepEqual(probe(bundled), expected)
      const broken = await advanced(bundled, directory, 'without-externs')
      const renamed = probe(broken)
      assert.notEqual(renamed[0][1], 'pointerdown')
      assert.equal(renamed[0][2], true)
      const fixed = await advanced(bundled, directory, 'with-externs', { externs })
      assert.deepEqual(probe(fixed), expected)
    })

    await t.test('application event properties need their own preservation', async () => {
      const code = `import { On } from 'on-events'; const g=On.group(); g.capture.taskdone(document,()=>{}); g.batch(document,{'taskdone':()=>{}}); g.stop();`
      const bundled = (await bundle(code, entry, { minify: true })).outputFiles[0].text
      const expected = [['add', 'taskdone', true], ['add', 'taskdone', false], ['remove', 'taskdone', true], ['remove', 'taskdone', false]]
      const without = await advanced(bundled, directory, 'custom-without', { externs })
      assert.notDeepEqual(probe(without), expected)
      const application = path.join(directory, 'application.externs.js')
      await writeFile(application, '/** @externs */\n/** @constructor */ function ApplicationEvents() {}\nApplicationEvents.prototype.taskdone;\n')
      const withApplication = await advanced(bundled, directory, 'custom-with', { externs: [externs, application] })
      assert.deepEqual(probe(withApplication), expected)

      const options = { minify: true, mangleCache: {}, mangleProps: /^(?:taskdone|tick_)$/, reserveProps: preserve }
      const mangled = await bundle(code, entry, options)
      assert.ok(mangled.mangleCache.taskdone && mangled.mangleCache.taskdone !== 'taskdone')
      const tooLate = await advanced(mangled.outputFiles[0].text, directory, 'custom-already-mangled', { externs: [externs, application] })
      assert.notDeepEqual(probe(tooLate), expected, 'later externs cannot restore an earlier mangled name')

      const preserved = await bundle(code, entry, { ...options, mangleCache: {}, reserveProps: new RegExp(`^(?:${escapedProperties}|taskdone)$`) })
      const throughBoth = await advanced(preserved.outputFiles[0].text, directory, 'custom-preserved-both-stages', { externs: [externs, application] })
      assert.deepEqual(probe(throughBoth), expected)
    })
  })
}
