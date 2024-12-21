import * as anchor from "@coral-xyz/anchor"
import { createAweTokenWithMetadata, mintAweToken } from "./awe_token"
import * as dotenv from "dotenv"
import { PublicKey } from "@solana/web3.js";

(async () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const wallet = anchor.AnchorProvider.env().wallet
  const provider = anchor.AnchorProvider.env()
  dotenv.config({ path: ".env" })

  let aweMintAddress: PublicKey

  if (process.env["AWE_MINT_ADDRESS"]) {
    aweMintAddress = new PublicKey(process.env["AWE_MINT_ADDRESS"])
    console.log("Loaded Mint Address: ", aweMintAddress.toBase58())
  } else {
    aweMintAddress = await createAweTokenWithMetadata(provider)
    console.log("Created Mint Address: ", aweMintAddress.toBase58())
  }

  const amount = new anchor.BN("1000000000000")
  await mintAweToken(aweMintAddress, wallet.publicKey, amount, provider)

})().catch((e) => console.log(e))
