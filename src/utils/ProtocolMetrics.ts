import { Address, BigDecimal, BigInt, log} from '@graphprotocol/graph-ts'
import { ScholarDAOToken } from '../../generated/Staking/ScholarDAOToken';
import { StakedScholarDAOToken } from '../../generated/Staking/StakedScholarDAOToken';
import { CirculatingSupply } from '../../generated/Staking/CirculatingSupply';
import { BEP20 } from '../../generated/Staking/BEP20';
import { PancakePair } from '../../generated/Staking/PancakePair';
import { Staking } from '../../generated/Staking/Staking';

import { ProtocolMetric, Transaction } from '../../generated/schema'
import {
    CIRCULATING_SUPPLY_CONTRACT,
    CIRCULATING_SUPPLY_CONTRACT_BLOCK,
    USDC_CONTRACT,
    SDAO_CONTRACT,
    SSDAO_CONTRACT,
    SSDAO_CONTRACT_BLOCK,
    STAKING_CONTRACT,
    STAKING_CONTRACT_BLOCK,
    SDAO_USDC_PAIR_CONTRACT,
    TREASURY_ADDRESS,
    WFTM_CONTRACT, DAI_CONTRACT
} from './Constants';
import { dayFromTimestamp } from './Dates';
import { toDecimal } from './Decimals';
import { 
    getSDAOUSDRate,
    getDiscountedPairUSD,
    getPairUSD,
    getFTMUSDCRate,
    getPairWFTM
} from './Price';
import { updateBondDiscounts } from './BondDiscounts';
import {getHolderAux} from "./Aux";

export function loadOrCreateProtocolMetric(timestamp: BigInt): ProtocolMetric{
    let dayTimestamp = dayFromTimestamp(timestamp);

    let protocolMetric = ProtocolMetric.load(dayTimestamp)
    if (protocolMetric == null) {
        protocolMetric = new ProtocolMetric(dayTimestamp)
        protocolMetric.timestamp = timestamp
        protocolMetric.sdaoCirculatingSupply = BigDecimal.fromString("0")
        protocolMetric.ssdaoCirculatingSupply = BigDecimal.fromString("0")
        protocolMetric.totalSupply = BigDecimal.fromString("0")
        protocolMetric.sdaoPrice = BigDecimal.fromString("0")
        protocolMetric.marketCap = BigDecimal.fromString("0")
        protocolMetric.totalValueLocked = BigDecimal.fromString("0")
        protocolMetric.treasuryRiskFreeValue = BigDecimal.fromString("0")
        protocolMetric.treasuryMarketValue = BigDecimal.fromString("0")
        protocolMetric.nextEpochRebase = BigDecimal.fromString("0")
        protocolMetric.nextDistributedSDAO = BigDecimal.fromString("0")
        protocolMetric.currentAPY = BigDecimal.fromString("0")
        protocolMetric.treasuryUSDCRiskFreeValue = BigDecimal.fromString("0")
        protocolMetric.treasuryUSDCMarketValue = BigDecimal.fromString("0")
        protocolMetric.treasurySDAOUSDCPOL = BigDecimal.fromString("0")
        protocolMetric.holders = BigInt.fromI32(0)

        protocolMetric.save()
    }
    return protocolMetric as ProtocolMetric
}


function getTotalSupply(): BigDecimal{
    let sdao_contract = ScholarDAOToken.bind(Address.fromString(SDAO_CONTRACT))
    let total_supply = toDecimal(sdao_contract.totalSupply(), 9)
    log.debug("Total Supply {}", [total_supply.toString()])
    return total_supply
}

function getCriculatingSupply(transaction: Transaction, total_supply: BigDecimal): BigDecimal{
    let circ_supply = BigDecimal.fromString("0")
    if(transaction.blockNumber.gt(BigInt.fromString(CIRCULATING_SUPPLY_CONTRACT_BLOCK))){
        let circulatingsupply_contract = CirculatingSupply.bind(Address.fromString(CIRCULATING_SUPPLY_CONTRACT))
        circ_supply = toDecimal(circulatingsupply_contract.SDAOCirculatingSupply(), 9)
    }
    else{
        circ_supply = total_supply;
    }
    log.debug("Circulating Supply {}", [total_supply.toString()])
    return circ_supply
}

function getSsdaoSupply(transaction: Transaction): BigDecimal{
    let ssdao_supply = BigDecimal.fromString("0")

    if(transaction.blockNumber.gt(BigInt.fromString(SSDAO_CONTRACT_BLOCK))){
        let ssdao_contract = StakedScholarDAOToken.bind(Address.fromString(SSDAO_CONTRACT))
        ssdao_supply = ssdao_supply.plus(toDecimal(ssdao_contract.circulatingSupply(), 9))
    }
    
    log.debug("SSDAO Supply {}", [ssdao_supply.toString()])
    return ssdao_supply
}

