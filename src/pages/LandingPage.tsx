export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080206] flex flex-col items-center justify-center px-6 text-white relative overflow-hidden">
      {/* 배경 글로우 */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-pink-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[60%] bg-rose-900/15 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center max-w-sm w-full">
        {/* 앱 아이콘 */}
        <img
          src="/icon-512.png"
          alt="홀시"
          className="w-24 h-24 rounded-3xl shadow-2xl mb-6"
        />

        {/* 타이틀 */}
        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">홀시</h1>
        <p className="text-[#FF2A7A] font-semibold text-sm mb-3">treat yourself</p>
        <p className="text-zinc-400 text-center text-sm leading-relaxed mb-10">
          주기를 알면 몸이 보여.<br />
          생리 주기 · 영양제 알림 · AI 상담을<br />
          하나의 앱에서 관리하세요.
        </p>

        {/* 다운로드 버튼 */}
        <div className="flex flex-col gap-3 w-full">
          <a
            href="https://apps.apple.com/kr/app/id6762106047"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 bg-white text-black font-semibold py-4 rounded-2xl shadow-lg hover:bg-zinc-100 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-black">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            App Store에서 다운로드
          </a>

          <a
            href="https://play.google.com/store/apps/details?id=com.holsi.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 bg-[#FF2A7A] text-white font-semibold py-4 rounded-2xl shadow-lg hover:bg-[#e0236a] transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
              <path d="M3.18 23.76c.3.17.64.22.99.14l12.47-7.18-2.79-2.79-10.67 9.83zm-1.7-20.1C1.18 4 1 4.5 1 5.14v13.72c0 .64.18 1.14.49 1.48l.08.07 7.69-7.69v-.18L1.56 3.59l-.08.07zm18.52 8.29-2.67-1.54-3.02 3.02 3.02 3.02 2.68-1.55c.76-.44.76-1.51-.01-1.95zM4.17.5L16.64 7.68l-2.79 2.79L3.18.64C3.5.46 3.87.4 4.17.5z" />
            </svg>
            Google Play에서 다운로드
          </a>
        </div>

        {/* 하단 링크 */}
        <div className="flex gap-4 mt-10 text-xs text-zinc-600">
          <a href="/privacy" className="hover:text-zinc-400 transition-colors">개인정보처리방침</a>
        </div>
      </div>
    </div>
  )
}
