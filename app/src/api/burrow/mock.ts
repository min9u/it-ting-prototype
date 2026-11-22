/**
 * 04 내 땅굴 — 목 서버. data/myBurrow.ts · data/moleItems.ts 를 가짜 DB 로 씀
 */
import { badRequest, conflict, mockWrite } from '../mock/server'
import { memberProfile, moleOf } from '../common/mockPeople'
import { ME_ID } from '../../data/mock'
import { MAX_WORN, itemOf, setMyWorn } from '../../data/moleItems'
import { NICK_MAX, nickTaken, setMyProfile } from '../../data/myBurrow'
import type { BurrowApi } from './real'

export const mock: BurrowApi = {
  updateProfile: (p) => mockWrite(() => {
    if (p.nickname != null) {
      if (!p.nickname.trim() || p.nickname.length > NICK_MAX) throw badRequest('INVALID_NICKNAME', `닉네임은 1~${NICK_MAX}자로 정해 주세요.`)
      if (nickTaken(p.nickname)) throw conflict('NICKNAME_TAKEN', '이미 쓰는 닉네임이에요.')
    }
    setMyProfile({
      ...(p.nickname != null ? { nickname: p.nickname } : {}), ...(p.intro !== undefined ? { intro: p.intro ?? '' } : {}),
      ...(p.answers ? { qna: p.answers.map((a) => ({ qid: a.questionId, a: a.answer })) } : {}),
      ...(p.campusFloorId ? { campus: p.campusFloorId.split('|')[0], floor: Number(p.campusFloorId.split('|')[1]) } : {}),
    })
    return memberProfile(ME_ID)
  }),
  updateMole: (look) => mockWrite(() => {
    const ids = [look.head, look.face, look.neck, look.hand].filter((x): x is string => !!x)
    if (ids.length > MAX_WORN || ids.some((id) => !itemOf(id))) throw badRequest('INVALID_ITEM', '고를 수 없는 꾸미기예요.')
    setMyWorn(ids)
    return moleOf(ids)
  }),
}
