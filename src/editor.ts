import { spawn } from 'node:child_process'

const MISSING_EDITOR_ERROR = 'No AWB editor is configured. Set it in .awb/config.json, AWB_EDITOR, or --editor.'

export async function openPathInEditor(editorCommand: string | undefined, targetPath: string): Promise<void> {
  const command = editorCommand?.trim()
  if (!command) throw new Error(MISSING_EDITOR_ERROR)

  const shellCommand = /\$1\b/.test(command) ? command : `${command} "$1"`

  await new Promise<void>((resolve, reject) => {
    const child = spawn('/bin/sh', ['-lc', shellCommand, 'sh', targetPath], {
      stdio: 'ignore',
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`Failed to open the worktree in the configured editor (exit code ${code ?? 'unknown'}).`))
    })
  })
}
