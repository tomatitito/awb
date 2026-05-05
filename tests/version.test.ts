import { describe, expect, test } from 'bun:test'
import { getAwbVersion } from '../src/version'

describe('getAwbVersion', () => {
  test('uses the embedded version instead of runtime package metadata env vars', async () => {
    const previousAwbPackageDir = process.env.AWB_PACKAGE_DIR
    const previousPiPackageDir = process.env.PI_PACKAGE_DIR
    process.env.AWB_PACKAGE_DIR = '/path/to/pi-package'
    process.env.PI_PACKAGE_DIR = '/path/to/pi-package'

    try {
      await expect(getAwbVersion()).resolves.toMatch(/^\d+\.\d+\.\d+/)
    } finally {
      if (previousAwbPackageDir === undefined) delete process.env.AWB_PACKAGE_DIR
      else process.env.AWB_PACKAGE_DIR = previousAwbPackageDir
      if (previousPiPackageDir === undefined) delete process.env.PI_PACKAGE_DIR
      else process.env.PI_PACKAGE_DIR = previousPiPackageDir
    }
  })
})
