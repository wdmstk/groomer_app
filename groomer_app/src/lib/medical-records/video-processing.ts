import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export async function createVideoClipWithFfmpeg(params: {
  sourceBlob: Blob
  outputExt: string
  startSec: number
  durationSec: number
}) {
  const workDir = await mkdtemp(join(tmpdir(), 'groomer-ffmpeg-'))
  const inputPath = join(workDir, 'source.mp4')
  const outputPath = join(workDir, `clip.${params.outputExt || 'mp4'}`)

  try {
    const sourceBuffer = Buffer.from(await params.sourceBlob.arrayBuffer())
    await writeFile(inputPath, sourceBuffer)

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-ss',
        String(Math.max(0, Math.floor(params.startSec))),
        '-i',
        inputPath,
        '-t',
        String(Math.max(1, Math.floor(params.durationSec))),
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        outputPath,
      ])

      ffmpeg.on('error', reject)
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve()
          return
        }
        reject(new Error(`ffmpeg exited with code ${code}`))
      })
    })

    const clipBuffer = await readFile(outputPath)
    return {
      method: 'ffmpeg' as const,
      clipBuffer,
    }
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}
