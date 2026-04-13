import { useState, useEffect } from 'react'
import { Shield, Users, Database, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'

interface UserRow {
  id: string
  email: string | null
  name: string | null
  avatar: string | null
  provider: string
  createdAt: string
  lastLoginAt: string
  userData?: {
    pillsData?: string | null
    recordsData?: string | null
    settingsData?: string | null
    updatedAt: string
  } | null
}

export function Admin() {
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const fetchUsers = async (s: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/admin/users', {
        headers: { 'x-admin-secret': s },
      })
      if (res.status === 403) { setError('비밀번호가 올바르지 않습니다.'); return }
      const data = await res.json() as UserRow[]
      setUsers(data)
      setAuthed(true)
    } catch {
      setError('서버 연결 실패')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authed) fetchUsers(secret)
  }, [])

  if (!authed) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <div className="flex items-center gap-2 text-white mb-6">
            <Shield size={28} className="text-pink-500" />
            <h1 className="text-2xl font-black">홀시 Admin</h1>
          </div>
          <input
            type="password"
            placeholder="관리자 비밀번호"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchUsers(secret)}
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={() => fetchUsers(secret)}
            disabled={loading}
            className="w-full bg-pink-600 text-white font-bold h-12 rounded-xl hover:bg-pink-500 disabled:opacity-50 transition-colors"
          >
            {loading ? '확인 중...' : '접속'}
          </button>
        </div>
      </div>
    )
  }

  const pillCount = (u: UserRow) => {
    if (!u.userData?.pillsData) return 0
    try { return (JSON.parse(u.userData.pillsData)?.state?.pills ?? []).length } catch { return 0 }
  }
  const recordCount = (u: UserRow) => {
    if (!u.userData?.recordsData) return 0
    try { return (JSON.parse(u.userData.recordsData)?.state?.records ?? []).length } catch { return 0 }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-5">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Shield size={24} className="text-pink-500" />
          <h1 className="text-xl font-black">홀시 Admin 패널</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-sm text-zinc-400">
            <Users size={14} />
            <span>{users.length}명</span>
          </div>
          <button
            onClick={() => fetchUsers(secret)}
            className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-pink-400">{users.length}</p>
          <p className="text-xs text-zinc-500 mt-1">총 사용자</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-blue-400">{users.filter(u => u.provider === 'google').length}</p>
          <p className="text-xs text-zinc-500 mt-1">Google</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-yellow-400">{users.filter(u => u.provider === 'kakao').length}</p>
          <p className="text-xs text-zinc-500 mt-1">Kakao</p>
        </div>
      </div>

      {/* 사용자 목록 */}
      <div className="space-y-3">
        {users.map(user => (
          <div key={user.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-800 transition-colors"
              onClick={() => setExpanded(expanded === user.id ? null : user.id)}
            >
              <div className="flex items-center gap-3">
                {user.avatar
                  ? <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                  : <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold">
                      {user.name?.[0] ?? '?'}
                    </div>
                }
                <div>
                  <p className="font-bold text-white">{user.name ?? '이름 없음'}</p>
                  <p className="text-xs text-zinc-500">{user.email ?? '이메일 없음'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                  user.provider === 'google' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {user.provider}
                </span>
                {expanded === user.id ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
              </div>
            </button>

            {expanded === user.id && (
              <div className="border-t border-zinc-800 p-4 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-800 rounded-lg p-3">
                    <p className="text-xs text-zinc-500 mb-1">가입일</p>
                    <p className="font-medium">{new Date(user.createdAt).toLocaleDateString('ko')}</p>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-3">
                    <p className="text-xs text-zinc-500 mb-1">마지막 로그인</p>
                    <p className="font-medium">{new Date(user.lastLoginAt).toLocaleDateString('ko')}</p>
                  </div>
                </div>

                {user.userData && (
                  <div className="bg-zinc-800 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-1 text-zinc-400 mb-2">
                      <Database size={12} />
                      <span className="text-xs font-bold">동기화 데이터</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-zinc-500">영양제</span>
                        <span className="ml-2 text-pink-400 font-bold">{pillCount(user)}개</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">생리 기록</span>
                        <span className="ml-2 text-pink-400 font-bold">{recordCount(user)}개</span>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-600">
                      마지막 동기화: {new Date(user.userData.updatedAt).toLocaleString('ko')}
                    </p>
                  </div>
                )}

                <p className="text-xs text-zinc-700 font-mono">ID: {user.id}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
