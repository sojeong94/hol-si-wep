  import { addDays, differenceInDays } from 'date-fns'
  
  export const parseLocalDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d)
  }

export const getAveragePeriodDays = (records: { startDate: string, endDate: string | null }[], defaultDays: number) => {
  const completeRecords = records.filter(r => r.endDate)
  if (completeRecords.length === 0) return defaultDays
  
  let totalDays = 0
  let validCycles = 0
  
  completeRecords.forEach(r => {
    // startDate와 endDate를 포함하여 계산하므로 +1
    const diff = differenceInDays(parseLocalDate(r.endDate!), parseLocalDate(r.startDate)) + 1
    if (diff > 1 && diff < 15) {
      totalDays += diff
      validCycles++
    }
  })
  
  if (validCycles === 0) return defaultDays
  return Math.round(totalDays / validCycles)
}

export const getAverageCycle = (records: { startDate: string, endDate: string | null }[], defaultCycle: number) => {
  if (records.length < 2) return defaultCycle
  
  // Sort by startDate
  const sorted = [...records].sort((a, b) => parseLocalDate(a.startDate).getTime() - parseLocalDate(b.startDate).getTime())
  
  let totalDays = 0
  let validCycles = 0
  
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseLocalDate(sorted[i - 1].startDate)
    const current = parseLocalDate(sorted[i].startDate)
    
    // 생리 간격 계산
    const diff = differenceInDays(current, prev)
    // 상식적인 주기(15일 ~ 60일) 필터링
    if (diff > 15 && diff < 60) {
      totalDays += diff
      validCycles++
    }
  }
  
  if (validCycles === 0) return defaultCycle
  return Math.round(totalDays / validCycles)
}

export const getNextPeriodDate = (lastStartDate: string, averageCycle: number) => {
  return addDays(parseLocalDate(lastStartDate), averageCycle)
}

export const getOvulationDate = (nextPeriodDate: Date) => {
  // 다음 생리 예정일 - 14일
  return addDays(nextPeriodDate, -14)
}

export const getOvulationPeriod = (ovulationDate: Date) => {
  // 사용자의 요청으로 가장 확률이 높은 4일(배란일 전 2일 ~ 후 1일)로 축소
  return {
    start: addDays(ovulationDate, -2),
    end: addDays(ovulationDate, 1)
  }
}
