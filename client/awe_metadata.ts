import {
    AnchorProvider,
    BN,
    Program,
} from "@coral-xyz/anchor";
import type { Awe } from "../target/types/awe";
import {
    PublicKey,
} from "@solana/web3.js";

const getAweMetadataAccount = async (
    program: Program<Awe>,
    aweMetadataAddress: PublicKey = null
) => {

    const provider = program.provider as AnchorProvider
    const wallet = provider.wallet

    if (!aweMetadataAddress) {
        const [derived, _] = PublicKey.findProgramAddressSync(
            [Buffer.from("awe_metadata"), wallet.publicKey.toBuffer()],
            program.programId
        )
        aweMetadataAddress = derived

        console.log("Derived Awe Metadata address: ", aweMetadataAddress.toBase58())
    } else {
        console.log("Loaded Awe Metadata address: ", aweMetadataAddress.toBase58())
    }

    try {
        const aweMetadataAccount = await program.account.aweMetadata.fetch(aweMetadataAddress, "confirmed")
        return aweMetadataAccount
    } catch (e) {
        if(/Account\ does\ not\ exist/.test(e.toString())) {
            return null
        } else {
            console.error("Error getting awe metadata account at: ", aweMetadataAddress)
            throw(e)
        }
    }
};

const getOrCreateAweMetadataAccount = async (
    program: Program<Awe>,
    aweMintAddress: PublicKey,
    aweCollectorAddress: PublicKey,
    agentPrice: BN) => {

    const provider = program.provider as AnchorProvider;
    const wallet = provider.wallet;

    let aweMetadataAccount = null

    while(aweMetadataAccount == null) {

        aweMetadataAccount = await getAweMetadataAccount(program)

        if (aweMetadataAccount === null) {
            console.log("Metadata account does not exist. Initializing...");

            const [aweMetadataAddress, _] = PublicKey.findProgramAddressSync(
                [Buffer.from("awe_metadata"), wallet.publicKey.toBuffer()],
                program.programId
            )

            console.log("Initializing Awe Metadata at address: ", aweMetadataAddress.toBase58())

            await program.methods
                .initAweMetadata(agentPrice)
                .accounts({
                    aweMintAccount: aweMintAddress,
                    aweCollectorAccount: aweCollectorAddress,
                })
                .rpc({ commitment: "confirmed" });
        }
    }

    return aweMetadataAccount
};

const updateAweMetadataAccount = async (
    program: Program<Awe>,
    aweMintAddress: PublicKey,
    aweCollectorAddress: PublicKey,
    agentPrice: BN
) => {
    const provider = program.provider as AnchorProvider;
    const wallet = provider.wallet;

    const [aweMetadataAddress, _] = PublicKey.findProgramAddressSync(
        [Buffer.from("awe_metadata"), wallet.publicKey.toBuffer()],
        program.programId
    )

    console.log("Derived Awe Metadata Address: ", aweMetadataAddress.toBase58())

    await program.methods
                    .updateAweMetadata(agentPrice)
                    .accounts({
                        aweMintAccount: aweMintAddress,
                        aweCollectorAccount: aweCollectorAddress
                    })
                    .rpc({ commitment: "confirmed" });

    return aweMetadataAddress
};

export {getAweMetadataAccount, getOrCreateAweMetadataAccount, updateAweMetadataAccount}
