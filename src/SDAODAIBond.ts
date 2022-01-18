import {  DepositCall, RedeemCall  } from '../generated/SDAODAIBond/SDAODAIBond'
import { Deposit, Redemption } from '../generated/schema'
import { loadOrCreateTransaction } from "./utils/Transactions"
import { loadOrCreateSDAOie, updateSDAOieBalance } from "./utils/SDAOie"
import { toDecimal } from "./utils/Decimals"
import { SDAODAIBOND_TOKEN, SDAO_DAI_PAIR_CONTRACT } from './utils/Constants'
import { loadOrCreateToken } from './utils/Tokens'
import { createDailyBondRecord } from './utils/DailyBond'
import { getPairDAI } from './utils/Price'

export function handleDeposit(call: DepositCall): void {
    let sdaoie = loadOrCreateSDAOie(call.transaction.from)
    let transaction = loadOrCreateTransaction(call.transaction, call.block)
    let token = loadOrCreateToken(SDAODAIBOND_TOKEN)

    let amount = toDecimal(call.inputs._amount, 18)
    let deposit = new Deposit(transaction.id)
    deposit.transaction = transaction.id
    deposit.sdaoie = sdaoie.id
    deposit.amount = amount
    deposit.value = getPairDAI(call.inputs._amount, SDAO_DAI_PAIR_CONTRACT)
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
    redemption.token = loadOrCreateToken(SDAODAIBOND_TOKEN).id;
    redemption.timestamp = transaction.timestamp;
    redemption.save()
    updateSDAOieBalance(sdaoie, transaction)
}