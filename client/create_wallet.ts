import { Keypair } from "@solana/web3.js"
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes"

const user = new Keypair()
console.log("User public key", user.publicKey.toBase58())
console.log("User private key", bs58.encode(user.secretKey))
