import {
    AnchorProvider,
    BN,
} from "@coral-xyz/anchor";
import {
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
} from "@solana/web3.js";
import {
    Account,
    ExtensionType,
    createInitializeMetadataPointerInstruction,
    createInitializeMintInstruction,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getMint,
    getMetadataPointerState,
    getTokenMetadata,
    getMintLen,
    getAccount,
    getAssociatedTokenAddress,
    TYPE_SIZE,
    LENGTH_SIZE,
    TokenAccountNotFoundError,
    createAssociatedTokenAccountInstruction,
    createMintToCheckedInstruction,
    createApproveCheckedInstruction,
    createSetAuthorityInstruction,
    createTransferCheckedInstruction,
    AuthorityType
} from "@solana/spl-token";

import {
    createInitializeInstruction,
    createUpdateAuthorityInstruction,
    pack,
    TokenMetadata,
} from "@solana/spl-token-metadata";

const sleep = () => {
    return new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });
}

// Create a new token (Mint Account)
const createAweTokenWithMetadata = async (provider: AnchorProvider) => {

    const connection = provider.connection;
    const wallet = provider.wallet;
    const recentBlockhash = await connection.getLatestBlockhash();

    // Generate new keypair for Mint Account
    const mintKeypair = Keypair.generate();
    // Address for Mint Account
    const mint = mintKeypair.publicKey;
    // Decimals for Mint Account
    const decimals = 9;
    // Authority that can mint new tokens
    const mintAuthority = wallet.publicKey;

    // Metadata to store in Mint Account
    const metaData: TokenMetadata = {
        mint: mint,
        name: "Awe! Token",
        symbol: "AWE",
        uri: "https://aweai.fun/token-metadata.json",
        additionalMetadata: [],
    };

    // Size of MetadataExtension 2 bytes for type, 2 bytes for length
    const metadataExtension = TYPE_SIZE + LENGTH_SIZE;
    // Size of metadata
    const metadataLen = pack(metaData).length;

    // Size of Mint Account with extension
    const mintLen = getMintLen([ExtensionType.MetadataPointer]);

    // Minimum lamports required for Mint Account
    const lamports = await connection.getMinimumBalanceForRentExemption(
        mintLen + metadataExtension + metadataLen,
    );

    // Instruction to invoke System Program to create new account
    const createAccountInstruction = SystemProgram.createAccount({
        fromPubkey: wallet.publicKey, // Account that will transfer lamports to created account
        newAccountPubkey: mint, // Address of the account to create
        space: mintLen, // Amount of bytes to allocate to the created account
        lamports, // Amount of lamports transferred to created account
        programId: TOKEN_2022_PROGRAM_ID, // Program assigned as owner of created account
    });

    // Instruction to initialize the MetadataPointer Extension
    const initializeMetadataPointerInstruction =
        createInitializeMetadataPointerInstruction(
            mint, // Mint Account address
            null, // Authority that can set the metadata address
            mint, // Account address that holds the metadata
            TOKEN_2022_PROGRAM_ID,
        );

    // Instruction to initialize Mint Account data
    const initializeMintInstruction = createInitializeMintInstruction(
        mint, // Mint Account Address
        decimals, // Decimals of Mint
        mintAuthority, // Designated Mint Authority
        null, // Optional Freeze Authority
        TOKEN_2022_PROGRAM_ID, // Token Extension Program ID
    );

    // Instruction to initialize Metadata Account data
    const initializeMetadataInstruction = createInitializeInstruction({
        programId: TOKEN_2022_PROGRAM_ID, // Token Extension Program as Metadata Program
        metadata: mint, // Account address that holds the metadata
        updateAuthority: wallet.publicKey, // Authority that can update the metadata
        mint: mint, // Mint Account address
        mintAuthority: mintAuthority, // Designated Mint Authority
        name: metaData.name,
        symbol: metaData.symbol,
        uri: metaData.uri,
    });

    const removeUpdateAuthorityInstruction = createUpdateAuthorityInstruction({
        programId: TOKEN_2022_PROGRAM_ID,
        metadata: mint,
        oldAuthority: wallet.publicKey,
        newAuthority: null
    })

    // Add instructions to new transaction
    const transaction = new Transaction({
        lastValidBlockHeight: recentBlockhash.lastValidBlockHeight,
        blockhash: recentBlockhash.blockhash,
        feePayer: wallet.publicKey
    }).add(
        createAccountInstruction,
        initializeMetadataPointerInstruction,
        initializeMintInstruction,
        initializeMetadataInstruction,
        removeUpdateAuthorityInstruction
    );

    const txSignature = await provider.sendAndConfirm(
        transaction,
        [mintKeypair]
    );

    console.log(
        "\nCreate Mint Account:",
        `https://solana.fm/tx/${txSignature}?cluster=devnet-solana`,
    );

    // Retrieve mint information
    const mintInfo = await getMint(
        connection,
        mint,
        "confirmed",
        TOKEN_2022_PROGRAM_ID,
    );

    console.log("Mint info: ", mintInfo)

    // Retrieve and log the metadata pointer state
    const metadataPointer = getMetadataPointerState(mintInfo);
    console.log("\nMetadata Pointer:", JSON.stringify(metadataPointer, null, 2));

    // Retrieve and log the metadata state
    const metadata = await getTokenMetadata(
        connection,
        mint, // Mint Account address
    );
    console.log("\nMetadata:", JSON.stringify(metadata, null, 2));
    return mint;
};

