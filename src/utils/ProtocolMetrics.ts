import { Address, BigDecimal, BigInt, log} from '@graphprotocol/graph-ts'
import { ScholarDogeToken } from '../../generated/Staking/ScholarDogeToken';
import { StakedScholarDogeToken } from '../../generated/Staking/StakedScholarDogeToken';
import { CirculatingSupply } from '../../generated/Staking/CirculatingSupply';
import { BEP20 } from '../../generated/Staking/BEP20';
import { PancakePair } from '../../generated/Staking/PancakePair';
import { Staking } from '../../generated/Staking/Staking';

import { ProtocolMetric, Transaction } from '../../generated/schema'
import {
    CIRCULATING_SUPPLY_CONTRACT,
    CIRCULATING_SUPPLY_CONTRACT_BLOCK,
    BUSD_CONTRACT,
    SDOGE_CONTRACT,
    SSDOGE_CONTRACT,
    SSDOGE_CONTRACT_BLOCK,
    STAKING_CONTRACT,
    STAKING_CONTRACT_BLOCK,
    SDOGE_BUSD_PAIR_CONTRACT,
    TREASURY_ADDRESS,
    WBNB_CONTRACT
} from './Constants';
import { dayFromTimestamp } from './Dates';
import { toDecimal } from './Decimals';
import { 
    getSDOGEUSDRate,
    getDiscountedPairUSD,
    getPairUSD,
    getBNBUSDRate,
    getPairWBNB
} from './Price';
import { updateBondDiscounts } from './BondDiscounts';
import {getHolderAux} from "./Aux";

export function loadOrCreateProtocolMetric(timestamp: BigInt): ProtocolMetric{
    let dayTimestamp = dayFromTimestamp(timestamp);

    let protocolMetric = ProtocolMetric.load(dayTimestamp)
    if (protocolMetric == null) {
        protocolMetric = new ProtocolMetric(dayTimestamp)
        protocolMetric.timestamp = timestamp
        protocolMetric.sdogeCirculatingSupply = BigDecimal.fromString("0")
        protocolMetric.ssdogeCirculatingSupply = BigDecimal.fromString("0")
        protocolMetric.totalSupply = BigDecimal.fromString("0")
        protocolMetric.sdogePrice = BigDecimal.fromString("0")
        protocolMetric.marketCap = BigDecimal.fromString("0")
        protocolMetric.totalValueLocked = BigDecimal.fromString("0")
        protocolMetric.treasuryRiskFreeValue = BigDecimal.fromString("0")
        protocolMetric.treasuryMarketValue = BigDecimal.fromString("0")
        protocolMetric.nextEpochRebase = BigDecimal.fromString("0")
        protocolMetric.nextDistributedSdoge = BigDecimal.fromString("0")
        protocolMetric.currentAPY = BigDecimal.fromString("0")
        protocolMetric.treasuryBUSDRiskFreeValue = BigDecimal.fromString("0")
        protocolMetric.treasuryBUSDMarketValue = BigDecimal.fromString("0")
        protocolMetric.treasurySDOGEBUSDPOL = BigDecimal.fromString("0")
        protocolMetric.holders = BigInt.fromI32(0)

        protocolMetric.save()
    }
    return protocolMetric as ProtocolMetric
}


function getTotalSupply(): BigDecimal{
    let sdoge_contract = ScholarDogeToken.bind(Address.fromString(SDOGE_CONTRACT))
    let total_supply = toDecimal(sdoge_contract.totalSupply(), 9)
    log.debug("Total Supply {}", [total_supply.toString()])
    return total_supply
}

function getCriculatingSupply(transaction: Transaction, total_supply: BigDecimal): BigDecimal{
    let circ_supply = BigDecimal.fromString("0")
    if(transaction.blockNumber.gt(BigInt.fromString(CIRCULATING_SUPPLY_CONTRACT_BLOCK))){
        let circulatingsupply_contract = CirculatingSupply.bind(Address.fromString(CIRCULATING_SUPPLY_CONTRACT))
        circ_supply = toDecimal(circulatingsupply_contract.SDOGECirculatingSupply(), 9)
    }
    else{
        circ_supply = total_supply;
    }
    log.debug("Circulating Supply {}", [total_supply.toString()])
    return circ_supply
}

function getSsdogeSupply(transaction: Transaction): BigDecimal{
    let ssdoge_supply = BigDecimal.fromString("0")

    if(transaction.blockNumber.gt(BigInt.fromString(SSDOGE_CONTRACT_BLOCK))){
        let ssdoge_contract = StakedScholarDogeToken.bind(Address.fromString(SSDOGE_CONTRACT))
        ssdoge_supply = ssdoge_supply.plus(toDecimal(ssdoge_contract.circulatingSupply(), 9))
    }
    
    log.debug("SSDOGE Supply {}", [ssdoge_supply.toString()])
    return ssdoge_supply
}

