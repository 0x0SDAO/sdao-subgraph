import {  DepositCall, RedeemCall  } from '../generated/WBNBBond/WBNBBond'
import { Deposit, Redemption } from '../generated/schema'
import { loadOrCreateTransaction } from "./utils/Transactions"
import { loadOrCreateSDOGEie, updateSDOGEieBalance } from "./utils/SDOGEie"
import { toDecimal } from "./utils/Decimals"
import { WBNBBOND_TOKEN } from './utils/Constants'
import { loadOrCreateToken } from './utils/Tokens'
import { createDailyBondRecord } from './utils/DailyBond'
import { getBNBUSDRate } from './utils/Price'

export function handleDeposit(call: DepositCall): void {
    let sdogeie = loadOrCreateSDOGEie(call.transaction.from)
    let transaction = loadOrCreateTransaction(call.transaction, call.block)
    let token = loadOrCreateToken(WBNBBOND_TOKEN)

    let amount = toDecimal(call.inputs._amount, 18)
    let deposit = new Deposit(transaction.id)
    deposit.transaction = transaction.id
    deposit.sdogeie = sdogeie.id
    deposit.amount = amount
    deposit.value = amount.times(getBNBUSDRate())
    deposit.maxPremium = toDecimal(call.inputs._maxPrice)
    deposit.token = token.id;
    deposit.timestamp = transaction.timestamp;
    deposit.save()

    createDailyBondRecord(deposit.timestamp, token, deposit.amount, deposit.value)
    updateSDOGEieBalance(sdogeie, transaction)
}

export function handleRedeem(call: RedeemCall): void {
    let sdogeie = loadOrCreateSDOGEie(call.transaction.from)
    let transaction = loadOrCreateTransaction(call.transaction, call.block)

    let redemption = Redemption.load(transaction.id)
    if (redemption==null){
        redemption = new Redemption(transaction.id)
    }
    redemption.transaction = transaction.id
    redemption.sdogeie = sdogeie.id
    redemption.token = loadOrCreateToken(WBNBBOND_TOKEN).id;
    redemption.timestamp = transaction.timestamp;
    redemption.save()
    updateSDOGEieBalance(sdogeie, transaction)
}