import api from './api'
import type { ContributionFilter } from '@/types/contribution.types'
import type { FinanceOrigin, PendingContribution } from './contributions-records'
import { validContributionPage } from './contributions-sync'
const headers=(origin:FinanceOrigin)=>({'x-member-id':origin.memberId,'x-device-id':origin.deviceId})
export const ContributionsService={
  async send(record:PendingContribution):Promise<unknown> {
    const path=record.kind==='create'?'/finance/contributions':`/finance/contributions/${record.contributionId}/reversals`
    return (await api.post(path,record.payload,{headers:headers(record.origin),financialOrigin:record.origin,skipAuthRedirect:true} as Parameters<typeof api.post>[2])).data
  },
  async list(origin:FinanceOrigin,filter:ContributionFilter={}) {
    const {data}=await api.get('/finance/contributions',{params:filter,headers:headers(origin),financialOrigin:origin} as Parameters<typeof api.get>[1])
    if(!validContributionPage(data,origin)) throw new Error('Invalid contribution list response')
    return data
  },
}
