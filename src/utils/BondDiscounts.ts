import { Address, BigDecimal, BigInt, log} from '@graphprotocol/graph-ts'
import { USDCBond } from '../../generated/USDCBond/USDCBond';
import { SDAOUSDCBond } from '../../generated/SDAOUSDCBond/SDAOUSDCBond';
import { WFTMBond } from '../../generated/WFTMBond/WFTMBond';

import { BondDiscount, Transaction } from '../../generated/schema'
import {
    USDCBOND_CONTRACT,
    USDCBOND_CONTRACT_BLOCK,
    SDAOUSDCBOND_CONTRACT,
    SDAOUSDCBOND_CONTRACT_BLOCK,
    WFTMBOND_CONTRACT,
    WFTMBOND_CONTRACT_BLOCK
} from './Constants';
import { hourFromTimestamp } from './Dates';
import { toDecimal } from './Decimals';
import { getSDAOUSDRate } from './Price';

export function loadOrCreateBondDiscount(timestamp: BigInt): BondDiscount{
    let hourTimestamp = hourFromTimestamp(timestamp);

    let bondDiscount = BondDiscount.load(hourTimestamp)
    if (bondDiscount == null) {
        bondDiscount = new BondDiscount(hourTimestamp)
        bondDiscount.timestamp = timestamp
        bondDiscount.usdc_discount  = BigDecimal.fromString("0")
        bondDiscount.sdaousdc_discount = BigDecimal.fromString("0")
        bondDiscount.wftm_discount = BigDecimal.fromString("0")
        bondDiscount.save()
    }
    return bondDiscount as BondDiscount
}

export function updateBondDiscounts(transaction: Transaction): void{
    let bd = loadOrCreateBondDiscount(transaction.timestamp);
    let sdaoRate = getSDAOUSDRate();

    //USDC
    if(transaction.blockNumber.gt(BigInt.fromString(USDCBOND_CONTRACT_BLOCK))){
        let bond = USDCBond.bind(Address.fromString(USDCBOND_CONTRACT))
        let price_call = bond.try_bondPriceInUSD()
        if(price_call.reverted===false && price_call.value.gt(BigInt.fromI32(0))){
            bd.usdc_discount = sdaoRate.div(toDecimal(price_call.value, 6))
            bd.usdc_discount = bd.usdc_discount.minus(BigDecimal.fromString("1"))
            bd.usdc_discount = bd.usdc_discount.times(BigDecimal.fromString("100"))
            log.debug("USDC Discount SDAO price {}  Bond Price {}  Discount {}", [sdaoRate.toString(), price_call.value.toString(), bd.usdc_discount.toString()])
        }
    }

    //SDAO-USDC
    if(transaction.blockNumber.gt(BigInt.fromString(SDAOUSDCBOND_CONTRACT_BLOCK))){
        let bond = SDAOUSDCBond.bind(Address.fromString(SDAOUSDCBOND_CONTRACT))
        let price_call = bond.try_bondPriceInUSD()
        if(price_call.reverted===false && price_call.value.gt(BigInt.fromI32(0))){
            bd.sdaousdc_discount = sdaoRate.div(toDecimal(price_call.value, 18))
            bd.sdaousdc_discount = bd.sdaousdc_discount.minus(BigDecimal.fromString("1"))
            bd.sdaousdc_discount = bd.sdaousdc_discount.times(BigDecimal.fromString("100"))
            log.debug("SDAOUSDC Discount SDAO price {}  Bond Price {}  Discount {}", [sdaoRate.toString(), price_call.value.toString(), bd.sdaousdc_discount.toString()])
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