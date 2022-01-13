import { RebaseCall } from '../generated/StakedScholarDogeToken/StakedScholarDogeToken'
import { ScholarDogeToken } from '../generated/StakedScholarDogeToken/ScholarDogeToken'
import { createDailyStakingReward } from './utils/DailyStakingReward'
import { loadOrCreateTransaction } from "./utils/Transactions"
import { Rebase } from '../generated/schema'
import { Address, BigInt, log } from '@graphprotocol/graph-ts'
import { SDOGE_CONTRACT, STAKING_CONTRACT } from './utils/Constants'
import { toDecimal } from './utils/Decimals'
import { getSDOGEUSDRate } from './utils/Price';

export function rebaseFunction(call: RebaseCall): void {
    let transaction = loadOrCreateTransaction(call.transaction, call.block)
    var rebase = Rebase.load(transaction.id)
    log.debug("Rebase_V2 event on TX {} with amount {}", [transaction.id, toDecimal(call.inputs.profit_, 9).toString()])

    if (rebase == null && call.inputs.profit_.gt(BigInt.fromI32(0))) {
        let ohm_contract = ScholarDogeToken.bind(Address.fromString(SDOGE_CONTRACT))

        rebase = new Rebase(transaction.id)
        rebase.amount = toDecimal(call.inputs.profit_, 9)
        rebase.stakedSDOGEs = toDecimal(ohm_contract.balanceOf(Address.fromString(STAKING_CONTRACT)), 9)
        rebase.contract = STAKING_CONTRACT
        rebase.percentage = rebase.amount.div(rebase.stakedSDOGEs)
        rebase.transaction = transaction.id
        rebase.timestamp = transaction.timestamp
        rebase.value = rebase.amount.times(getSDOGEUSDRate())
        rebase.save()

        createDailyStakingReward(rebase.timestamp, rebase.amount)
    }
}