function getMV_RFV(transaction: Transaction): BigDecimal[]{
    let USDC = BEP20.bind(Address.fromString(USDC_CONTRACT))
    let DAI = BEP20.bind(Address.fromString(DAI_CONTRACT))
    let WFTM = BEP20.bind(Address.fromString(WFTM_CONTRACT))

    let SDAOUSDCPair = PancakePair.bind(Address.fromString(SDAO_USDC_PAIR_CONTRACT))

    let treasury_address = TREASURY_ADDRESS;

    // Updates mechanisms (v2, v3...)
    // if(transaction.blockNumber.gt(BigInt.fromString(TREASURY_ADDRESS))){
    //     treasury_address = TREASURY_ADDRESS;
    // }

    let USDCBalance = USDC.balanceOf(Address.fromString(treasury_address))
    let DAIBalance = DAI.balanceOf(Address.fromString(treasury_address))
    let WFTMBalance = WFTM.balanceOf(Address.fromString(treasury_address))
    let WFTM_value = toDecimal(WFTMBalance, 18).times(getFTMUSDCRate())

    //SDAOUSDC
    let SDAOUSDCBalance = SDAOUSDCPair.balanceOf(Address.fromString(treasury_address))
    let SDAOUSDCTotalLP = toDecimal(SDAOUSDCPair.totalSupply(), 18)
    let SDAOUSDCPOL = toDecimal(SDAOUSDCBalance, 18).div(SDAOUSDCTotalLP).times(BigDecimal.fromString("100"))
    let SDAOUSDC_value = getPairUSD(SDAOUSDCBalance, SDAO_USDC_PAIR_CONTRACT)
    let SDAOUSDC_rfv = getDiscountedPairUSD(SDAOUSDCBalance, SDAO_USDC_PAIR_CONTRACT)

    let stableValueDecimal = toDecimal(USDCBalance, 6).plus(toDecimal(DAIBalance, 18))

    let lpValue = SDAOUSDC_value
    let rfvLpValue = SDAOUSDC_rfv

    let mv = stableValueDecimal.plus(lpValue).plus(WFTM_value)
    let rfv = stableValueDecimal.plus(rfvLpValue)

    log.debug("Treasury Market Value {}", [mv.toString()])
    log.debug("Treasury RFV {}", [rfv.toString()])
    log.debug("Treasury USDC value {}", [toDecimal(USDCBalance, 6).toString()])
    log.debug("Treasury DAI value {}", [toDecimal(DAIBalance, 18).toString()])
    log.debug("Treasury WFTM value {}", [WFTM_value.toString()])
    log.debug("Treasury SDAO-USDC RFV {}", [SDAOUSDC_rfv.toString()])

    return [
        mv, 
        rfv,
        // treasuryUSDCRiskFreeValue = USDC RFV * USDC
        SDAOUSDC_rfv.plus(toDecimal(USDCBalance, 6)),
        // treasuryUSDCMarketValue = USDC LP * USDC
        SDAOUSDC_value.plus(toDecimal(USDCBalance, 6)),
        // treasuryDAIRiskFreeValue = DAI RFV * DAI
        SDAOUSDC_rfv.plus(toDecimal(DAIBalance, 18)),
        // treasuryUSDCMarketValue = DAI LP * DAI
        SDAOUSDC_value.plus(toDecimal(DAIBalance, 18)),
        // POL
        SDAOUSDCPOL
    ]
}

function getNextSDAORebase(transaction: Transaction): BigDecimal{
    let next_distribution = BigDecimal.fromString("0")

    if(transaction.blockNumber.gt(BigInt.fromString(STAKING_CONTRACT_BLOCK))){
        let staking_contract = Staking.bind(Address.fromString(STAKING_CONTRACT))
        let distribution = toDecimal(staking_contract.epoch().value3,9)
        log.debug("next_distribution {}", [distribution.toString()])
        next_distribution = next_distribution.plus(distribution)
    }

    log.debug("next_distribution total {}", [next_distribution.toString()])

    return next_distribution
}

function getAPY_Rebase(ssdao: BigDecimal, distributedSDAO: BigDecimal): BigDecimal[]{
    let nextEpochRebase = distributedSDAO.div(ssdao).times(BigDecimal.fromString("100"));

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
    pm.sdaoCirculatingSupply = getCriculatingSupply(transaction, pm.totalSupply)

    //SSDAO Supply
    pm.ssdaoCirculatingSupply = getSsdaoSupply(transaction)

    //SDAO Price
    pm.sdaoPrice = getSDAOUSDRate()

    //SDAO Market Cap
    pm.marketCap = pm.sdaoCirculatingSupply.times(pm.sdaoPrice)

    //Total Value Locked
    pm.totalValueLocked = pm.ssdaoCirculatingSupply.times(pm.sdaoPrice)

    //Treasury RFV and MV
    let mv_rfv = getMV_RFV(transaction)
    pm.treasuryMarketValue = mv_rfv[0]
    pm.treasuryRiskFreeValue = mv_rfv[1]
    pm.treasuryUSDCRiskFreeValue = mv_rfv[2]
    pm.treasuryUSDCMarketValue = mv_rfv[3]
    pm.treasuryDAIRiskFreeValue = mv_rfv[4]
    pm.treasuryDAIMarketValue = mv_rfv[5]
    pm.treasurySDAOUSDCPOL = mv_rfv[6]

    // Rebase rewards, APY, rebase
    pm.nextDistributedSDAO = getNextSDAORebase(transaction)
    let apy_rebase = getAPY_Rebase(pm.ssdaoCirculatingSupply, pm.nextDistributedSDAO)
    pm.currentAPY = apy_rebase[0]
    pm.nextEpochRebase = apy_rebase[1]

    //Holders
    pm.holders = getHolderAux().value
    
    pm.save()
    
    updateBondDiscounts(transaction)
}