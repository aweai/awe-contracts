import * as anchor from "@coral-xyz/anchor"
import { mintAweToken, getOrCreateAssociatedTokenAccount } from "./awe_token"
import * as dotenv from "dotenv"
import { Keypair, PublicKey } from "@solana/web3.js"
import type { Awe } from "../target/types/awe"
import idl from "../target/idl/awe.json"
import { getAweMetadataAccount } from "./awe_metadata";
import { createAgent } from "./awe_agent";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes"


(async () => {
    anchor.setProvider(anchor.AnchorProvider.env());
    const program = anchor.workspace.Awe as anchor.Program<Awe>;

    dotenv.config({ path: ".env" })

    if (!process.env["AWE_METADATA_ADDRESS"]) {
        throw Error("No AWE Metadata Address specified")
    }

    const aweMetadataAddress = new PublicKey(process.env["AWE_METADATA_ADDRESS"])
    console.log("Awe Metadata Address: ", aweMetadataAddress.toBase58())

    const aweMetadataAccount = await getAweMetadataAccount(program, aweMetadataAddress)
    console.log("Awe Metadata Account: ", aweMetadataAccount)

    // Get or create a new user as the test user
    let user:Keypair
    if (!process.env["TEST_USER_PRIVATE_KEY"]) {
        user = new Keypair()
        console.log("User public key", user.publicKey.toBase58())
        console.log("User private key", bs58.encode(user.secretKey))
    } else {
        user = Keypair.fromSecretKey(bs58.decode(process.env["TEST_USER_PRIVATE_KEY"]))
        console.log("User public key", user.publicKey.toBase58())
    }

    // Mint the user some AWE tokens for agent creation fee
    console.log("Mint AWE to the user account...")
    await mintAweToken(
        aweMetadataAccount.aweMintAccount,
        user.publicKey,
        aweMetadataAccount.agentPrice,
        program.provider as anchor.AnchorProvider
    )

    // Init the agent creator account for the user
    console.log("Init user program...")
    const userWallet = new anchor.Wallet(user)
    const userProvider = new anchor.AnchorProvider(
        program.provider.connection,
        userWallet,
        {}
    )
    const userProgram = new anchor.Program<Awe>(
        idl as unknown as Awe,
        userProvider
    )

    console.log("User program provider wallet: ", userProgram.provider.publicKey.toBase58())

    // Get SOL airdrop for the user
    // Newly created user only
    if (!process.env["TEST_USER_PRIVATE_KEY"]) {
        console.log("Request SOL airdrop for the user...")
        await userProgram.provider.connection.requestAirdrop(
            userWallet.publicKey,
            1e8
        )
        console.log("Airdrop finished")
    }

    const userWalletBalance = await userProgram.provider.connection.getBalance(userWallet.publicKey,"confirmed")
    console.log("User wallet balance: ", userWalletBalance.toString())

    let userTokenAccountData = await getOrCreateAssociatedTokenAccount(
        aweMetadataAccount.aweMintAccount,
        userWallet.publicKey,
        userProgram.provider as anchor.AnchorProvider
    )
    console.log("User account balance before creating agent: ", userTokenAccountData.amount.toString())

    let collectorTokenAccountData = await getOrCreateAssociatedTokenAccount(
        aweMetadataAccount.aweMintAccount,
        program.provider.publicKey,
        program.provider as anchor.AnchorProvider
    )
    console.log("Collector account balance before creating agent: ", collectorTokenAccountData.amount.toString())

    await createAgent(
        userProgram,
        aweMetadataAddress
    )
    console.log("New agent created!")

    userTokenAccountData = await getOrCreateAssociatedTokenAccount(
        aweMetadataAccount.aweMintAccount,
        userWallet.publicKey,
        userProgram.provider as anchor.AnchorProvider
    )
    console.log("User account balance after creating agent: ", userTokenAccountData.amount.toString())

    collectorTokenAccountData = await getOrCreateAssociatedTokenAccount(
        aweMetadataAccount.aweMintAccount,
        program.provider.publicKey,
        program.provider as anchor.AnchorProvider
    )
    console.log("Collector account balance after creating agent: ", collectorTokenAccountData.amount.toString())


  })().catch((e) => console.log(e))