function getMV_RFV(transaction: Transaction): BigDecimal[]{
    let BUSD = BEP20.bind(Address.fromString(BUSD_CONTRACT))
    let WBNB = BEP20.bind(Address.fromString(WBNB_CONTRACT))

    let SDOGEBUSDPair = PancakePair.bind(Address.fromString(SDOGE_BUSD_PAIR_CONTRACT))

    let treasury_address = TREASURY_ADDRESS;

    // Updates mechanisms (v2, v3...)
    // if(transaction.blockNumber.gt(BigInt.fromString(TREASURY_ADDRESS))){
    //     treasury_address = TREASURY_ADDRESS;
    // }

    let BUSDBalance = BUSD.balanceOf(Address.fromString(treasury_address))
    let WBNBBalance = WBNB.balanceOf(Address.fromString(treasury_address))
    let WBNB_value = toDecimal(WBNBBalance, 18).times(getBNBUSDRate())

    //SDOGEBUSD
    let SDOGEBUSDBalance = SDOGEBUSDPair.balanceOf(Address.fromString(treasury_address))
    let SDOGEBUSDTotalLP = toDecimal(SDOGEBUSDPair.totalSupply(), 18)
    let SDOGEBUSDPOL = toDecimal(SDOGEBUSDBalance, 18).div(SDOGEBUSDTotalLP).times(BigDecimal.fromString("100"))
    let SDOGEBUSD_value = getPairUSD(SDOGEBUSDBalance, SDOGE_BUSD_PAIR_CONTRACT)
    let SDOGEBUSD_rfv = getDiscountedPairUSD(SDOGEBUSDBalance, SDOGE_BUSD_PAIR_CONTRACT)

    let stableValue = BUSDBalance
    let stableValueDecimal = toDecimal(stableValue, 18)

    let lpValue = SDOGEBUSD_value
    let rfvLpValue = SDOGEBUSD_rfv

    let mv = stableValueDecimal.plus(lpValue).plus(WBNB_value)
    let rfv = stableValueDecimal.plus(rfvLpValue)

    log.debug("Treasury Market Value {}", [mv.toString()])
    log.debug("Treasury RFV {}", [rfv.toString()])
    log.debug("Treasury BUSD value {}", [toDecimal(BUSDBalance, 18).toString()])
    log.debug("Treasury WBNB value {}", [WBNB_value.toString()])
    log.debug("Treasury SDOGE-BUSD RFV {}", [SDOGEBUSD_rfv.toString()])

    return [
        mv, 
        rfv,
        // treasuryDaiRiskFreeValue = BUSD RFV * BUSD
        SDOGEBUSD_rfv.plus(toDecimal(BUSDBalance, 18)),
        // treasuryBUSDMarketValue = BUSD LP * BUSD
        SDOGEBUSD_value.plus(toDecimal(BUSDBalance, 18)),
        // POL
        SDOGEBUSDPOL
    ]
}

function getNextSDOGERebase(transaction: Transaction): BigDecimal{
    let next_distribution = BigDecimal.fromString("0")

    if(transaction.blockNumber.gt(BigInt.fromString(STAKING_CONTRACT_BLOCK))){
        let staking_contract = Staking.bind(Address.fromString(STAKING_CONTRACT))
        let distribution = toDecimal(staking_contract.epoch().value3,9)
        log.debug("next_distribution v2 {}", [distribution.toString()])
        next_distribution = next_distribution.plus(distribution)
    }

    log.debug("next_distribution total {}", [next_distribution.toString()])

    return next_distribution
}

function getAPY_Rebase(sOHM: BigDecimal, distributedOHM: BigDecimal): BigDecimal[]{
    let nextEpochRebase = distributedOHM.div(sOHM).times(BigDecimal.fromString("100"));

    let nextEpochRebase_number = Number.parseFloat(nextEpochRebase.toString())
    let currentAPY = Math.pow(((nextEpochRebase_number/100)+1), (365*3)-1)*100

    let currentAPYdecimal = BigDecimal.fromString(currentAPY.toString())

    log.debug("next_rebase {}", [nextEpochRebase.toString()])
    log.debug("current_apy total {}", [currentAPYdecimal.toString()])

    return [currentAPYdecimal, nextEpochRebase]
}

export function updateProtocolMetrics(transaction: Transaction): void{
    let pm = loadOrCreateProtocolMetric(transaction.timestamp);

    //Total Supply
    pm.totalSupply = getTotalSupply()

    //Circ Supply
    pm.sdogeCirculatingSupply = getCriculatingSupply(transaction, pm.totalSupply)

    //SSDOGE Supply
    pm.ssdogeCirculatingSupply = getSsdogeSupply(transaction)

    //SDOGE Price
    pm.sdogePrice = getSDOGEUSDRate()

    //SDOGE Market Cap
    pm.marketCap = pm.sdogeCirculatingSupply.times(pm.sdogePrice)

    //Total Value Locked
    pm.totalValueLocked = pm.ssdogeCirculatingSupply.times(pm.sdogePrice)

    //Treasury RFV and MV
    let mv_rfv = getMV_RFV(transaction)
    pm.treasuryMarketValue = mv_rfv[0]
    pm.treasuryRiskFreeValue = mv_rfv[1]
    pm.treasuryBUSDRiskFreeValue = mv_rfv[2]
    pm.treasuryBUSDMarketValue = mv_rfv[3]
    pm.treasurySDOGEBUSDPOL = mv_rfv[4]

    // Rebase rewards, APY, rebase
    pm.nextDistributedSdoge = getNextSDOGERebase(transaction)
    let apy_rebase = getAPY_Rebase(pm.ssdogeCirculatingSupply, pm.nextDistributedSdoge)
    pm.currentAPY = apy_rebase[0]
    pm.nextEpochRebase = apy_rebase[1]

    //Holders
    pm.holders = getHolderAux().value
    
    pm.save()
    
    updateBondDiscounts(transaction)
}