import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
import { SDAOie, Transaction } from '../../generated/schema'
import { ScholarDAOToken } from '../../generated/USDCBond/ScholarDAOToken'
import { StakedScholarDAOToken } from '../../generated/USDCBond/StakedScholarDAOToken'
import { USDCBond } from '../../generated/USDCBond/USDCBond'
import { SDAOUSDCBond } from '../../generated/USDCBond/SDAOUSDCBond'
import { WFTMBond } from '../../generated/USDCBond/WFTMBond'

import {
    USDCBOND_CONTRACT,
    USDCBOND_CONTRACT_BLOCK,
    SDAOUSDCBOND_CONTRACT,
    SDAOUSDCBOND_CONTRACT_BLOCK,
    WFTMBOND_CONTRACT,
    WFTMBOND_CONTRACT_BLOCK,
    SDAO_CONTRACT,
    SSDAO_CONTRACT,
    SSDAO_CONTRACT_BLOCK,
    DAIBOND_CONTRACT_BLOCK,
    DAIBOND_CONTRACT
} from '../utils/Constants'
import { loadOrCreateSDAOieBalance } from './SDAOieBalances'
import { toDecimal } from './Decimals'
import { getSDAOUSDRate } from './Price'
import { loadOrCreateContractInfo } from './ContractInfo'
import { getHolderAux } from './Aux'

export function loadOrCreateSDAOie(addres: Address): SDAOie{
    let sdaoie = SDAOie.load(addres.toHex())
    if (sdaoie == null) {
        let holders = getHolderAux()
        holders.value = holders.value.plus(BigInt.fromI32(1))
        holders.save()

        sdaoie = new SDAOie(addres.toHex())
        sdaoie.active = true
        sdaoie.save()
    }
    return sdaoie as SDAOie
}

