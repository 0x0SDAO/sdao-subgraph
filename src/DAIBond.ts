import { Address } from '@graphprotocol/graph-ts'

import {  DepositCall, RedeemCall  } from '../generated/DAIBond/DAIBond'
import { Deposit } from '../generated/schema'
import { loadOrCreateSDAOie, updateSDAOieBalance } from "./utils/SDAOie"
import { toDecimal } from "./utils/Decimals"
import { DAIBOND_TOKEN } from './utils/Constants'
import { loadOrCreateToken } from './utils/Tokens'
import { loadOrCreateRedemption } from './utils/Redemption'
import { createDailyBondRecord } from './utils/DailyBond'
import {loadOrCreateTransaction} from "./utils/Transactions";

export function handleDeposit(call: DepositCall): void {
    let sdaoie = loadOrCreateSDAOie(call.transaction.from)
    let transaction = loadOrCreateTransaction(call.transaction, call.block)
    let token = loadOrCreateToken(DAIBOND_TOKEN)

    let amount = toDecimal(call.inputs._amount, 18)
    let deposit = new Deposit(transaction.id)
    deposit.transaction = transaction.id
    deposit.sdaoie = sdaoie.id
    deposit.amount = amount
    deposit.value = amount
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

    let redemption = loadOrCreateRedemption(call.transaction.hash as Address)
    redemption.transaction = transaction.id
    redemption.sdaoie = sdaoie.id
    redemption.token = loadOrCreateToken(DAIBOND_TOKEN).id;
    redemption.timestamp = transaction.timestamp;
    redemption.save()
    updateSDAOieBalance(sdaoie, transaction)
}