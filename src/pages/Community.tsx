import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Heart, Clock, MessageCircle, ArrowLeft, Send, Flag, X } from 'lucide-react'
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
  commentCount: number
  createdAt: string
}

interface Comment {
  id: string
  author: string
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

const REPORT_REASONS = ['음란물·성적 콘텐츠', '욕설·비방·혐오', '스팸·광고', '개인정보 노출', '기타 부적절한 내용']

function getBlockedAuthors(): Set<string> {
  try {
    const raw = localStorage.getItem('holsi-blocked-authors')
    return new Set(raw ? JSON.parse(raw) : [])
  } catch { return new Set() }
}

function blockAuthor(author: string) {
  const blocked = getBlockedAuthors()
  blocked.add(author)
  localStorage.setItem('holsi-blocked-authors', JSON.stringify([...blocked]))
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
  const [agreed, setAgreed] = useState(() => localStorage.getItem('holsi-community-agreed') === 'true')
  const [activeCategory, setActiveCategory] = useState<Category>('전체')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [showWriteModal, setShowWriteModal] = useState(false)
  const [writeCategory, setWriteCategory] = useState<WriteCategory>('일상')
  const [writeContent, setWriteContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [blockedAuthors, setBlockedAuthors] = useState<Set<string>>(getBlockedAuthors)

  // 신고 모달
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'comment'; id: string; author: string } | null>(null)

  // 댓글 상세
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentInput, setCommentInput] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const commentInputRef = useRef<HTMLInputElement>(null)

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

  const fetchComments = useCallback(async (postId: string) => {
    setCommentsLoading(true)
    try {
      const res = await fetch(`/api/community/posts/${postId}/comments?deviceId=${deviceId}`)
      const data = await res.json()
      setComments(data.comments ?? [])
    } catch {
      setComments([])
    } finally {
      setCommentsLoading(false)
    }
  }, [deviceId])

  const openPost = (post: Post) => {
    setSelectedPost(post)
    setComments([])
    setCommentInput('')
    fetchComments(post.id)
  }

  const closePost = () => {
    setSelectedPost(null)
    setComments([])
    setCommentInput('')
  }

