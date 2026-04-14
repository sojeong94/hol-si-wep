import { useState, useEffect, useCallback } from 'react'
import { Plus, Heart, Clock } from 'lucide-react'
import { Card } from '@/components/ui/Card'

type Category = '전체' | '생리통' | 'PMS' | '임신준비' | '영양제' | '일상'
type WriteCategory = Exclude<Category, '전체'>

interface Post {
  id: string
  author: string
  category: string
  content: string
  likes: number
  liked: boolean
  createdAt: string
}

const CATEGORIES: Category[] = ['전체', '생리통', 'PMS', '임신준비', '영양제', '일상']
const WRITE_CATEGORIES: WriteCategory[] = ['생리통', 'PMS', '임신준비', '영양제', '일상']

const CATEGORY_COLORS: Record<WriteCategory, string> = {
  '생리통':  'bg-red-500/20 text-red-400',
  'PMS':    'bg-purple-500/20 text-purple-400',
  '임신준비': 'bg-green-500/20 text-green-400',
  '영양제':  'bg-blue-500/20 text-blue-400',
  '일상':   'bg-zinc-700 text-zinc-400',
}

function getDeviceId(): string {
  let id = localStorage.getItem('holsi-device-id')
  if (!id) {
    id = Math.random().toString(36).substring(2) + Date.now().toString(36)
    localStorage.setItem('holsi-device-id', id)
  }
  return id
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

export function Community() {
  const [activeCategory, setActiveCategory] = useState<Category>('전체')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [showWriteModal, setShowWriteModal] = useState(false)
  const [writeCategory, setWriteCategory] = useState<WriteCategory>('일상')
  const [writeContent, setWriteContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const deviceId = getDeviceId()

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ deviceId })
      if (activeCategory !== '전체') params.set('category', activeCategory)
      const res = await fetch(`/api/community/posts?${params}`)
      const data = await res.json()
      setPosts(data.posts ?? [])
    } catch {
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [activeCategory, deviceId])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  const handleLike = async (postId: string) => {
    try {
      const res = await fetch(`/api/community/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      })
      const data = await res.json()
      setPosts(prev =>
        prev.map(p => p.id === postId ? { ...p, likes: data.likes, liked: data.liked } : p)
      )
    } catch {}
  }

  const handleSubmit = async () => {
    if (!writeContent.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, category: writeCategory, content: writeContent.trim() }),
      })
      if (!res.ok) throw new Error()
      setWriteContent('')
      setShowWriteModal(false)
      fetchPosts()
    } catch {
      alert('게시에 실패했어요. 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-5 pb-8 space-y-5 animate-in fade-in duration-500 bg-[var(--color-secondary)] min-h-screen">
      <header className="pt-2">
        <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
          커뮤니티
        </h1>
        <p className="text-xs text-zinc-500 mt-1">익명으로 자유롭게 이야기해요</p>
      </header>

      {/* 카테고리 탭 */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
              activeCategory === cat
                ? 'bg-[var(--color-primary)] text-white shadow-[0_0_8px_rgba(255,42,122,0.4)]'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 게시글 목록 */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <p className="text-2xl mb-3">💬</p>
          <p className="text-sm font-bold text-zinc-400">아직 게시글이 없어요</p>
          <p className="text-xs mt-1">첫 번째로 이야기를 시작해보세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <Card key={post.id} className="p-4 bg-zinc-900 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-300">{post.author}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    CATEGORY_COLORS[post.category as WriteCategory] ?? 'bg-zinc-700 text-zinc-400'
                  }`}>
                    {post.category}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                  <Clock size={10} />
                  {timeAgo(post.createdAt)}
                </span>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{post.content}</p>
              <button
                onClick={() => handleLike(post.id)}
                className={`flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 ${
                  post.liked ? 'text-[var(--color-primary)]' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Heart size={14} fill={post.liked ? 'currentColor' : 'none'} />
                {post.likes}
              </button>
            </Card>
          ))}
        </div>
      )}

      {/* 글쓰기 FAB */}
      <button
        onClick={() => setShowWriteModal(true)}
        className="fixed bottom-24 right-5 w-14 h-14 bg-[var(--color-primary)] rounded-full shadow-[0_4px_20px_rgba(255,42,122,0.5)] flex items-center justify-center z-40 active:scale-95 transition-all"
      >
        <Plus size={28} className="text-white" strokeWidth={2.5} />
      </button>

      {/* 글쓰기 모달 */}
      {showWriteModal && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50"
          onClick={() => setShowWriteModal(false)}
        >
          <div
            className="w-full max-w-md mx-auto bg-zinc-900 border-t border-zinc-700 rounded-t-3xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-black text-white text-lg">글쓰기</h3>
              <button
                onClick={() => setShowWriteModal(false)}
                className="text-zinc-500 text-sm font-medium"
              >
                취소
              </button>
            </div>

            {/* 카테고리 선택 */}
            <div className="flex gap-2 flex-wrap">
              {WRITE_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setWriteCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    writeCategory === cat
                      ? 'bg-[var(--color-primary)] text-white shadow-[0_0_8px_rgba(255,42,122,0.3)]'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* 내용 입력 */}
            <textarea
              value={writeContent}
              onChange={e => setWriteContent(e.target.value.slice(0, 200))}
              placeholder="익명으로 게시됩니다. 자유롭게 이야기해요 :)"
              rows={4}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[var(--color-primary)] resize-none transition-all"
              autoFocus
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-600">{writeContent.length}/200</span>
              <button
                onClick={handleSubmit}
                disabled={!writeContent.trim() || submitting}
                className="px-6 py-2.5 bg-[var(--color-primary)] text-white text-sm font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all shadow-[0_0_12px_rgba(255,42,122,0.3)]"
              >
                {submitting ? '게시 중...' : '게시하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
