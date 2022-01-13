import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import { SDOGEie, SDOGEieBalance } from '../../generated/schema'
import { dayFromTimestamp } from './Dates';

export function loadOrCreateSDOGEieBalance(sdogeie: SDOGEie, timestamp: BigInt): SDOGEieBalance{
    let id = timestamp.toString()+sdogeie.id

    let sdogeieBalance = SDOGEieBalance.load(id)
    if (sdogeieBalance == null) {
        sdogeieBalance = new SDOGEieBalance(id)
        sdogeieBalance.sdogeie = sdogeie.id
        sdogeieBalance.timestamp = timestamp
        sdogeieBalance.ssdogeBalance = BigDecimal.fromString("0")
        sdogeieBalance.sdogeBalance = BigDecimal.fromString("0")
        sdogeieBalance.bondBalance = BigDecimal.fromString("0")
        sdogeieBalance.dollarBalance = BigDecimal.fromString("0")
        sdogeieBalance.stakes = []
        sdogeieBalance.bonds = []
        sdogeieBalance.save()
    }
    return sdogeieBalance as SDOGEieBalance
}

