import { Address } from '@graphprotocol/graph-ts'

import {  DepositCall, RedeemCall  } from '../generated/BUSDBond/BUSDBond'
import { Deposit } from '../generated/schema'
import { loadOrCreateSDOGEie, updateSDOGEieBalance } from "./utils/SDOGEie"
import { toDecimal } from "./utils/Decimals"
import { BUSDBOND_TOKEN } from './utils/Constants'
import { loadOrCreateToken } from './utils/Tokens'
import { loadOrCreateRedemption } from './utils/Redemption'
import { createDailyBondRecord } from './utils/DailyBond'
import {loadOrCreateTransaction} from "./utils/Transactions";


export function handleDeposit(call: DepositCall): void {
    let sdogeie = loadOrCreateSDOGEie(call.transaction.from)
    let transaction = loadOrCreateTransaction(call.transaction, call.block)
    let token = loadOrCreateToken(BUSDBOND_TOKEN)

    let amount = toDecimal(call.inputs._amount, 18)
    let deposit = new Deposit(transaction.id)
    deposit.transaction = transaction.id
    deposit.sdogeie = sdogeie.id
    deposit.amount = amount
    deposit.value = amount
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

    let redemption = loadOrCreateRedemption(call.transaction.hash as Address)
    redemption.transaction = transaction.id
    redemption.sdogeie = sdogeie.id
    redemption.token = loadOrCreateToken(BUSDBOND_TOKEN).id;
    redemption.timestamp = transaction.timestamp;
    redemption.save()
    updateSDOGEieBalance(sdogeie, transaction)
}