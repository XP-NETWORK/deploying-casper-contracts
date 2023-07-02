import { config } from "dotenv";
import { Keys } from "casper-js-sdk";
import { getAccountInfo, getDeploy } from "./utils";
import readline from "readline";
import {
  BurnMode,
  CEP78Client,
  EventsMode,
  MetadataMutability,
  MintingMode,
  NFTIdentifierMode,
  NFTKind,
  NFTMetadataKind,
  NFTOwnershipMode,
  WhitelistMode,
} from "casper-cep78-js-client";

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
    read.question("Enter Bridge Address (prefixed with contract-hash-): ", res)
  );

  const totalTokenSupply = await new Promise<string>((res) =>
    read.question("Enter Total Token Supply (Max-1000000): ", res)
  );
  const deployed = await client
    .install(
      {
        collectionName,
        collectionSymbol,
        whitelistMode: WhitelistMode.Unlocked,
        identifierMode: NFTIdentifierMode.Ordinal,
        metadataMutability: MetadataMutability.Immutable,
        nftKind: NFTKind.Digital,
        ownershipMode: NFTOwnershipMode.Transferable,
        nftMetadataKind: NFTMetadataKind.Raw,
        totalTokenSupply,
        burnMode: BurnMode.Burnable,
        allowMinting: true,
        contractWhitelist: [bridgeToWhitelist],
        eventsMode: EventsMode.CES,
        mintingMode: MintingMode.Public,
      },
      "200000000000",
      key.publicKey
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
