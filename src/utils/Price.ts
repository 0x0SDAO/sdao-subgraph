import {
    SDAO_DAI_PAIR_CONTRACT,
    WFTM_USDC_PAIR_CONTRACT
} from './Constants'
import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
import { UniswapV2Pair } from '../../generated/Staking/UniswapV2Pair';
import { toDecimal } from './Decimals'

const BIG_DECIMAL_1E6 = BigDecimal.fromString('1e6')
const BIG_DECIMAL_1E9 = BigDecimal.fromString('1e9')
const BIG_DECIMAL_1E18 = BigDecimal.fromString('1e18')

export function getFTMDAIRate(): BigDecimal {
    const pair = UniswapV2Pair.bind(Address.fromString(WFTM_USDC_PAIR_CONTRACT))

    const reserves = pair.getReserves()
    const reserve0 = reserves.value0.toBigDecimal()
    const reserve1 = reserves.value1.toBigDecimal()
    // TODO: set decimals to 6 below ?
    let ftmRate = reserve0.div(reserve1)
    log.debug("FTM rate {}", [ftmRate.toString()])
    
    return ftmRate
}

export function getSDAODAIRate(): BigDecimal {
    let pair = UniswapV2Pair.bind(Address.fromString(SDAO_DAI_PAIR_CONTRACT))

    let reserves = pair.getReserves()
    let reserve0 = reserves.value0.toBigDecimal()
    let reserve1 = reserves.value1.toBigDecimal()
    // TODO: see value to set below ?
    let sdaoRate = reserve0.div(reserve1).div(BIG_DECIMAL_1E9.div(BIG_DECIMAL_1E18))
    log.debug("SDAO rate {}", [sdaoRate.toString()])

    return sdaoRate
}

// TODO: SEE if need to fix calculation below
//(slp_treasury/slp_supply)*(2*sqrt(lp_dai * lp_sdao))
export function getDiscountedPairDAI(lp_amount: BigInt, pair_adress: string): BigDecimal{
    let pair = UniswapV2Pair.bind(Address.fromString(pair_adress))

    let total_lp = pair.totalSupply()
    let lp_token_1 = toDecimal(pair.getReserves().value0, 6)
    let lp_token_2 = toDecimal(pair.getReserves().value1, 9)
    let kLast = lp_token_1.times(lp_token_2).truncate(0).digits

    let part1 = toDecimal(lp_amount,18).div(toDecimal(total_lp,18))
    let two = BigInt.fromI32(2)

    let sqrt = kLast.sqrt();
    let part2 = toDecimal(two.times(sqrt), 0)
    return part1.times(part2)
}

export function getPairDAI(lp_amount: BigInt, pair_adress: string): BigDecimal{
    let pair = UniswapV2Pair.bind(Address.fromString(pair_adress))
    let total_lp = pair.totalSupply()
    let lp_token_0 = pair.getReserves().value0
    let lp_token_1 = pair.getReserves().value1
    let ownedLP = toDecimal(lp_amount,18).div(toDecimal(total_lp,18))
    let sdao_value = toDecimal(lp_token_1, 9).times(getSDAODAIRate())
    let total_lp_usd = sdao_value.plus(toDecimal(lp_token_0, 18))

    return ownedLP.times(total_lp_usd)
}

export function getPairWFTM(lp_amount: BigInt, pair_adress: string): BigDecimal{
    let pair = UniswapV2Pair.bind(Address.fromString(pair_adress))
    let total_lp = pair.totalSupply()
    let lp_token_0 = pair.getReserves().value0
    let lp_token_1 = pair.getReserves().value1
    let ownedLP = toDecimal(lp_amount,18).div(toDecimal(total_lp,18))
    let sdao_value = toDecimal(lp_token_1, 9).times(getSDAODAIRate())
    let ftm_value = toDecimal(lp_token_0, 18).times(getFTMDAIRate())
    let total_lp_usd = sdao_value.plus(ftm_value)

    return ownedLP.times(total_lp_usd)
}