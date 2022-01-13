import { Address, BigDecimal, BigInt, log} from '@graphprotocol/graph-ts'
import { BUSDBond } from '../../generated/BUSDBond/BUSDBond';
import { SDOGEBUSDBond } from '../../generated/SDOGEBUSDBond/SDOGEBUSDBond';
import { WBNBBond } from '../../generated/WBNBBond/WBNBBond';

import { BondDiscount, Transaction } from '../../generated/schema'
import {
    BUSDBOND_CONTRACT,
    BUSDBOND_CONTRACT_BLOCK,
    SDOGEBUSDBOND_CONTRACT,
    SDOGEBUSDBOND_CONTRACT_BLOCK,
    WBNBBOND_CONTRACT,
    WBNBBOND_CONTRACT_BLOCK
} from './Constants';
import { hourFromTimestamp } from './Dates';
import { toDecimal } from './Decimals';
import { getSDOGEUSDRate } from './Price';

export function loadOrCreateBondDiscount(timestamp: BigInt): BondDiscount{
    let hourTimestamp = hourFromTimestamp(timestamp);

    let bondDiscount = BondDiscount.load(hourTimestamp)
    if (bondDiscount == null) {
        bondDiscount = new BondDiscount(hourTimestamp)
        bondDiscount.timestamp = timestamp
        bondDiscount.busd_discount  = BigDecimal.fromString("0")
        bondDiscount.sdogebusd_discount = BigDecimal.fromString("0")
        bondDiscount.wbnb_discount = BigDecimal.fromString("0")
        bondDiscount.save()
    }
    return bondDiscount as BondDiscount
}

export function updateBondDiscounts(transaction: Transaction): void{
    let bd = loadOrCreateBondDiscount(transaction.timestamp);
    let sdogeRate = getSDOGEUSDRate();

    //BUSD
    if(transaction.blockNumber.gt(BigInt.fromString(BUSDBOND_CONTRACT_BLOCK))){
        let bond = BUSDBond.bind(Address.fromString(BUSDBOND_CONTRACT))
        let price_call = bond.try_bondPriceInUSD()
        if(price_call.reverted===false && price_call.value.gt(BigInt.fromI32(0))){
            bd.busd_discount = sdogeRate.div(toDecimal(price_call.value, 18))
            bd.busd_discount = bd.busd_discount.minus(BigDecimal.fromString("1"))
            bd.busd_discount = bd.busd_discount.times(BigDecimal.fromString("100"))
            log.debug("BUSD Discount SDOGE price {}  Bond Price {}  Discount {}", [sdogeRate.toString(), price_call.value.toString(), bd.busd_discount.toString()])
        }
    }

    //SDOGE-BUSD
    if(transaction.blockNumber.gt(BigInt.fromString(SDOGEBUSDBOND_CONTRACT_BLOCK))){
        let bond = SDOGEBUSDBond.bind(Address.fromString(SDOGEBUSDBOND_CONTRACT))
        let price_call = bond.try_bondPriceInUSD()
        if(price_call.reverted===false && price_call.value.gt(BigInt.fromI32(0))){
            bd.sdogebusd_discount = sdogeRate.div(toDecimal(price_call.value, 18))
            bd.sdogebusd_discount = bd.sdogebusd_discount.minus(BigDecimal.fromString("1"))
            bd.sdogebusd_discount = bd.sdogebusd_discount.times(BigDecimal.fromString("100"))
            log.debug("SDOGEBUSD Discount SDOGE price {}  Bond Price {}  Discount {}", [sdogeRate.toString(), price_call.value.toString(), bd.sdogebusd_discount.toString()])
        }
    }

    //BNB
    if(transaction.blockNumber.gt(BigInt.fromString(WBNBBOND_CONTRACT_BLOCK))){
        let bond = WBNBBond.bind(Address.fromString(WBNBBOND_CONTRACT))
        let price_call = bond.try_bondPriceInUSD()
        if(price_call.reverted===false && price_call.value.gt(BigInt.fromI32(0))){
            bd.wbnb_discount = sdogeRate.div(toDecimal(price_call.value, 18))
            bd.wbnb_discount = bd.wbnb_discount.minus(BigDecimal.fromString("1"))
            bd.wbnb_discount = bd.wbnb_discount.times(BigDecimal.fromString("100"))
            log.debug("ETH Discount OHM price {}  Bond Price {}  Discount {}", [sdogeRate.toString(), price_call.value.toString(), bd.wbnb_discount.toString()])
        }
    }
    
    bd.save()
}