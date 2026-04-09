import gtts from 'node-gtts'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { renderCard } from './card-renderer.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ffmpeg 경로: 환경변수 > 시스템 PATH (EC2에서 apt install ffmpeg 후 자동 감지)
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH)
}

// 텍스트 정제 (TTS용 — 이모지·특수문자·해시태그 제거)
function cleanForTTS(content: string): string {
  return content
    .split('\n')
    .filter(line => !line.trim().startsWith('#'))
    .join(' ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/👉|✨|😭|😔|🦪|🍫|🥛|👍|🔥|⭐/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 400) // 약 30~40초 분량
}

// TTS: 텍스트 → MP3
async function generateAudio(text: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tts = (gtts as any)('ko')
    tts.save(outputPath, text, (err: any) => {
      if (err) reject(new Error(`TTS 생성 실패: ${err}`))
      else {
        console.log(`[VideoGenerator] 오디오 생성 완료 → ${outputPath}`)
        resolve()
      }
    })
  })
}

// 이미지 + 오디오 → MP4 (세로형 1080×1920)
async function combineToVideo(
  imagePath: string,
  audioPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(imagePath)
      .inputOptions(['-loop 1', '-framerate 1'])
      .input(audioPath)
      .outputOptions([
        '-c:v libx264',
        '-tune stillimage',
        '-c:a aac',
        '-b:a 192k',
        '-pix_fmt yuv420p',
        '-shortest',
        // 1080×1920 비율 유지하며 패딩
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black',
      ])
      .output(outputPath)
      .on('end', () => {
        console.log(`[VideoGenerator] 영상 생성 완료 → ${outputPath}`)
        resolve()
      })
      .on('error', (err) => reject(new Error(`ffmpeg 오류: ${err.message}`)))
      .run()
  })
}

// 전체 파이프라인: 콘텐츠 → 카드 이미지 + TTS → MP4
export async function generateVideo(content: string, outputVideoPath: string): Promise<void> {
  const imagePath = path.join(__dirname, 'video-card.png')
  const audioPath = path.join(__dirname, 'video-audio.mp3')

  try {
    // 1. 세로형 카드 이미지 생성
    await renderCard(content, imagePath, 'portrait')

    // 2. TTS 오디오 생성
    const ttsText = cleanForTTS(content)
    console.log('[VideoGenerator] TTS 텍스트:', ttsText.slice(0, 80), '...')
    await generateAudio(ttsText, audioPath)

    // 3. 이미지 + 오디오 → MP4
    await combineToVideo(imagePath, audioPath, outputVideoPath)
  } finally {
    // 임시 파일 정리
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath)
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath)
  }
}
