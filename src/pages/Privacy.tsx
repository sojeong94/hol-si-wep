export default function Privacy() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px', color: '#e5e5e5', fontFamily: 'sans-serif', lineHeight: 1.8, background: '#000', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>개인정보처리방침</h1>
      <p style={{ color: '#888', marginBottom: 40 }}>최종 수정일: 2025년 4월 13일</p>

      <p>홀시(Holsi, 이하 "서비스")는 이용자의 개인정보를 중요하게 여기며, 아래와 같이 개인정보처리방침을 안내합니다.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 36, marginBottom: 12 }}>1. 수집하는 개인정보 항목</h2>
      <p>서비스는 다음과 같은 정보를 수집합니다.</p>
      <ul style={{ paddingLeft: 20 }}>
        <li>소셜 로그인(카카오, Google) 이용 시: 이메일 주소, 닉네임, 프로필 이미지</li>
        <li>서비스 이용 시 기기 내 로컬 저장: 생리 기록 날짜, 알람 설정, 닉네임</li>
        <li>자동 수집: 앱 버전, 기기 OS 버전 (오류 분석 목적)</li>
      </ul>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 36, marginBottom: 12 }}>2. 개인정보 수집·이용 목적</h2>
      <ul style={{ paddingLeft: 20 }}>
        <li>생리 주기 예측 및 건강 정보 제공</li>
        <li>영양제·약 복용 알람 서비스 제공</li>
        <li>소셜 로그인을 통한 데이터 백업 및 복원</li>
        <li>서비스 개선 및 오류 분석</li>
      </ul>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 36, marginBottom: 12 }}>3. 개인정보 보유 및 이용 기간</h2>
      <p>이용자가 서비스 탈퇴 또는 데이터 삭제를 요청할 때까지 보유합니다. 생리 기록 등 건강 데이터는 기기 내 로컬 저장소에만 보관되며 서버로 전송되지 않습니다.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 36, marginBottom: 12 }}>4. 개인정보 제3자 제공</h2>
      <p>서비스는 이용자의 동의 없이 개인정보를 외부에 제공하지 않습니다. 단, 소셜 로그인 제공자(카카오, Google)의 정책에 따라 최소한의 인증 정보가 처리됩니다.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 36, marginBottom: 12 }}>5. 이용자의 권리</h2>
      <ul style={{ paddingLeft: 20 }}>
        <li>언제든지 마이페이지에서 닉네임 및 설정을 수정·삭제할 수 있습니다.</li>
        <li>소셜 계정 연동을 해제하면 관련 정보가 삭제됩니다.</li>
        <li>개인정보 삭제 요청: 아래 이메일로 문의하세요.</li>
      </ul>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 36, marginBottom: 12 }}>6. 건강 데이터 보호</h2>
      <p>생리 기록, 주기 데이터 등 민감한 건강 정보는 이용자의 기기 내 로컬 저장소에만 저장됩니다. 서버에 업로드되지 않으며, 제3자와 공유되지 않습니다.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 36, marginBottom: 12 }}>7. 보안</h2>
      <p>서비스는 HTTPS를 통해 모든 통신을 암호화합니다. 서버에 저장되는 데이터는 최소화하며 접근을 제한합니다.</p>

      <h2 style={{ fontSize: 18, fontWeight: 600, marginTop: 36, marginBottom: 12 }}>8. 문의</h2>
      <p>개인정보 관련 문의사항은 아래로 연락해 주세요.</p>
      <ul style={{ paddingLeft: 20 }}>
        <li>서비스명: 홀시(Holsi)</li>
        <li>이메일: organic_biz@organic-business.co.kr</li>
        <li>웹사이트: https://hol-si.com</li>
      </ul>

      <p style={{ marginTop: 48, color: '#666', fontSize: 14 }}>본 방침은 서비스 정책 변경 시 앱 내 공지 또는 본 페이지를 통해 안내됩니다.</p>
    </div>
  )
}