// Mint token to toOwnerAddress
// If the token account of toOwnerAddress does not exist, it will be funded and created by the provider
const mintAweToken = async (
    aweMintAddress: PublicKey,
    toOwnerAddress: PublicKey,
    amount: BN,
    provider: AnchorProvider
) => {

    const connection = provider.connection;
    const recentBlockhash = await connection.getLatestBlockhash();

    // Get or create the token account
    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
        aweMintAddress,
        toOwnerAddress,
        provider
    );

    console.log("Check dest token account balance...");

    let tokenAmount = await connection.getTokenAccountBalance(toTokenAccount.address);
    console.log(`dest token account: ${toTokenAccount.address}`);
    console.log(`amount: ${tokenAmount.value.uiAmount}`);

    // Mint tokens to the toTokenAccount

    const mintInfo = await getMint(
        connection,
        aweMintAddress,
        "confirmed",
        TOKEN_2022_PROGRAM_ID,
    );

    let mintTx = new Transaction({
        lastValidBlockHeight: recentBlockhash.lastValidBlockHeight,
        blockhash: recentBlockhash.blockhash,
        feePayer: provider.publicKey
    }).add(
        createMintToCheckedInstruction(
            aweMintAddress,
            toTokenAccount.address,
            provider.publicKey,
            BigInt(amount.toString(10)),
            mintInfo.decimals,
            [],
            TOKEN_2022_PROGRAM_ID
        ),
    )

    const txSignature = await provider.sendAndConfirm(mintTx);

    console.log(
        "\nMint:",
        `https://solana.fm/tx/${txSignature}?cluster=devnet-solana`,
    );

    tokenAmount = await connection.getTokenAccountBalance(toTokenAccount.address);
    console.log(`dest token account: ${toTokenAccount.address}`);
    console.log(`amount: ${tokenAmount.value.uiAmount}`);
};

// Can be used to create token account for others
// ownerAddress: the token account to be created for
// provider: signer who pays for it
const getOrCreateAssociatedTokenAccount = async (
    aweMintAddress: PublicKey,
    ownerAddress: PublicKey,
    provider: AnchorProvider) => {

        const connection = provider.connection

    let tokenAccountAddress = await getAssociatedTokenAddress(
        aweMintAddress,
        ownerAddress,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    );

    let tokenAccount: Account = null

    while (tokenAccount === null) {
        try {
            tokenAccount = await getAccount(
                connection,
                tokenAccountAddress,
                null,
                TOKEN_2022_PROGRAM_ID
            );

        } catch (e) {
            if (e instanceof TokenAccountNotFoundError) {
                console.log("target token account not exist. Create it...")

                const recentBlockhash = await connection.getLatestBlockhash();

                // Create the account
                let tx = new Transaction({
                    lastValidBlockHeight: recentBlockhash.lastValidBlockHeight,
                    blockhash: recentBlockhash.blockhash,
                    feePayer: provider.publicKey
                }).add(
                    createAssociatedTokenAccountInstruction(
                        provider.publicKey,
                        tokenAccountAddress,
                        ownerAddress,
                        aweMintAddress,
                        TOKEN_2022_PROGRAM_ID,
                        ASSOCIATED_TOKEN_PROGRAM_ID,
                    ),
                )

                await provider.sendAndConfirm(tx);
            } else {
                console.error("Error getting target token account info")
                console.error(e)
                throw (e)
            }
        }
    }

    return tokenAccount
}

