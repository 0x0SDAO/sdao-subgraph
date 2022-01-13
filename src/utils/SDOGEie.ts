import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
import { SDOGEie, Transaction } from '../../generated/schema'
import { ScholarDogeToken } from '../../generated/BUSDBond/ScholarDogeToken'
import { StakedScholarDogeToken } from '../../generated/BUSDBond/StakedScholarDogeToken'
import { BUSDBond } from '../../generated/BUSDBond/BUSDBond'
import { SDOGEBUSDBond } from '../../generated/BUSDBond/SDOGEBUSDBond'
import { WBNBBond } from '../../generated/BUSDBond/WBNBBond'

import {
    BUSDBOND_CONTRACT,
    BUSDBOND_CONTRACT_BLOCK,
    SDOGEBUSDBOND_CONTRACT,
    SDOGEBUSDBOND_CONTRACT_BLOCK,
    WBNBBOND_CONTRACT,
    WBNBBOND_CONTRACT_BLOCK,
    SDOGE_CONTRACT,
    SSDOGE_CONTRACT,
    SSDOGE_CONTRACT_BLOCK
} from '../utils/Constants'
import { loadOrCreateSDOGEieBalance } from './SDOGEieBalances'
import { toDecimal } from './Decimals'
import { getSDOGEUSDRate } from './Price'
import { loadOrCreateContractInfo } from './ContractInfo'
import { getHolderAux } from './Aux'

export function loadOrCreateSDOGEie(addres: Address): SDOGEie{
    let sdogeie = SDOGEie.load(addres.toHex())
    if (sdogeie == null) {
        let holders = getHolderAux()
        holders.value = holders.value.plus(BigInt.fromI32(1))
        holders.save()

        sdogeie = new SDOGEie(addres.toHex())
        sdogeie.active = true
        sdogeie.save()
    }
    return sdogeie as SDOGEie
}

export function updateSDOGEieBalance(sdogeie: SDOGEie, transaction: Transaction): void{

    let balance = loadOrCreateSDOGEieBalance(sdogeie, transaction.timestamp)

    let sdoge_contract = ScholarDogeToken.bind(Address.fromString(SDOGE_CONTRACT))
    let ssdoge_contract = StakedScholarDogeToken.bind(Address.fromString(SSDOGE_CONTRACT))
    balance.sdogeBalance = toDecimal(sdoge_contract.balanceOf(Address.fromString(sdogeie.id)), 9)
    let ssdogeBalance = toDecimal(ssdoge_contract.balanceOf(Address.fromString(sdogeie.id)), 9)
    balance.ssdogeBalance = ssdogeBalance

    let stakes = balance.stakes

    if(transaction.blockNumber.gt(BigInt.fromString(SSDOGE_CONTRACT_BLOCK))) {
        let cinfoSsdogeBalance = loadOrCreateContractInfo(sdogeie.id + transaction.timestamp.toString() + "sScholarDogeToken")
        cinfoSsdogeBalance.name = "sOHM"
        cinfoSsdogeBalance.contract = SSDOGE_CONTRACT
        cinfoSsdogeBalance.amount = ssdogeBalance
        cinfoSsdogeBalance.save()
        stakes.push(cinfoSsdogeBalance.id)
    }

    balance.stakes = stakes

    if(sdogeie.active && balance.sdogeBalance.lt(BigDecimal.fromString("0.01")) && balance.ssdogeBalance.lt(BigDecimal.fromString("0.01"))){
        let holders = getHolderAux()
        holders.value = holders.value.minus(BigInt.fromI32(1))
        holders.save()
        sdogeie.active = false
    } else if(sdogeie.active==false && (balance.sdogeBalance.gt(BigDecimal.fromString("0.01")) || balance.ssdogeBalance.gt(BigDecimal.fromString("0.01")))){
        let holders = getHolderAux()
        holders.value = holders.value.plus(BigInt.fromI32(1))
        holders.save()
        sdogeie.active = true
    }

    //SDOGE-BUSD
    let bonds = balance.bonds
    if(transaction.blockNumber.gt(BigInt.fromString(SDOGEBUSDBOND_CONTRACT_BLOCK))){
        let bondSDOGEBUSD_contract = SDOGEBUSDBond.bind(Address.fromString(SDOGEBUSDBOND_CONTRACT))
        let pending = bondSDOGEBUSD_contract.bondInfo(Address.fromString(sdogeie.id))
        if (pending.value1.gt(BigInt.fromString("0"))){
            let pending_bond = toDecimal(pending.value1, 9)
            balance.bondBalance = balance.bondBalance.plus(pending_bond)

            let binfo = loadOrCreateContractInfo(sdogeie.id + transaction.timestamp.toString() + "SDOGEBUSDBond")
            binfo.name = "SDOGE-BUSD"
            binfo.contract = SDOGEBUSDBOND_CONTRACT
            binfo.amount = pending_bond
            binfo.save()
            bonds.push(binfo.id)

            log.debug("SDOGEie {} pending SDOGEBUSDBond {} on tx {}", [sdogeie.id, toDecimal(pending.value1, 9).toString(), transaction.id])
        }
    }
    //BUSD
    if(transaction.blockNumber.gt(BigInt.fromString(BUSDBOND_CONTRACT_BLOCK))){
        let bondBUSD_contract = BUSDBond.bind(Address.fromString(BUSDBOND_CONTRACT))
        let pending = bondBUSD_contract.bondInfo(Address.fromString(sdogeie.id))
        if (pending.value1.gt(BigInt.fromString("0"))){
            let pending_bond = toDecimal(pending.value1, 9)
            balance.bondBalance = balance.bondBalance.plus(pending_bond)

            let binfo = loadOrCreateContractInfo(sdogeie.id + transaction.timestamp.toString() + "BUSDBond")
            binfo.name = "BUSD"
            binfo.contract = BUSDBOND_CONTRACT
            binfo.amount = pending_bond
            binfo.save()
            bonds.push(binfo.id)

            log.debug("SDOGEie {} pending BUSDBond {} on tx {}", [sdogeie.id, toDecimal(pending.value1, 9).toString(), transaction.id])
        }
    }
    //WBNB
    if(transaction.blockNumber.gt(BigInt.fromString(WBNBBOND_CONTRACT_BLOCK))){
        let bondETH_contract = WBNBBond.bind(Address.fromString(WBNBBOND_CONTRACT))
        let pending = bondETH_contract.bondInfo(Address.fromString(sdogeie.id))
        if (pending.value1.gt(BigInt.fromString("0"))){
            let pending_bond = toDecimal(pending.value1, 9)
            balance.bondBalance = balance.bondBalance.plus(pending_bond)

            let binfo = loadOrCreateContractInfo(sdogeie.id + transaction.timestamp.toString() + "WBNBBond")
            binfo.name = "WBNB"
            binfo.contract = WBNBBOND_CONTRACT
            binfo.amount = pending_bond
            binfo.save()
            bonds.push(binfo.id)

            log.debug("SDOGEie {} pending WBNB {} on tx {}", [sdogeie.id, toDecimal(pending.value1, 9).toString(), transaction.id])
        }
    }
    balance.bonds = bonds

    //Price
    let usdRate = getSDOGEUSDRate()
    balance.dollarBalance = balance.sdogeBalance.times(usdRate).plus(balance.ssdogeBalance.times(usdRate)).plus(balance.bondBalance.times(usdRate))
    balance.save()

    sdogeie.lastBalance = balance.id;
    sdogeie.save()
}