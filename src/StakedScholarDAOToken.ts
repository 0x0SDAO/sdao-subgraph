import { RebaseCall } from '../generated/StakedScholarDAOToken/StakedScholarDAOToken'
import { ScholarDAOToken } from '../generated/StakedScholarDAOToken/ScholarDAOToken'
import { createDailyStakingReward } from './utils/DailyStakingReward'
import { loadOrCreateTransaction } from "./utils/Transactions"
import { Rebase } from '../generated/schema'
import { Address, BigInt, log } from '@graphprotocol/graph-ts'
import { SDAO_CONTRACT, STAKING_CONTRACT } from './utils/Constants'
import { toDecimal } from './utils/Decimals'
import { getSDAOUSDRate } from './utils/Price';

export function rebaseFunction(call: RebaseCall): void {
    let transaction = loadOrCreateTransaction(call.transaction, call.block)
    var rebase = Rebase.load(transaction.id)
    log.debug("Rebase_V2 event on TX {} with amount {}", [transaction.id, toDecimal(call.inputs.profit_, 9).toString()])

    if (rebase == null && call.inputs.profit_.gt(BigInt.fromI32(0))) {
        let sdao_contract = ScholarDAOToken.bind(Address.fromString(SDAO_CONTRACT))

        rebase = new Rebase(transaction.id)
        rebase.amount = toDecimal(call.inputs.profit_, 9)
        rebase.stakedSDAOs = toDecimal(sdao_contract.balanceOf(Address.fromString(STAKING_CONTRACT)), 9)
        rebase.contract = STAKING_CONTRACT
        rebase.percentage = rebase.amount.div(rebase.stakedSDAOs)
        rebase.transaction = transaction.id
        rebase.timestamp = transaction.timestamp
        rebase.value = rebase.amount.times(getSDAOUSDRate())
        rebase.save()

        createDailyStakingReward(rebase.timestamp, rebase.amount)
    }
}