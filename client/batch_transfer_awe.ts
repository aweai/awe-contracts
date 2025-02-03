
import * as anchor from "@coral-xyz/anchor"
import { batchTransferAweToken } from "./awe_token"
import * as dotenv from "dotenv"
import { PublicKey } from "@solana/web3.js"
import { promises as fs } from 'fs'
import { parse } from 'csv/lib/sync'

const batchSize = 10;

(async () => {
    anchor.setProvider(anchor.AnchorProvider.env());

    const wallet = anchor.AnchorProvider.env().wallet
    const provider = anchor.AnchorProvider.env()

    dotenv.config({ path: ".env" })

    if (!process.env["AWE_MINT_ADDRESS"]) {
        throw Error("No AWE Mint Address specified")
    }

    const aweMintAddress = new PublicKey(process.env["AWE_MINT_ADDRESS"])
    console.log("Awe Mint Address: ", aweMintAddress)

    const fileContent = await fs.readFile("airdrop.csv")
    const records = parse(fileContent, {bom: true})

    let currentRecordIdx = 0

    while(currentRecordIdx < records.length) {

        const batchEnd = currentRecordIdx + batchSize < records.length && currentRecordIdx + batchSize || records.length

        const addresses = []
        const amounts = []

        for(let i=currentRecordIdx; i<batchEnd; i++) {
            const record = records[i]
            addresses.push(record[0])
            amounts.push(new anchor.BN(record[1]))
        }

        // await batchTransferAweToken(
        //     aweMintAddress,
        //     addresses,
        //     amounts,
        //     provider
        // )

        console.log(addresses)
        console.log(amounts)

        currentRecordIdx = batchEnd
    }


})().catch((e) => console.log(e))
