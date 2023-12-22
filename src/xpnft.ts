import { config } from "dotenv";
import { CLAccountHash, Keys } from "casper-js-sdk";
import { getAccountInfo, getDeploy } from "./utils";
import readline from "readline";
import {
  BurnMode,
  EventsMode,
  MetadataMutability,
  NFTHolderMode,
  NFTIdentifierMode,
  NFTKind,
  NFTMetadataKind,
  NFTOwnershipMode,
  WhitelistMode,
} from "casper-cep78-js-client/dist/src";
import { CEP78Client, MintingMode } from "./nft-client";
import { readFileSync } from "fs";

config();

const NODE = process.env.RPC!;
const NETWORK = process.env.NETWORK_NAME!;
const PK = process.env.PRIVATE_KEY!;

const priv = Keys.Secp256K1.parsePrivateKey(Buffer.from(PK, "base64"));

const pub = Keys.Secp256K1.privateToPublicKey(priv);
const key = Keys.Secp256K1.parseKeyPair(pub, priv, "raw");

const client = new CEP78Client(NODE, NETWORK);

const read = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

(async () => {
  const collectionName = await new Promise<string>((res) =>
    read.question("Enter Collection Name: ", res)
  );

  const collectionSymbol = await new Promise<string>((res) =>
    read.question("Enter Collection Symbol: ", res)
  );

  const bridgeToWhitelist = await new Promise<string>((res) =>
    read.question("Enter Bridge Address (prefixed with hash-): ", res)
  );

  const totalTokenSupply = await new Promise<string>((res) =>
    read.question("Enter Total Token Supply (Max-1000000): ", res)
  );

  const royaltyContract = await new Promise<string>((res) =>
    read.question(
      "Enter The contract hash of the transfer-filter royalty contract (or can leave empty): ",
      res
    )
  ).then((e) => (e === "" ? undefined : e));

  const deployed = await client
    .install(
      {
        collectionName,
        collectionSymbol,
        identifierMode: NFTIdentifierMode.Ordinal,
        metadataMutability: MetadataMutability.Immutable,
        nftKind: NFTKind.Digital,
        nftMetadataKind: NFTMetadataKind.Raw,
        ownershipMode: NFTOwnershipMode.Transferable,
        allowMinting: true,
        burnMode: BurnMode.Burnable,
        whitelistMode: WhitelistMode.Unlocked,
        mintingMode: MintingMode.ACL,
        totalTokenSupply: totalTokenSupply,
        holderMode: NFTHolderMode.Mixed,
        eventsMode: EventsMode.CES,
        hashKeyName: `${collectionName}-hash`,
        acl_whitelist: [key.publicKey.toAccountHashStr()],
        transfer_filter_contract: royaltyContract,
        jsonSchema: {
          properties: {},
        },
      },
      "300000000000",
      key.publicKey,
      readFileSync("./src/xpnft.wasm"),
      [key]
    )
    .send(NODE);

  console.log(`Deploy Hash: `, deployed);

  const result = await getDeploy(NODE, deployed);

  const keyName = `cep78_contract_hash_${collectionName}`;

  const accountInfo = await getAccountInfo(NODE, key.publicKey);

  const contractHash = accountInfo.namedKeys
    .filter((e: any) => e.name === keyName)
    .map((e: any) => e.key)[0];

  console.log(`Success. Contract Hash is: ${contractHash}`);
})();
