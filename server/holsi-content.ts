// 홀시 참견 고정 멘트 풀 — AI 호출 없이 주기 단계별 랜덤 선택
// 각 entry의 advice는 __NICK__ 을 런타임에 닉네임으로 치환

export interface Recommendation {
  name: string
  reason: string
  cta: string
  keyword: string
}

interface HolsiEntry {
  advice: string
  recommendations: Recommendation[]
}

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const phases: Record<string, HolsiEntry[]> = {
  none: [
    {
      advice: "__NICK__아, 오늘도 나를 챙겨보자\n지금 필요한 건 바로 이거야",
      recommendations: [
        { name: "장건강 유산균", reason: "면역부터 챙겨야 나머지도 챙겨짐", cta: "최저가 확인", keyword: "여성 유산균" },
      ],
    },
    {
      advice: "__NICK__, 주기 기록 시작해봐\n몸이 먼저 알고 있거든",
      recommendations: [
        { name: "긴장완화 마그네슘", reason: "오늘 피곤하면 얘부터", cta: "핫딜 보기", keyword: "마그네슘 영양제" },
      ],
    },
    {
      advice: "__NICK__, 그냥 챙겨주는 거야\n딱 오늘만 허락할게",
      recommendations: [
        { name: "장건강 유산균", reason: "하루 한 알, 2주면 체감", cta: "바로 가기", keyword: "여성 유산균 추천" },
        { name: "긴장완화 마그네슘", reason: "몸이 굳어있을 때 딱임", cta: "최저가 확인", keyword: "마그네슘 영양제" },
      ],
    },
  ],
  menstrual: [
    {
      advice: "__NICK__야 많이 아파?\n핫팩이 최선이야 지금은",
      recommendations: [
        { name: "배따뜻 핫팩", reason: "지금 배 위에 얹으면 즉각 진정", cta: "지금 주문", keyword: "생리통 핫팩" },
        { name: "철분 보충제", reason: "생리 중엔 철분이 빠져나가거든", cta: "최저가 확인", keyword: "여성 철분제" },
      ],
    },
    {
      advice: "__NICK__아, 쉬어도 돼 오늘은\n따뜻한 거 하나 챙겨",
      recommendations: [
        { name: "속편한 생강차", reason: "위장이 약해지는 시기에 딱", cta: "바로 가기", keyword: "생강차 생리통" },
      ],
    },
    {
      advice: "__NICK__, 내가 시키는 거 아니야\n그냥 핫팩 하나 올려줘",
      recommendations: [
        { name: "배따뜻 핫팩", reason: "지금 배 위에 얹으면 즉각 진정", cta: "끝딜 잡기", keyword: "생리 핫팩 붙이는" },
        { name: "진통 타이레놀", reason: "생리통엔 이게 최선임", cta: "핫딜 보기", keyword: "타이레놀 생리통" },
      ],
    },
    {
      advice: "__NICK__야 이틀은 버텨\n이런 날엔 이거 챙겨",
      recommendations: [
        { name: "철분 보충제", reason: "혈액 손실 보충 필수", cta: "최저가 확인", keyword: "철분제 여성" },
      ],
    },
    {
      advice: "__NICK__아 밥은 먹었어?\n따뜻한 거 위에 올려줘",
      recommendations: [
        { name: "배따뜻 핫팩", reason: "통증보다 온도가 먼저야", cta: "지금 주문", keyword: "생리 복부 핫팩" },
        { name: "속편한 생강차", reason: "소화도 잘 안될 시기잖아", cta: "바로 가기", keyword: "생강차 따뜻한" },
      ],
    },
  ],
  dday: [
    {
      advice: "__NICK__아, 드디어 왔네\n오늘은 그냥 쉬어도 돼",
      recommendations: [
        { name: "배따뜻 핫팩", reason: "첫날이 제일 힘들잖아", cta: "지금 주문", keyword: "생리 핫팩" },
      ],
    },
    {
      advice: "__NICK__, D-DAY 왔다\n따뜻하게만 있어",
      recommendations: [
        { name: "진통 타이레놀", reason: "시작부터 잡아줘야 돼", cta: "핫딜 보기", keyword: "생리통 진통제" },
        { name: "배따뜻 핫팩", reason: "지금 이게 최선이야", cta: "바로 가기", keyword: "생리 핫팩 붙이는" },
      ],
    },
    {
      advice: "__NICK__야 드디어구나\n내가 시키는 거 아니야 그냥 쉬어",
      recommendations: [
        { name: "배따뜻 핫팩", reason: "첫날은 온기가 답이야", cta: "끝딜 잡기", keyword: "생리통 핫팩" },
      ],
    },
  ],
  imminent: [
    {
      advice: "__NICK__, 슬슬 예민해질 시간\n지금 몸이 필요한 거 챙겨",
      recommendations: [
        { name: "PMS 진정 마그네슘", reason: "예민함 잡는 데 이게 최고야", cta: "최저가 확인", keyword: "마그네슘 PMS" },
        { name: "달맞이꽃 종자유", reason: "생리 전 통증 완화에 진짜 좋음", cta: "핫딜 보기", keyword: "달맞이꽃종자유" },
      ],
    },
    {
      advice: "__NICK__야 배 아프기 전에\n미리 챙겨둬",
      recommendations: [
        { name: "PMS 진정 마그네슘", reason: "딱 3일 전부터 먹으면 달라", cta: "끝딜 잡기", keyword: "마그네슘 생리전증후군" },
      ],
    },
    {
      advice: "__NICK__아 이번엔 미리 챙겨\n나중에 후회하지 말고",
      recommendations: [
        { name: "달맞이꽃 종자유", reason: "호르몬 균형에 도움", cta: "바로 가기", keyword: "달맞이꽃종자유 효능" },
        { name: "수분폭탄 코코넛워터", reason: "부종 빠지는 데 최고임", cta: "오늘만 이가격", keyword: "코코넛워터 생리전" },
      ],
    },
    {
      advice: "__NICK__야 곧 온다\n지금 미리 뭐라도 챙겨",
      recommendations: [
        { name: "PMS 진정 마그네슘", reason: "3일 전부터 먹으면 다음이 달라", cta: "최저가 확인", keyword: "마그네슘 PMS 여성" },
        { name: "달맞이꽃 종자유", reason: "생리통 줄이는 데 효과 있음", cta: "핫딜 보기", keyword: "달맞이꽃 생리통" },
      ],
    },
  ],
  luteal_late: [
    {
      advice: "__NICK__아 왜 이렇게 예민해\n마그네슘 한 알 먹고 시작해",
      recommendations: [
        { name: "PMS 진정 마그네슘", reason: "지금 이게 제일 필요한 거야", cta: "최저가 확인", keyword: "마그네슘 PMS" },
      ],
    },
    {
      advice: "__NICK__, 황체기 후반이잖아\n지금 챙겨둬야 이번엔 덜 힘들어",
      recommendations: [
        { name: "PMS 비타민B6", reason: "기분 안정에 진짜 효과 있음", cta: "핫딜 보기", keyword: "비타민B6 PMS" },
        { name: "PMS 진정 마그네슘", reason: "근육 이완, 통증 완화 두 마리 토끼", cta: "최저가 확인", keyword: "마그네슘 여성" },
      ],
    },
    {
      advice: "__NICK__야 당 땡기지?\n그냥 시켜. 딱 오늘만 허락할게",
      recommendations: [
        { name: "당충전 마카롱", reason: "PMS 당 떨어진 니 몸을 위한 구원템", cta: "오늘만 이가격", keyword: "마카롱 선물세트" },
        { name: "PMS 진정 마그네슘", reason: "당 올라가도 마그네슘은 챙겨", cta: "최저가 확인", keyword: "마그네슘 PMS" },
      ],
    },
    {
      advice: "__NICK__아 예민한 거 알아\n그래도 이거 하나 챙겨",
      recommendations: [
        { name: "PMS 비타민B6", reason: "세로토닌 올려주는 비타민", cta: "바로 가기", keyword: "비타민B6 여성" },
      ],
    },
  ],
  luteal_early: [
    {
      advice: "__NICK__, 지금 컨디션 괜찮지?\n이때 챙겨두면 달라",
      recommendations: [
        { name: "호르몬 이노시톨", reason: "황체기 시작할 때 먹으면 생리통이 줄어", cta: "최저가 확인", keyword: "이노시톨 여성" },
        { name: "장건강 유산균", reason: "컨디션 좋을 때 내 몸 기반 다져줘", cta: "핫딜 보기", keyword: "여성 유산균" },
      ],
    },
    {
      advice: "__NICK__아 지금이 황금 타이밍\n이노시톨 먹을 때야",
      recommendations: [
        { name: "호르몬 이노시톨", reason: "PCOS, 배란, 호르몬 다 잡는 진짜 템", cta: "끝딜 잡기", keyword: "이노시톨 효능" },
      ],
    },
    {
      advice: "__NICK__, 에너지 넘치잖아\n운동도 오늘이 타이밍이야",
      recommendations: [
        { name: "운동 전 BCAA", reason: "이 시기엔 근성장도 잘 돼", cta: "바로 가기", keyword: "BCAA 여성" },
        { name: "수분보충 코코넛워터", reason: "운동 후 전해질 보충에 딱", cta: "최저가 확인", keyword: "코코넛워터" },
      ],
    },
    {
      advice: "__NICK__아 기운 있을 때 챙겨\n이거 놓치면 아깝잖아",
      recommendations: [
        { name: "호르몬 이노시톨", reason: "황체기 초반 복용이 효과 최고", cta: "최저가 확인", keyword: "이노시톨 여성 추천" },
        { name: "장건강 유산균", reason: "면역력도 같이 올려두자", cta: "핫딜 보기", keyword: "여성 유산균 추천" },
      ],
    },
  ],
  ovulation: [
    {
      advice: "__NICK__ 지금 최고 컨디션이야\n놓치면 아깝잖아",
      recommendations: [
        { name: "피부광채 콜라겐", reason: "에스트로겐 피크 때 콜라겐 흡수 최고", cta: "최저가 확인", keyword: "저분자 콜라겐" },
        { name: "두뇌 오메가3", reason: "집중력도 이 시기에 제일 잘 올라감", cta: "핫딜 보기", keyword: "오메가3 여성" },
      ],
    },
    {
      advice: "__NICK__, 배란기잖아 지금\n몸이 최전성기라고",
      recommendations: [
        { name: "피부광채 콜라겐", reason: "지금 안 먹으면 언제 먹어", cta: "끝딜 잡기", keyword: "콜라겐 효능" },
      ],
    },
    {
      advice: "__NICK__아 이때 관리해\n진짜 눈에 띄게 달라져",
      recommendations: [
        { name: "두뇌 오메가3", reason: "배란기에 오메가3 먹으면 피부도 맑아짐", cta: "최저가 확인", keyword: "오메가3 여성" },
        { name: "피부광채 콜라겐", reason: "지금이 흡수율 제일 높을 때", cta: "오늘만 이가격", keyword: "콜라겐 저분자" },
      ],
    },
    {
      advice: "__NICK__, 내가 시키는 거 아니야\n그냥 운 좋은 타이밍이야",
      recommendations: [
        { name: "피부광채 콜라겐", reason: "에스트로겐이 도와주는 지금이 찬스", cta: "바로 가기", keyword: "콜라겐 여성" },
        { name: "건강 오메가3", reason: "배란기 뇌 건강 챙기기", cta: "핫딜 보기", keyword: "오메가3 저렴한" },
      ],
    },
    {
      advice: "__NICK__아 피부 빛나잖아 요즘\n지금이 황금 타이밍이야",
      recommendations: [
        { name: "피부광채 콜라겐", reason: "이때 먹으면 두 배로 효과 나", cta: "최저가 확인", keyword: "콜라겐 저분자 여성" },
        { name: "두뇌 오메가3", reason: "컨디션 좋을 때 뇌도 챙겨", cta: "핫딜 보기", keyword: "오메가3 추천" },
      ],
    },
  ],
}

export function getHolsiContent(
  dDay: number | null | undefined,
  nickname: string
): { advice: string; recommendations: Recommendation[] } {
  let phaseKey: string
  if (dDay === null || dDay === undefined) {
    phaseKey = 'none'
  } else if (dDay < 0) {
    phaseKey = 'menstrual'
  } else if (dDay === 0) {
    phaseKey = 'dday'
  } else if (dDay <= 3) {
    phaseKey = 'imminent'
  } else if (dDay <= 7) {
    phaseKey = 'luteal_late'
  } else if (dDay <= 14) {
    phaseKey = 'luteal_early'
  } else {
    phaseKey = 'ovulation'
  }

  const entries = phases[phaseKey] ?? phases.none
  const entry = rand(entries)

  return {
    advice: entry.advice.replace(/__NICK__/g, nickname),
    recommendations: entry.recommendations,
  }
}
