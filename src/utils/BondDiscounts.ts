import { Address, BigDecimal, BigInt, log} from '@graphprotocol/graph-ts'
import { SDAODAIBond } from '../../generated/SDAODAIBond/SDAODAIBond';
import { WFTMBond } from '../../generated/WFTMBond/WFTMBond';

import { BondDiscount, Transaction } from '../../generated/schema'
import {
    DAIBOND_CONTRACT,
    DAIBOND_CONTRACT_BLOCK,
    SDAODAIBOND_CONTRACT,
    SDAODAIBOND_CONTRACT_BLOCK,
    WFTMBOND_CONTRACT,
    WFTMBOND_CONTRACT_BLOCK
} from './Constants';
import { hourFromTimestamp } from './Dates';
import { toDecimal } from './Decimals';
import { getSDAODAIRate } from './Price';
import {DAIBond} from "../../generated/DAIBond/DAIBond";

export function loadOrCreateBondDiscount(timestamp: BigInt): BondDiscount{
    let hourTimestamp = hourFromTimestamp(timestamp);

    let bondDiscount = BondDiscount.load(hourTimestamp)
    if (bondDiscount == null) {
        bondDiscount = new BondDiscount(hourTimestamp)
        bondDiscount.timestamp = timestamp
        bondDiscount.dai_discount  = BigDecimal.fromString("0")
        bondDiscount.sdaodai_discount = BigDecimal.fromString("0")
        bondDiscount.wftm_discount = BigDecimal.fromString("0")
        bondDiscount.save()
    }
    return bondDiscount as BondDiscount
}

export function updateBondDiscounts(transaction: Transaction): void{
    let bd = loadOrCreateBondDiscount(transaction.timestamp);
    let sdaoRate = getSDAODAIRate();

    //DAI
    if(transaction.blockNumber.gt(BigInt.fromString(DAIBOND_CONTRACT_BLOCK))){
        let bond = DAIBond.bind(Address.fromString(DAIBOND_CONTRACT))
        let price_call = bond.try_bondPriceInUSD()
        if(price_call.reverted===false && price_call.value.gt(BigInt.fromI32(0))){
            bd.dai_discount = sdaoRate.div(toDecimal(price_call.value, 6))
            bd.dai_discount = bd.dai_discount.minus(BigDecimal.fromString("1"))
            bd.dai_discount = bd.dai_discount.times(BigDecimal.fromString("100"))
            log.debug("DAI Discount SDAO price {}  Bond Price {}  Discount {}", [sdaoRate.toString(), price_call.value.toString(), bd.dai_discount.toString()])
        }
    }

    //SDAO-DAI
    if(transaction.blockNumber.gt(BigInt.fromString(SDAODAIBOND_CONTRACT_BLOCK))){
        let bond = SDAODAIBond.bind(Address.fromString(SDAODAIBOND_CONTRACT))
        let price_call = bond.try_bondPriceInUSD()
        if(price_call.reverted===false && price_call.value.gt(BigInt.fromI32(0))){
            bd.sdaodai_discount = sdaoRate.div(toDecimal(price_call.value, 18))
            bd.sdaodai_discount = bd.sdaodai_discount.minus(BigDecimal.fromString("1"))
            bd.sdaodai_discount = bd.sdaodai_discount.times(BigDecimal.fromString("100"))
            log.debug("SDAODAI Discount SDAO price {}  Bond Price {}  Discount {}", [sdaoRate.toString(), price_call.value.toString(), bd.sdaodai_discount.toString()])
        }
    }

    //FTM
    if(transaction.blockNumber.gt(BigInt.fromString(WFTMBOND_CONTRACT_BLOCK))){
        let bond = WFTMBond.bind(Address.fromString(WFTMBOND_CONTRACT))
        let price_call = bond.try_bondPriceInUSD()
        if(price_call.reverted===false && price_call.value.gt(BigInt.fromI32(0))){
            bd.wftm_discount = sdaoRate.div(toDecimal(price_call.value, 18))
            bd.wftm_discount = bd.wftm_discount.minus(BigDecimal.fromString("1"))
            bd.wftm_discount = bd.wftm_discount.times(BigDecimal.fromString("100"))
            log.debug("FTM Discount SDAO price {}  Bond Price {}  Discount {}", [sdaoRate.toString(), price_call.value.toString(), bd.wftm_discount.toString()])
        }
    }
    
    bd.save()
}