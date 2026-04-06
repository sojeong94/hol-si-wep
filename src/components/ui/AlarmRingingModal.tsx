import { useEffect, useRef } from 'react'
import { usePillStore } from '@/store/usePillStore'
import { Card } from '@/components/ui/Card'
import { BellRing, X } from 'lucide-react'

export function AlarmRingingModal() {
  const { triggerAlarm, setTriggerAlarm, pills } = usePillStore()
  const audioCtxRef = useRef<AudioContext | null>(null)
  const intervalRef = useRef<any>(null)

  useEffect(() => {
    if (triggerAlarm) {
      if (!window.AudioContext && !(window as any).webkitAudioContext) return

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioCtxRef.current = ctx

      const playTone = () => {
        if (ctx.state === 'suspended') ctx.resume()
        
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        
        osc.type = 'sine'
        // 부드러운 알람 소리 (마림바/전자벨 느낌)
        osc.frequency.setValueAtTime(880, ctx.currentTime) // A5
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3) // drop to A4
        
        gain.gain.setValueAtTime(0, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
        
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.6)
      }

      // 두 번 울리고 쉬는 패턴
      const playPattern = () => {
        playTone()
        setTimeout(playTone, 200)
      }

      playPattern()
      intervalRef.current = setInterval(playPattern, 1200)

      return () => {
        clearInterval(intervalRef.current)
        if (audioCtxRef.current) {
          audioCtxRef.current.close().catch(() => {})
        }
      }
    }
  }, [triggerAlarm])

  if (!triggerAlarm) return null

  const pill = pills.find(p => p.id === triggerAlarm)
  if (!pill) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <Card className="w-full max-w-sm p-8 flex flex-col items-center text-center bg-zinc-950 border border-zinc-800 shadow-2xl animate-in zoom-in-95 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-600 via-[var(--color-primary)] to-pink-400 animate-pulse"></div>

        <div className="w-20 h-20 bg-pink-500/10 border border-pink-500/20 rounded-full flex items-center justify-center mb-6 animate-[bounce_1.2s_infinite]">
          <BellRing size={40} className="text-[var(--color-primary)]" />
        </div>

        <h2 className="text-3xl font-bold text-white mb-2">알람 시간!</h2>
        <p className="text-zinc-400 font-medium mb-8">
          잊지 말고 <span className="font-bold text-[var(--color-primary)]">{pill.name}</span> 챙겨요.
        </p>

        <button
          onClick={() => setTriggerAlarm(null)}
          className="w-full h-14 bg-[var(--color-primary)] text-white font-bold text-lg rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,42,122,0.4)]"
        >
          <X size={20} strokeWidth={3} /> 알람 끄기
        </button>
      </Card>
    </div>
  )
}
