import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const srcRootUrl = new URL('../src/', import.meta.url)

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith('@/')) {
    const baseUrl = new URL(specifier.slice(2), srcRootUrl)
    const basePath = fileURLToPath(baseUrl)
    const candidates = [
      basePath,
      `${basePath}.ts`,
      `${basePath}.tsx`,
      `${basePath}.js`,
      `${basePath}.mjs`,
      `${basePath}/index.ts`,
      `${basePath}/index.tsx`,
      `${basePath}/index.js`,
      `${basePath}/index.mjs`,
    ]

    const matchedPath = candidates.find((candidate) => existsSync(candidate))
    if (matchedPath) {
      return defaultResolve(pathToFileURL(matchedPath).href, context, defaultResolve)
    }
  }

  return defaultResolve(specifier, context, defaultResolve)
}
