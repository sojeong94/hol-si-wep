import { useState, useRef } from 'react'
import { Modal } from './Modal'
import { Camera, Image as ImageIcon, Loader2, Sparkles } from 'lucide-react'

interface OCRScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScanResult: (text: string) => void
  mode?: 'pill' | 'period'
  description?: string
}

/** 이미지를 최대 1024px로 리사이즈 후 base64 반환 (API 용량 제한 대비) */
async function compressImage(file: File, maxPx = 1024): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('canvas 2d context 를 가져올 수 없어요.'))
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이미지를 불러올 수 없어요. 손상되었거나 지원하지 않는 형식일 수 있어요.'))
    }
    img.src = url
  })
}

export function OCRScannerModal({
  isOpen,
  onClose,
  onScanResult,
  mode = 'pill',
  description = '영양제 라벨이나 패키지 사진을 올려주세요.',
}: OCRScannerModalProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsScanning(true)
    setErrorMsg(null)

    try {
      // 1) 이미지 압축
      let base64: string
      let mimeType: string
      try {
        const compressed = await compressImage(file)
        base64 = compressed.base64
        mimeType = compressed.mimeType
      } catch (err) {
        console.error('[OCR] compress error:', err)
        setErrorMsg('이미지를 처리하지 못했어요. 다른 사진으로 시도해주세요.')
        return
      }

      // 2) 서버 요청 (30초 타임아웃)
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), 30_000)
      let res: Response
      try {
        res = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType, mode }),
          signal: controller.signal,
        })
      } catch (err) {
        console.error('[OCR] fetch error:', err)
        if ((err as Error)?.name === 'AbortError') {
          setErrorMsg('응답이 너무 오래 걸려요. 잠시 후 다시 시도해주세요.')
        } else {
          setErrorMsg('서버에 연결할 수 없어요. 백엔드(3001)가 실행 중인지 확인해주세요.')
        }
        return
      } finally {
        window.clearTimeout(timeoutId)
      }

      // 3) 응답 본문 파싱 (JSON 가드)
      const rawText = await res.text()
      const contentType = res.headers.get('content-type') ?? ''
      let data: { result?: unknown; raw?: string; error?: string; detail?: string } = {}
      if (contentType.includes('application/json')) {
        try {
          data = JSON.parse(rawText)
        } catch {
          console.error('[OCR] invalid JSON response:', rawText.slice(0, 200))
        }
      } else {
        console.error('[OCR] non-JSON response:', rawText.slice(0, 200))
      }

      if (!res.ok) {
        setErrorMsg(data.error ?? `서버 오류 (${res.status})`)
        return
      }

      // result 또는 raw 중 하나라도 있으면 Calendar/Pills에서 처리
      const resultText =
        data.result != null
          ? (typeof data.result === 'string' ? data.result : JSON.stringify(data.result))
          : (data.raw ?? '')

      if (!resultText) {
        setErrorMsg('AI가 이미지에서 아무것도 읽지 못했어요. 텍스트가 더 잘 보이는 사진을 시도해주세요.')
        return
      }

      onScanResult(resultText)
      onClose()
    } finally {
      setIsScanning(false)
      if (galleryInputRef.current) galleryInputRef.current.value = ''
      if (cameraInputRef.current) cameraInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    setErrorMsg(null)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="AI 이미지 인식">
      <div className="space-y-5 flex flex-col items-center">
        <div className="flex items-center gap-2 text-sm text-zinc-400 font-medium text-center">
          <Sparkles size={14} className="text-pink-400 shrink-0" />
          <p>{description}</p>
        </div>

        {errorMsg && (
          <div className="w-full bg-red-950/50 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300 font-medium">
            {errorMsg}
          </div>
        )}

        {/* 갤러리 전용 input */}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={galleryInputRef}
          onChange={handleFileChange}
        />
        {/* 카메라 전용 input — capture 속성을 정적으로 선언하여 동적 조작 크래시 방지 */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          ref={cameraInputRef}
          onChange={handleFileChange}
        />

        {isScanning ? (
          <div className="flex flex-col items-center justify-center p-8 w-full bg-zinc-900 rounded-2xl border border-zinc-800">
            <Loader2 className="w-10 h-10 text-pink-500 animate-spin mb-3" />
            <p className="font-bold text-zinc-200 animate-pulse">AI가 열심히 읽고 있어요!</p>
            <p className="text-xs text-zinc-500 mt-1">Claude Vision 분석 중...</p>
          </div>
        ) : (
          <div className="flex gap-4 w-full">
            <button
              onClick={() => { setErrorMsg(null); galleryInputRef.current?.click() }}
              className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-900 border-2 border-dashed border-zinc-700 rounded-xl hover:border-pink-500/50 hover:bg-zinc-800 transition-colors active:scale-95 group"
            >
              <ImageIcon className="w-8 h-8 text-zinc-400 mb-2 group-hover:text-pink-400 transition-colors" />
              <span className="font-bold text-zinc-300 text-sm">갤러리에서 선택</span>
            </button>
            <button
              onClick={() => { setErrorMsg(null); cameraInputRef.current?.click() }}
              className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-900 border-2 border-dashed border-zinc-700 rounded-xl hover:border-pink-500/50 hover:bg-zinc-800 transition-colors active:scale-95 group"
            >
              <Camera className="w-8 h-8 text-zinc-400 mb-2 group-hover:text-pink-400 transition-colors" />
              <span className="font-bold text-zinc-300 text-sm">카메라로 촬영</span>
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
