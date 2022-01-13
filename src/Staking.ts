import { Address } from '@graphprotocol/graph-ts'
import { Stake, Unstake } from '../generated/schema'

import {  StakeCall, UnstakeCall  } from '../generated/Staking/Staking'
import { toDecimal } from "./utils/Decimals"
import { loadOrCreateSDOGEie, updateSDOGEieBalance } from "./utils/SDOGEie"
import { loadOrCreateTransaction } from "./utils/Transactions"
import { updateProtocolMetrics } from './utils/ProtocolMetrics'

export function handleStake(call: StakeCall): void {
    let sdogeie = loadOrCreateSDOGEie(call.from as Address)
    let transaction = loadOrCreateTransaction(call.transaction, call.block)
    let value = toDecimal(call.inputs._amount, 9)

    let stake = new Stake(transaction.id)
    
    stake.transaction = transaction.id
    stake.sdogeie = sdogeie.id
    stake.amount = value
    stake.timestamp = transaction.timestamp;
    stake.save()

    updateSDOGEieBalance(sdogeie, transaction)
    updateProtocolMetrics(transaction)
}

export function handleUnstake(call: UnstakeCall): void {
    let sdogeie = loadOrCreateSDOGEie(call.from as Address)
    let transaction = loadOrCreateTransaction(call.transaction, call.block)
    let value = toDecimal(call.inputs._amount, 9)

    let unstake = new Unstake(transaction.id)
    unstake.transaction = transaction.id
    unstake.sdogeie = sdogeie.id
    unstake.amount = value
    unstake.timestamp = transaction.timestamp;
    unstake.save()

    updateSDOGEieBalance(sdogeie, transaction)
    updateProtocolMetrics(transaction)
}