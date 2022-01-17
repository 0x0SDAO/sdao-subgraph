import {  DepositCall, RedeemCall  } from '../generated/WFTMBond/WFTMBond'
import { Deposit, Redemption } from '../generated/schema'
import { loadOrCreateTransaction } from "./utils/Transactions"
import { loadOrCreateSDAOie, updateSDAOieBalance } from "./utils/SDAOie"
import { toDecimal } from "./utils/Decimals"
import { WFTMBOND_TOKEN } from './utils/Constants'
import { loadOrCreateToken } from './utils/Tokens'
import { createDailyBondRecord } from './utils/DailyBond'
import { getFTMUSDCRate } from './utils/Price'

export function handleDeposit(call: DepositCall): void {
    let sdaoie = loadOrCreateSDAOie(call.transaction.from)
    let transaction = loadOrCreateTransaction(call.transaction, call.block)
    let token = loadOrCreateToken(WFTMBOND_TOKEN)

    let amount = toDecimal(call.inputs._amount, 18)
    let deposit = new Deposit(transaction.id)
    deposit.transaction = transaction.id
    deposit.sdaoie = sdaoie.id
    deposit.amount = amount
    deposit.value = amount.times(getFTMUSDCRate())
    deposit.maxPremium = toDecimal(call.inputs._maxPrice)
    deposit.token = token.id;
    deposit.timestamp = transaction.timestamp;
    deposit.save()

    createDailyBondRecord(deposit.timestamp, token, deposit.amount, deposit.value)
    updateSDAOieBalance(sdaoie, transaction)
}

export function handleRedeem(call: RedeemCall): void {
    let sdaoie = loadOrCreateSDAOie(call.transaction.from)
    let transaction = loadOrCreateTransaction(call.transaction, call.block)

    let redemption = Redemption.load(transaction.id)
    if (redemption==null){
        redemption = new Redemption(transaction.id)
    }
    redemption.transaction = transaction.id
    redemption.sdaoie = sdaoie.id
    redemption.token = loadOrCreateToken(WFTMBOND_TOKEN).id;
    redemption.timestamp = transaction.timestamp;
    redemption.save()
    updateSDAOieBalance(sdaoie, transaction)
}