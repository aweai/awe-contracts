import * as anchor from "@coral-xyz/anchor"
import { getOrCreateAssociatedTokenAccount } from "./awe_token"
import { updateAweMetadataAccount, getOrCreateAweMetadataAccount } from "./awe_metadata";
import * as dotenv from "dotenv"
import { PublicKey } from "@solana/web3.js";
import type { Awe } from "../target/types/awe";

(async () => {
    anchor.setProvider(anchor.AnchorProvider.env());

    const program = anchor.workspace.Awe as anchor.Program<Awe>;
    const wallet = anchor.AnchorProvider.env().wallet
    const provider = anchor.AnchorProvider.env()
    dotenv.config({ path: ".env" })

    if (!process.env["AWE_MINT_ADDRESS"]) {
        throw Error("No AWE Mint Address specified")
    }

    const aweMintAddress = new PublicKey(process.env["AWE_MINT_ADDRESS"])
    console.log("Awe Mint Address: ", aweMintAddress)

    const collectorTokenAccount = await getOrCreateAssociatedTokenAccount(
        aweMintAddress,
        wallet.publicKey,
        provider
    )

    const aweMetadataAccount = await getOrCreateAweMetadataAccount(
        program,
        aweMintAddress,
        collectorTokenAccount.address,
        new anchor.BN("100000000000")
    )

    // const [aweMetadataAddress, _] = PublicKey.findProgramAddressSync(
    //     [Buffer.from("awe_metadata"), wallet.publicKey.toBuffer()],
    //     program.programId
    // )

    // let aweMetadataAccount = await program.account.aweMetadata.fetch(aweMetadataAddress, "confirmed");

    // console.log("Awe Metadata Account data before update:")
    // console.log(JSON.stringify(aweMetadataAccount, null, 2));

    //  await updateAweMetadataAccount(
    //     program,
    //     aweMintAddress,
    //     collectorTokenAccount.address,
    //     new anchor.BN("100000000000")
    // )

    // aweMetadataAccount = await program.account.aweMetadata.fetch(aweMetadataAddress, "confirmed");

    console.log("Awe Metadata Account data after update:")
    console.log(JSON.stringify(aweMetadataAccount, null, 2));
    console.log("Agent price: " + new anchor.BN(aweMetadataAccount.agentPrice).toString());

})().catch((e) => console.log(e))