  const handleLike = async (postId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
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
      if (selectedPost?.id === postId) {
        setSelectedPost(prev => prev ? { ...prev, likes: data.likes, liked: data.liked } : prev)
      }
    } catch {}
  }

  const handleCommentLike = async (commentId: string) => {
    try {
      const res = await fetch(`/api/community/comments/${commentId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      })
      const data = await res.json()
      setComments(prev =>
        prev.map(c => c.id === commentId ? { ...c, likes: data.likes, liked: data.liked } : c)
      )
    } catch {}
  }

  const handleCommentSubmit = async () => {
    if (!commentInput.trim() || !selectedPost) return
    setCommentSubmitting(true)
    try {
      const res = await fetch(`/api/community/posts/${selectedPost.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, content: commentInput.trim() }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setComments(prev => [...prev, data.comment])
      setCommentInput('')
      // 게시글 카드 댓글 수 업데이트
      const newCount = comments.length + 1
      setPosts(prev =>
        prev.map(p => p.id === selectedPost.id ? { ...p, commentCount: newCount } : p)
      )
      setSelectedPost(prev => prev ? { ...prev, commentCount: newCount } : prev)
    } catch {
      alert('댓글 게시에 실패했어요.')
    } finally {
      setCommentSubmitting(false)
    }
  }

  const handleReport = async (reason: string) => {
    if (!reportTarget) return
    const url = reportTarget.type === 'post'
      ? `/api/community/posts/${reportTarget.id}/report`
      : `/api/community/comments/${reportTarget.id}/report`
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, reason }),
      })
    } catch {}
    setReportTarget(null)
    alert('신고가 접수되었어요. 24시간 내에 검토할게요.')
  }

  const handleBlock = (author: string) => {
    blockAuthor(author)
    setBlockedAuthors(getBlockedAuthors())
    setReportTarget(null)
    if (selectedPost?.author === author) setSelectedPost(null)
    alert(`${author}님을 차단했어요. 이 사용자의 게시글이 표시되지 않아요.`)
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

  // EULA 미동의 시 약관 화면 표시
  if (!agreed) {
    return (
      <div className="p-5 pb-8 flex flex-col min-h-screen bg-[var(--color-secondary)]">
        <header className="pt-2 mb-6">
          <h1 className="text-2xl font-black text-white tracking-tight">커뮤니티</h1>
        </header>
        <div className="flex-1 flex flex-col justify-center space-y-5">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-base font-black text-white">커뮤니티 이용 약관</h2>
            <ul className="space-y-2 text-sm text-zinc-400 leading-relaxed">
              <li>• 익명 커뮤니티로 운영되며, 모든 게시글은 공개됩니다.</li>
              <li>• 욕설, 음란물, 비방, 혐오 표현 등 부적절한 콘텐츠는 즉시 삭제되며 이용이 제한됩니다.</li>
              <li>• 타인의 개인정보를 게시하거나 불법적인 내용을 작성하는 행위는 금지됩니다.</li>
              <li>• 신고된 콘텐츠는 24시간 이내 검토 후 조치됩니다.</li>
              <li>• 부적절한 사용자는 서비스 이용이 영구 차단될 수 있습니다.</li>
            </ul>
            <p className="text-xs text-zinc-600">위 약관에 동의해야 커뮤니티를 이용할 수 있어요.</p>
          </div>
          <button
            onClick={() => { localStorage.setItem('holsi-community-agreed', 'true'); setAgreed(true) }}
            className="w-full py-4 bg-[var(--color-primary)] text-white font-black rounded-2xl shadow-[0_0_15px_rgba(255,42,122,0.4)] active:scale-95 transition-all"
          >
            동의하고 커뮤니티 입장하기
          </button>
        </div>
      </div>
    )
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
          {posts.filter(p => !blockedAuthors.has(p.author)).map(post => (
            <Card
              key={post.id}
              className="p-4 bg-zinc-900 border border-zinc-800 space-y-3 cursor-pointer active:scale-[0.97] active:opacity-80 transition-all"
              onClick={() => openPost(post)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-300">{post.author}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    CATEGORY_COLORS[post.category as WriteCategory] ?? 'bg-zinc-700 text-zinc-400'
                  }`}>
                    {post.category}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                    <Clock size={10} />
                    {timeAgo(post.createdAt)}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setReportTarget({ type: 'post', id: post.id, author: post.author }) }}
                    className="text-zinc-400 hover:text-zinc-200 active:scale-90 transition-all p-1"
                  >
                    <Flag size={12} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap line-clamp-3">{post.content}</p>
              <div className="flex items-center gap-4">
                <button
                  onClick={(e) => handleLike(post.id, e)}
                  className={`flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 ${
                    post.liked ? 'text-[var(--color-primary)]' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Heart size={14} fill={post.liked ? 'currentColor' : 'none'} />
                  {post.likes}
                </button>
                <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <MessageCircle size={14} />
                  {post.commentCount}
                </span>
              </div>
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
              <button onClick={() => setShowWriteModal(false)} className="text-zinc-500 text-sm font-medium">
                취소
              </button>
            </div>
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

      {/* 신고 모달 */}
      {reportTarget && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/60" onClick={() => setReportTarget(null)}>
          <div className="w-full max-w-md mx-auto bg-zinc-900 border-t border-zinc-700 rounded-t-3xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-black text-white text-base">신고 사유 선택</h3>
              <button onClick={() => setReportTarget(null)} className="text-zinc-500 active:scale-90 transition-all">
                <X size={20} />
              </button>
            </div>
            {REPORT_REASONS.map(reason => (
              <button
                key={reason}
                onClick={() => handleReport(reason)}
                className="w-full text-left px-4 py-3 bg-zinc-800 rounded-xl text-sm text-zinc-300 font-medium active:bg-zinc-700 transition-all"
              >
                {reason}
              </button>
            ))}
            <div className="h-px bg-zinc-800 my-1" />
            <button
              onClick={() => handleBlock(reportTarget.author)}
              className="w-full text-left px-4 py-3 bg-red-950/40 border border-red-900/40 rounded-xl text-sm text-red-400 font-bold active:bg-red-950/70 transition-all"
            >
              이 사용자 차단하기
            </button>
          </div>
        </div>
      )}

      {/* 게시글 상세 + 댓글 오버레이 */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0A] flex flex-col animate-in slide-in-from-bottom duration-300">
          {/* 헤더 */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800 flex-shrink-0">
            <button
              onClick={closePost}
              className="text-zinc-400 active:scale-90 transition-all"
            >
              <ArrowLeft size={22} />
            </button>
            <span className="text-white font-bold text-base">댓글</span>
          </div>

          {/* 스크롤 영역 */}
          <div className="flex-1 overflow-y-auto pb-2">
            {/* 원본 게시글 */}
            <div className="px-5 py-4 border-b border-zinc-800/60">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {selectedPost.author.charAt(0)}
                </div>
                <div>
                  <span className="text-xs font-bold text-zinc-200">{selectedPost.author}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      CATEGORY_COLORS[selectedPost.category as WriteCategory] ?? 'bg-zinc-700 text-zinc-400'
                    }`}>
                      {selectedPost.category}
                    </span>
                    <span className="text-[10px] text-zinc-600">{timeAgo(selectedPost.createdAt)}</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap ml-10">{selectedPost.content}</p>
              <div className="flex items-center gap-4 mt-3 ml-10">
                <button
                  onClick={() => handleLike(selectedPost.id)}
                  className={`flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 ${
                    selectedPost.liked ? 'text-[var(--color-primary)]' : 'text-zinc-500'
                  }`}
                >
                  <Heart size={14} fill={selectedPost.liked ? 'currentColor' : 'none'} />
                  {selectedPost.likes}
                </button>
                <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <MessageCircle size={14} />
                  {selectedPost.commentCount}
                </span>
              </div>
            </div>

            {/* 댓글 목록 */}
            {commentsLoading ? (
              <div className="flex justify-center py-10">
                <div className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-10 text-zinc-600">
                <p className="text-sm">첫 번째 댓글을 남겨보세요</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {comments.map(comment => (
                  <div key={comment.id} className="px-5 py-4">
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300 text-xs font-bold flex-shrink-0 mt-0.5">
                        {comment.author.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-zinc-300">{comment.author}</span>
                          <span className="text-[10px] text-zinc-600">{timeAgo(comment.createdAt)}</span>
                        </div>
                        <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <button
                            onClick={() => handleCommentLike(comment.id)}
                            className={`flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 ${
                              comment.liked ? 'text-[var(--color-primary)]' : 'text-zinc-600'
                            }`}
                          >
                            <Heart size={12} fill={comment.liked ? 'currentColor' : 'none'} />
                            {comment.likes > 0 && comment.likes}
                          </button>
                          <button
                            onClick={() => setReportTarget({ type: 'comment', id: comment.id, author: comment.author })}
                            className="text-zinc-400 hover:text-zinc-200 active:scale-90 transition-all"
                          >
                            <Flag size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 댓글 입력창 */}
          <div className="flex-shrink-0 border-t border-zinc-800 px-4 py-3 flex items-center gap-3 bg-zinc-950">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500/40 to-purple-600/40 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              나
            </div>
            <input
              ref={commentInputRef}
              type="text"
              value={commentInput}
              onChange={e => setCommentInput(e.target.value.slice(0, 200))}
              placeholder="댓글 달기..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-full px-4 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[var(--color-primary)] transition-all"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCommentSubmit() }}}
            />
            <button
              onClick={handleCommentSubmit}
              disabled={!commentInput.trim() || commentSubmitting}
              className="text-[var(--color-primary)] disabled:opacity-30 active:scale-90 transition-all"
            >
              <Send size={20} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