export function updateSDAOieBalance(sdaoie: SDAOie, transaction: Transaction): void{
    let balance = loadOrCreateSDAOieBalance(sdaoie, transaction.timestamp)

    let sdao_contract = ScholarDAOToken.bind(Address.fromString(SDAO_CONTRACT))
    let ssdao_contract = StakedScholarDAOToken.bind(Address.fromString(SSDAO_CONTRACT))
    balance.sdaoBalance = toDecimal(sdao_contract.balanceOf(Address.fromString(sdaoie.id)), 9)
    let ssdaoBalance = toDecimal(ssdao_contract.balanceOf(Address.fromString(sdaoie.id)), 9)
    balance.ssdaoBalance = ssdaoBalance

    let stakes = balance.stakes

    if(transaction.blockNumber.gt(BigInt.fromString(SSDAO_CONTRACT_BLOCK))) {
        let cinfoSsdaoBalance = loadOrCreateContractInfo(sdaoie.id + transaction.timestamp.toString() + "StakedScholarDAOToken")
        cinfoSsdaoBalance.name = "SSDAO"
        cinfoSsdaoBalance.contract = SSDAO_CONTRACT
        cinfoSsdaoBalance.amount = ssdaoBalance
        cinfoSsdaoBalance.save()
        stakes.push(cinfoSsdaoBalance.id)
    }

    balance.stakes = stakes

    if(sdaoie.active && balance.sdaoBalance.lt(BigDecimal.fromString("0.01")) && balance.ssdaoBalance.lt(BigDecimal.fromString("0.01"))){
        let holders = getHolderAux()
        holders.value = holders.value.minus(BigInt.fromI32(1))
        holders.save()
        sdaoie.active = false
    } else if(sdaoie.active==false && (balance.sdaoBalance.gt(BigDecimal.fromString("0.01")) || balance.ssdaoBalance.gt(BigDecimal.fromString("0.01")))){
        let holders = getHolderAux()
        holders.value = holders.value.plus(BigInt.fromI32(1))
        holders.save()
        sdaoie.active = true
    }

    //SDAO-USDC
    let bonds = balance.bonds
    if(transaction.blockNumber.gt(BigInt.fromString(SDAOUSDCBOND_CONTRACT_BLOCK))){
        let bondSDAOUSDC_contract = SDAOUSDCBond.bind(Address.fromString(SDAOUSDCBOND_CONTRACT))
        let pending = bondSDAOUSDC_contract.bondInfo(Address.fromString(sdaoie.id))
        if (pending.value1.gt(BigInt.fromString("0"))){
            let pending_bond = toDecimal(pending.value1, 9)
            balance.bondBalance = balance.bondBalance.plus(pending_bond)

            let binfo = loadOrCreateContractInfo(sdaoie.id + transaction.timestamp.toString() + "SDAOUSDCBond")
            binfo.name = "SDAO-USDC"
            binfo.contract = SDAOUSDCBOND_CONTRACT
            binfo.amount = pending_bond
            binfo.save()
            bonds.push(binfo.id)

            log.debug("SDAOie {} pending SDAOUSDCBond {} on tx {}", [sdaoie.id, toDecimal(pending.value1, 9).toString(), transaction.id])
        }
    }
    //USDC
    if(transaction.blockNumber.gt(BigInt.fromString(USDCBOND_CONTRACT_BLOCK))){
        let bondUSDC_contract = USDCBond.bind(Address.fromString(USDCBOND_CONTRACT))
        let pending = bondUSDC_contract.bondInfo(Address.fromString(sdaoie.id))
        if (pending.value1.gt(BigInt.fromString("0"))){
            let pending_bond = toDecimal(pending.value1, 9)
            balance.bondBalance = balance.bondBalance.plus(pending_bond)

            let binfo = loadOrCreateContractInfo(sdaoie.id + transaction.timestamp.toString() + "USDCBond")
            binfo.name = "USDC"
            binfo.contract = USDCBOND_CONTRACT
            binfo.amount = pending_bond
            binfo.save()
            bonds.push(binfo.id)

            log.debug("SDAOie {} pending USDCBond {} on tx {}", [sdaoie.id, toDecimal(pending.value1, 9).toString(), transaction.id])
        }
    }
    //DAI
    if(transaction.blockNumber.gt(BigInt.fromString(DAIBOND_CONTRACT_BLOCK))){
        let bondDAI_contract = DAIBond.bind(Address.fromString(DAIBOND_CONTRACT))
        let pending = bondDAI_contract.bondInfo(Address.fromString(sdaoie.id))
        if (pending.value1.gt(BigInt.fromString("0"))){
            let pending_bond = toDecimal(pending.value1, 9)
            balance.bondBalance = balance.bondBalance.plus(pending_bond)

            let binfo = loadOrCreateContractInfo(sdaoie.id + transaction.timestamp.toString() + "DAIBond")
            binfo.name = "DAI"
            binfo.contract = DAIBOND_CONTRACT
            binfo.amount = pending_bond
            binfo.save()
            bonds.push(binfo.id)

            log.debug("SDAOie {} pending DAIBond {} on tx {}", [sdaoie.id, toDecimal(pending.value1, 9).toString(), transaction.id])
        }
    }
    //WFTM
    if(transaction.blockNumber.gt(BigInt.fromString(WFTMBOND_CONTRACT_BLOCK))){
        let bondFTM_contract = WFTMBond.bind(Address.fromString(WFTMBOND_CONTRACT))
        let pending = bondFTM_contract.bondInfo(Address.fromString(sdaoie.id))
        if (pending.value1.gt(BigInt.fromString("0"))){
            let pending_bond = toDecimal(pending.value1, 9)
            balance.bondBalance = balance.bondBalance.plus(pending_bond)

            let binfo = loadOrCreateContractInfo(sdaoie.id + transaction.timestamp.toString() + "WFTMBond")
            binfo.name = "WFTM"
            binfo.contract = WFTMBOND_CONTRACT
            binfo.amount = pending_bond
            binfo.save()
            bonds.push(binfo.id)

            log.debug("SDAOie {} pending WFTM {} on tx {}", [sdaoie.id, toDecimal(pending.value1, 9).toString(), transaction.id])
        }
    }
    balance.bonds = bonds

    //Price
    let usdRate = getSDAOUSDRate()
    balance.dollarBalance = balance.sdaoBalance.times(usdRate).plus(balance.ssdaoBalance.times(usdRate)).plus(balance.bondBalance.times(usdRate))
    balance.save()

    sdaoie.lastBalance = balance.id;
    sdaoie.save()
}