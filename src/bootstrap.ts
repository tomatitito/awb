#!/usr/bin/env bun
import { AWB_PACKAGE_DIR_ENV, getAwbPiPackageDir } from './runtimeSupport.js'

const packageDir = getAwbPiPackageDir()
process.env[AWB_PACKAGE_DIR_ENV] ??= packageDir
process.env.PI_PACKAGE_DIR ??= packageDir

await import('./cli.js')
