import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))

// Derive the preservation contract from the public types, not a second event list.
export function compilerArtifacts(declaration = path.join(root, 'src/on-events.d.ts')) {
  const program = ts.createProgram([declaration], {
    lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'], types: [],
    target: ts.ScriptTarget.ES2020, strict: true, noEmit: true,
  })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  if (diagnostics.length) {
    throw new Error(ts.formatDiagnostics(diagnostics, {
      getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n',
    }))
  }
  const checker = program.getTypeChecker()
  const source = program.getSourceFile(declaration)
  const exports = checker.getExportsOfModule(checker.getSymbolAtLocation(source))
  const names = new Set(exports.filter(symbol => symbol.flags & ts.SymbolFlags.Value).map(symbol => symbol.name))
  for (const name of ['OnAPI', 'OnGroup']) {
    const symbol = exports.find(symbol => symbol.name === name)
    if (!symbol) throw new Error(`Missing public type: ${name}`)
    for (const property of checker.getPropertiesOfType(checker.getDeclaredTypeOfSymbol(symbol))) names.add(property.name)
  }
  const properties = [...names].sort()
  if (!properties.every(name => /^[A-Za-z_$][\w$]*$/.test(name))) throw new Error('Extern properties must be identifiers')
  return new Map([
    ['compiler/properties.json', JSON.stringify({ schemaVersion: 1, properties }, null, 2) + '\n'],
    ['compiler/closure.externs.js', [
      '/**',
      ' * @fileoverview on-events public property names. Generated; do not edit.',
      ' * Regenerate with npm run compiler:generate. Custom event properties need application externs.',
      ' * @externs',
      ' */',
      '',
      '/** @constructor */',
      'function OnEventsProperties() {}',
      '',
      ...properties.map(name => `OnEventsProperties.prototype.${name};`),
      '',
    ].join('\n')],
  ])
}

export async function checkCompilerArtifacts() {
  for (const [file, expected] of compilerArtifacts()) {
    const actual = await readFile(path.join(root, file), 'utf8')
    if (actual.replace(/\r\n/g, '\n') !== expected) throw new Error(`${file} is stale; run npm run compiler:generate and review the diff`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await mkdir(path.join(root, 'compiler'), { recursive: true })
  for (const [file, contents] of compilerArtifacts()) await writeFile(path.join(root, file), contents)
  console.log('Generated compiler preservation files from the public declarations.')
}
