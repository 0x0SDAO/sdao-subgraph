import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import { SDAOie, SDAOieBalance } from '../../generated/schema'

export function loadOrCreateSDAOieBalance(sdaoie: SDAOie, timestamp: BigInt): SDAOieBalance{
    let id = timestamp.toString()+sdaoie.id

    let sdaoieBalance = SDAOieBalance.load(id)
    if (sdaoieBalance == null) {
        sdaoieBalance = new SDAOieBalance(id)
        sdaoieBalance.sdaoie = sdaoie.id
        sdaoieBalance.timestamp = timestamp
        sdaoieBalance.ssdaoBalance = BigDecimal.fromString("0")
        sdaoieBalance.sdaoBalance = BigDecimal.fromString("0")
        sdaoieBalance.bondBalance = BigDecimal.fromString("0")
        sdaoieBalance.dollarBalance = BigDecimal.fromString("0")
        sdaoieBalance.stakes = []
        sdaoieBalance.bonds = []
        sdaoieBalance.save()
    }
    return sdaoieBalance as SDAOieBalance
}