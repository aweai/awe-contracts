import * as anchor from "@coral-xyz/anchor"
import * as dotenv from "dotenv"
import { PublicKey } from "@solana/web3.js";
import { mintAweToken } from "./awe_token"

(async () => {
    anchor.setProvider(anchor.AnchorProvider.env());
    const provider = anchor.AnchorProvider.env()
    dotenv.config({ path: ".env" })

    if (!process.env["AWE_MINT_ADDRESS"]) {
        throw Error("No AWE Mint Address specified")
    }

    if(process.argv.length < 4) {
        throw Error("No wallet address specified!")
    }

    const aweMintAddress = new PublicKey(process.env["AWE_MINT_ADDRESS"])
    const walletPubKey = new PublicKey(process.argv[2])
    let amountBN = new anchor.BN(process.argv[3])

    console.log(`Minting ${amountBN.toString(10)} AWE tokens to wallet ${walletPubKey.toBase58()}`)

    amountBN = amountBN.mul(new anchor.BN(1e9))

    await mintAweToken(
        aweMintAddress,
        walletPubKey,
        amountBN,
        provider
    )

})().catch((e) => console.log(e))