const approve = async (
    aweMintAddress: PublicKey,
    originalTokenAccountAddress: PublicKey,
    delegateAddress: PublicKey,
    amount: BN,
    provider: AnchorProvider
) => {

    const connection = provider.connection;
    const wallet = provider.wallet;

    const recentBlockhash = await connection.getLatestBlockhash();

    let tx = new Transaction({
        lastValidBlockHeight: recentBlockhash.lastValidBlockHeight,
        blockhash: recentBlockhash.blockhash,
        feePayer: wallet.publicKey
    }).add(
        createApproveCheckedInstruction(
            originalTokenAccountAddress,
            aweMintAddress,
            delegateAddress,
            wallet.publicKey,
            BigInt(amount.toString(10)),
            9,
            [],
            TOKEN_2022_PROGRAM_ID
        )
    )

    const txSignature = await provider.sendAndConfirm(tx);

    console.log(
        "\nApprove Delegate:",
        `https://solana.fm/tx/${txSignature}?cluster=devnet-solana`,
    );
};

const revokeMintAuthority = async (
    aweMintAddress: PublicKey,
    provider: AnchorProvider) => {

    const connection = provider.connection;
    const wallet = provider.wallet;

    const recentBlockhash = await connection.getLatestBlockhash();

    let tx = new Transaction({
        lastValidBlockHeight: recentBlockhash.lastValidBlockHeight,
        blockhash: recentBlockhash.blockhash,
        feePayer: wallet.publicKey
    }).add(
        createSetAuthorityInstruction(
            aweMintAddress,
            wallet.publicKey,
            AuthorityType.MintTokens,
            null
        )
    )

    const txSignature = await provider.sendAndConfirm(tx);

    console.log(
        "\nRevoke mint authority:",
        `https://solana.fm/tx/${txSignature}?cluster=devnet-solana`,
    );
};

const batchTransferAweToken = async (
    aweMintAddress: PublicKey,
    addresses: string[],
    amounts: BN[],
    provider: AnchorProvider
) => {

    if (addresses.length != amounts.length) {
        throw new Error("mismatched addresses and amounts")
    }

    const connection = provider.connection
    const wallet = provider.wallet

    const sourceTokenAccountAddress = await getAssociatedTokenAddress(
        aweMintAddress,
        provider.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
    )

    let ixs = []

    for(let i=0, l=addresses.length; i<l; i++) {
        const address = new PublicKey(addresses[i])
        const amount = BigInt(amounts[i].toString(10))

        const destTokenAccount = await getAssociatedTokenAddress(
            aweMintAddress,
            address,
            false,
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        )

        try {
            await getAccount(
                provider.connection,
                destTokenAccount,
                "confirmed",
                TOKEN_2022_PROGRAM_ID
            )

        } catch (e) {
            if (e instanceof TokenAccountNotFoundError) {
                const ixCreateTokenAccount = createAssociatedTokenAccountInstruction(
                    provider.publicKey,
                    destTokenAccount,
                    address,
                    aweMintAddress,
                    TOKEN_2022_PROGRAM_ID,
                    ASSOCIATED_TOKEN_PROGRAM_ID,
                )
                ixs.push(ixCreateTokenAccount)
            } else {
                throw e
            }
        }

        const ixTransfer = createTransferCheckedInstruction(
            sourceTokenAccountAddress,
            aweMintAddress,
            destTokenAccount,
            provider.publicKey,
            amount,
            9,
            [],
            TOKEN_2022_PROGRAM_ID,
        )

        ixs.push(ixTransfer)
        
        await sleep()
    }

    const recentBlockhash = await connection.getLatestBlockhash()
    console.log("Recent block hash fetched!")

    let tx = new Transaction({
        lastValidBlockHeight: recentBlockhash.lastValidBlockHeight,
        blockhash: recentBlockhash.blockhash,
        feePayer: wallet.publicKey
    }).add(...ixs)

    console.log("Sending the transaction...")

    return await provider.sendAndConfirm(tx)
}

export { createAweTokenWithMetadata, mintAweToken, getOrCreateAssociatedTokenAccount, approve, revokeMintAuthority, batchTransferAweToken }
