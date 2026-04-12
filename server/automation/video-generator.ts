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

// TTS: 텍스트 → MP3 (node-gtts — API 키 불필요, 한국어)
async function generateAudio(text: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tts = gtts('ko')
    tts.save(outputPath, text, (err: Error | null) => {
      if (err) return reject(new Error(`TTS 오류: ${err.message}`))
      console.log(`[VideoGenerator] 오디오 생성 완료 → ${outputPath}`)
      resolve()
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

// ── 단일 카드 → MP4 (기존, 개별 테스트용) ────────────────────────────────────
export async function generateVideo(content: string, outputVideoPath: string): Promise<void> {
  const baseName = path.basename(outputVideoPath, path.extname(outputVideoPath))
  const imagePath = path.join(__dirname, `temp-${baseName}-card.png`)
  const audioPath = path.join(__dirname, `temp-${baseName}-audio.mp3`)

  try {
    await renderCard(content, imagePath, 'portrait')
    const ttsText = cleanForTTS(content)
    console.log('[VideoGenerator] TTS 텍스트:', ttsText.slice(0, 80), '...')
    await generateAudio(ttsText, audioPath)
    await combineToVideo(imagePath, audioPath, outputVideoPath)
  } finally {
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath)
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath)
  }
}

// ── Instagram 4장 카드 → 슬라이드쇼 MP4 (TikTok / YouTube Shorts 공용) ────────
// cardPaths: 4장 카드 이미지 경로 (renderInstagramCards 결과)
// content: TTS 낭독용 텍스트 (instagram content 재사용)
export async function generateVideoFromCards(
  cardPaths: string[],
  content: string,
  outputVideoPath: string
): Promise<void> {
  const audioPath = outputVideoPath.replace(/\.mp4$/, '-audio.mp3')
  const listPath  = outputVideoPath + '.txt'
  const SECS_PER_CARD = 7  // 장당 표시 시간 (총 28초 → -shortest로 TTS 길이에 맞춤)

  try {
    // 1. TTS 오디오 생성 (instagram 콘텐츠 재사용)
    const ttsText = cleanForTTS(content)
    console.log('[VideoGenerator] 슬라이드쇼 TTS:', ttsText.slice(0, 80), '...')
    await generateAudio(ttsText, audioPath)

    // 2. ffmpeg concat 목록 파일 생성
    // Windows 경로 → forward slash 변환 (ffmpeg 요구사항)
    const toFfmpegPath = (p: string) => p.replace(/\\/g, '/')
    const listLines = cardPaths.flatMap(p => [
      `file '${toFfmpegPath(p)}'`,
      `duration ${SECS_PER_CARD}`,
    ])
    // 마지막 카드 한 번 더 추가 (ffmpeg concat duration 버그 방지)
    listLines.push(`file '${toFfmpegPath(cardPaths[cardPaths.length - 1])}'`)
    fs.writeFileSync(listPath, listLines.join('\n'), 'utf-8')

    // 3. concat(4장 슬라이드쇼) + TTS 오디오 → 세로형 1080×1920 MP4
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(listPath).inputOptions(['-f concat', '-safe 0'])
        .input(audioPath)
        .outputOptions([
          '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black',
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-pix_fmt', 'yuv420p',
          '-shortest',
        ])
        .output(outputVideoPath)
        .on('end', () => {
          console.log(`[VideoGenerator] 슬라이드쇼 영상 완성 → ${outputVideoPath}`)
          resolve()
        })
        .on('error', (err) => reject(new Error(`ffmpeg 슬라이드쇼 오류: ${err.message}`)))
        .run()
    })
  } finally {
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath)
    if (fs.existsSync(listPath))  fs.unlinkSync(listPath)
  }
}
