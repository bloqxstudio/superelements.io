import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash, createDecipheriv, createHmac } from 'node:crypto'
import { prepareWAMessageMedia, getMediaKeys } from 'baileys'
import { toVoice } from '../src/voz.ts'

const binary = (name) => ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'].map((dir) => join(dir, name)).find(existsSync) ?? name
const ffmpeg = binary('ffmpeg')
const ffprobe = binary('ffprobe')

test('gravações do navegador viram voz com tempo não negativo e mídia íntegra', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'whatsapp-voice-'))
  try {
    for (const [ext, codec] of [['webm', 'libopus'], ['m4a', 'aac'], ['ogg', 'libopus']]) {
      const source = join(dir, `input.${ext}`)
      execFileSync(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1.3', '-c:a', codec, source])
      const voice = await toVoice(await readFile(source))
      assert.ok(voice)
      const target = join(dir, 'voice.ogg')
      await writeFile(target, voice.ogg)
      const info = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'format=start_time,duration:stream=codec_name,sample_rate,channels', '-of', 'json', target]))
      assert.equal(info.streams[0].codec_name, 'opus')
      assert.equal(info.streams[0].channels, 1)
      assert.equal(info.streams[0].sample_rate, '48000')
      assert.ok(Number(info.format.start_time) >= 0, `${ext}: tempo negativo`)
      assert.ok(Number(info.format.duration) >= 1.3)
      assert.equal(voice.waveform.length, 64)
      assert.ok(voice.seconds >= 1)
      // Exercita a mesma criptografia/upload do envio, sem contatar pessoas ou o WhatsApp.
      let encrypted
      const message = await prepareWAMessageMedia({ audio: voice.ogg, mimetype: 'audio/ogg; codecs=opus', ptt: true, seconds: voice.seconds, waveform: voice.waveform }, {
        upload: async (path) => {
          encrypted = await readFile(path)
          return { mediaUrl: 'https://example.invalid/audio', directPath: '/audio' }
        },
      })
      const audio = message.audioMessage
      assert.equal(audio.ptt, true)
      assert.equal(Number(audio.fileLength), voice.ogg.length)
      assert.deepEqual(createHash('sha256').update(encrypted).digest(), Buffer.from(audio.fileEncSha256))
      const { iv, cipherKey, macKey } = await getMediaKeys(audio.mediaKey, 'audio')
      const cipher = encrypted.subarray(0, -10)
      assert.deepEqual(createHmac('sha256', macKey).update(iv).update(cipher).digest().subarray(0, 10), encrypted.subarray(-10))
      const decipher = createDecipheriv('aes-256-cbc', cipherKey, iv)
      const decoded = Buffer.concat([decipher.update(cipher), decipher.final()])
      assert.deepEqual(decoded, voice.ogg)
      assert.deepEqual(createHash('sha256').update(decoded).digest(), Buffer.from(audio.fileSha256))
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('arquivo inválido não vira mensagem de voz', async () => {
  assert.equal(await toVoice(Buffer.from('arquivo inválido')), undefined)
})
