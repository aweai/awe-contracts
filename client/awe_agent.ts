import {
    AnchorProvider,
    BN,
    Program,
} from "@coral-xyz/anchor"
import type { Awe } from "../target/types/awe"
import {
    PublicKey,
} from "@solana/web3.js"
import { getAweMetadataAccount } from "./awe_metadata"
import { approve, getOrCreateAssociatedTokenAccount } from "./awe_token"
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token"


const getAgentCreatorAccount = async (
    program: Program<Awe>,
    aweMetadataAddress: PublicKey
) => {
    const provider = program.provider as AnchorProvider

    const [agentCreatorAccountAddress, _] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent_creator"), aweMetadataAddress.toBuffer(), provider.publicKey.toBuffer()],
        program.programId
    )

    try {
        const agentCreatorAccountData = await program.account.agentCreator.fetch(
            agentCreatorAccountAddress,
            "confirmed"
        )

        return agentCreatorAccountData

    } catch (e) {
        if(/Account\ does\ not\ exist/.test(e.toString())) {
            return null
        } else {
            console.error("Error getting agent creator account at: ", agentCreatorAccountAddress)
            throw(e)
        }
    }
}

const createAgent = async (
    program: Program<Awe>,
    aweMetadataAddress: PublicKey
) => {
    const provider = program.provider as AnchorProvider

    // Get the agent price
    const aweMetadataAccount = await getAweMetadataAccount(program, aweMetadataAddress)
    if (aweMetadataAccount === null) {
        throw new Error("Awe metadata account not initialized")
    }

    const agentPrice = aweMetadataAccount.agentPrice

    console.log("Current agent price: ", agentPrice.toString(10))

    // Authorize the delegate to transfer AWE token first

    const [delegateAddress, _] = PublicKey.findProgramAddressSync(
        [Buffer.from("delegate")],
        program.programId
    )

    const providerTokenAccount = await getOrCreateAssociatedTokenAccount(
        aweMetadataAccount.aweMintAccount,
        provider.publicKey,
        provider
    )

    if (new BN(providerTokenAccount.amount.toString()).lt(agentPrice)) {
        throw new Error(`Not enough AWE to pay for the agent creation ${providerTokenAccount.amount.toString()} < ${agentPrice.toString()}`)
    }

    await approve(
        aweMetadataAccount.aweMintAccount,
        providerTokenAccount.address,
        delegateAddress,
        agentPrice,
        provider
    )

    let agentCreatorAccountData = await getAgentCreatorAccount(
        program,
        aweMetadataAddress
    )

    let aweMethod: any

    if(!agentCreatorAccountData) {
        console.log("Init new Agent Creator Account")
        aweMethod = program.methods.initAgentCreator
    } else {
        console.log("numAgents before update: ", agentCreatorAccountData.numAgents.toString())
        aweMethod = program.methods.createAgent
    }

    // Init the agent account
    await aweMethod()
        .accounts({
            aweMetadataAccount: aweMetadataAddress,
            aweMintAccount: aweMetadataAccount.aweMintAccount,

            // Awe payer info
            aweSenderAccount: providerTokenAccount.address,
            aweCollectorAccount: aweMetadataAccount.aweCollectorAccount,
            delegate: delegateAddress,

            tokenProgram: TOKEN_2022_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
        })
        .rpc({ commitment: "confirmed" })

    console.log("Agent Creator Account updated!")

    agentCreatorAccountData = await getAgentCreatorAccount(
        program,
        aweMetadataAddress
    )

    console.log("numAgents after update: ", agentCreatorAccountData.numAgents.toString())
};

export {getAgentCreatorAccount, createAgent}
