import { afterEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { openPathInEditor } from '../src/editor'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('openPathInEditor', () => {
  test('passes the target path to the configured shell command', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'awb-editor-'))
    tempDirs.push(root)
    const outputPath = path.join(root, 'editor-target.txt')
    const targetPath = path.join(root, 'worktree with spaces')

    await openPathInEditor(`printf %s \"$1\" > ${JSON.stringify(outputPath)}`, targetPath)

    await expect(fs.readFile(outputPath, 'utf8')).resolves.toBe(targetPath)
  })

  test('throws a clear error when no editor is configured', async () => {
    await expect(openPathInEditor(undefined, '/tmp/worktree')).rejects.toThrow(
      'No AWB editor is configured. Set it in .awb/config.json, AWB_EDITOR, or --editor.',
    )
  })
})
