import fs from 'node:fs/promises'
import path from 'node:path'

const rootDir = process.cwd()
const rootEsbuildDir = path.join(rootDir, 'node_modules', 'esbuild')
const viteEsbuildDir = path.join(rootDir, 'node_modules', 'vite', 'node_modules', 'esbuild')

async function exists(target) {
  try {
    await fs.lstat(target)
    return true
  } catch {
    return false
  }
}

async function main() {
  if (!(await exists(rootEsbuildDir)) || !(await exists(path.dirname(viteEsbuildDir)))) {
    return
  }

  const relativeTarget = path.relative(path.dirname(viteEsbuildDir), rootEsbuildDir)

  if (await exists(viteEsbuildDir)) {
    const stat = await fs.lstat(viteEsbuildDir)
    if (stat.isSymbolicLink()) {
      const currentTarget = await fs.readlink(viteEsbuildDir)
      if (currentTarget === relativeTarget) return
    }
    await fs.rm(viteEsbuildDir, { recursive: true, force: true })
  }

  await fs.symlink(relativeTarget, viteEsbuildDir, 'dir')
  console.log(`awb: linked vite esbuild -> ${relativeTarget}`)
}

await main()
