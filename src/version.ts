import { AWB_VERSION } from './generatedVersion.js'

export async function getAwbVersion(): Promise<string> {
  return AWB_VERSION
}
