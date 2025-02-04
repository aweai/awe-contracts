
import * as anchor from "@coral-xyz/anchor"
import { batchTransferAweToken } from "./awe_token"
import * as dotenv from "dotenv"
import { PublicKey } from "@solana/web3.js"
import { promises as fs } from 'fs'
import { parse } from 'csv-parse/sync'

const batchSize = 10
const startIdx = 0
const waitInterval = 30

const isValidRecord = (record) => {
    const address = record[0]
    const amount = record[1]

    try {
        const pubkey = new PublicKey(address)
        if(!PublicKey.isOnCurve(pubkey.toBuffer())) {
            console.error("Invalid public key: " + record[0])
            return false
        }

        const amountBN = new anchor.BN(amount)
        if(!amountBN.gt(new anchor.BN(0))) {
            console.error("Invalid amount: " + record[1])
            return false
        }

    } catch (e) {
        console.error(e)
        return false
    }

    return true
}

const sleep = (seconds) => {
    return new Promise((resolve) => {
      setTimeout(resolve, seconds * 1000);
    });
}

(async () => {
    dotenv.config({ path: ".env" })

    const provider = anchor.AnchorProvider.env()
    anchor.setProvider(provider)

    if (!process.env["AWE_MINT_ADDRESS"]) {
        throw Error("No AWE Mint Address specified")
    }

    const aweMintAddress = new PublicKey(process.env["AWE_MINT_ADDRESS"])
    console.log("Awe Mint Address: ", aweMintAddress.toBase58())

    const fileContent = await fs.readFile("airdrop.csv")
    const records = parse(fileContent, {skip_empty_lines: true})

    console.log("Validating CSV file...")

    let totalAddresses = 0
    let totalAmount = new anchor.BN(0)

    for(let i=0,l=records.length; i<l; i++) {
        const record = records[i]

        if(!isValidRecord(record)) {
            console.error("Invalid CSV file at line " + (i+1))
            return
        }

        totalAmount = totalAmount.add(new anchor.BN(record[1]))
        totalAddresses++
    }

    console.log("CSV file is valid!")
    console.log("Total addresses validated: " + totalAddresses)
    console.log("Total amount validated: " + totalAmount.toString(10))

    let currentRecordIdx = startIdx
    let totalTxs = 0
    totalAddresses = 0
    totalAmount = new anchor.BN(0)

    while(currentRecordIdx < records.length) {

        const batchEnd = currentRecordIdx + batchSize < records.length && currentRecordIdx + batchSize || records.length

        console.log("Batch transferring...... (" + currentRecordIdx + ", " + batchEnd + ")")

        const addresses = []
        const amounts = []

        for(let i=currentRecordIdx; i<batchEnd; i++) {
            const record = records[i]
            addresses.push(record[0])

            let amount = new anchor.BN(record[1] + "000000000")
            amounts.push(amount)

            totalAddresses++
            totalAmount = totalAmount.add(amount)
        }

        const tx = await batchTransferAweToken(
            aweMintAddress,
            addresses,
            amounts,
            provider
        )

        console.log("Transaction sent!")
        console.log(tx)

        currentRecordIdx = batchEnd
        totalTxs++

        await sleep(waitInterval)
    }

    console.log("Batch transfer completed!")
    console.log("Total addresses transferred: " + totalAddresses)
    console.log("Total amount transferred: " + totalAmount.toString(10))

})().catch((e) => console.log(e))
