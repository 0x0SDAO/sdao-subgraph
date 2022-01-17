import { Address } from '@graphprotocol/graph-ts'
import { Stake, Unstake } from '../generated/schema'

import {  StakeCall, UnstakeCall  } from '../generated/Staking/Staking'
import { toDecimal } from "./utils/Decimals"
import { loadOrCreateSDAOie, updateSDAOieBalance } from "./utils/SDAOie"
import { loadOrCreateTransaction } from "./utils/Transactions"
import { updateProtocolMetrics } from './utils/ProtocolMetrics'

export function handleStake(call: StakeCall): void {
    let sdaoie = loadOrCreateSDAOie(call.from as Address)
    let transaction = loadOrCreateTransaction(call.transaction, call.block)
    let value = toDecimal(call.inputs._amount, 9)

    let stake = new Stake(transaction.id)
    
    stake.transaction = transaction.id
    stake.sdaoie = sdaoie.id
    stake.amount = value
    stake.timestamp = transaction.timestamp;
    stake.save()

    updateSDAOieBalance(sdaoie, transaction)
    updateProtocolMetrics(transaction)
}

export function handleUnstake(call: UnstakeCall): void {
    let sdaoie = loadOrCreateSDAOie(call.from as Address)
    let transaction = loadOrCreateTransaction(call.transaction, call.block)
    let value = toDecimal(call.inputs._amount, 9)

    let unstake = new Unstake(transaction.id)
    unstake.transaction = transaction.id
    unstake.sdaoie = sdaoie.id
    unstake.amount = value
    unstake.timestamp = transaction.timestamp;
    unstake.save()

    updateSDAOieBalance(sdaoie, transaction)
    updateProtocolMetrics(transaction)
}