import { config } from "dotenv";
import {
  CLAccountHash,
  CLAnyType,
  CLByteArray,
  CLByteArrayBytesParser,
  CLKey,
  CLList,
  CLListBytesParser,
  CLString,
  CLU256,
  CLU256BytesParser,
  CLU512,
  CLU512BytesParser,
  CLU8BytesParser,
  CLValueBuilder,
  CLValueParsers,
  CasperClient,
  Keys,
  RuntimeArgs,
} from "casper-js-sdk";
import { getAccountInfo, getDeploy } from "./utils";
import readline from "readline";

import { readFileSync } from "fs";
import { Contracts } from "casper-js-sdk";

config();

const NODE = process.env.RPC!;
const NETWORK = process.env.NETWORK_NAME!;
const PK = process.env.PRIVATE_KEY!;

const priv = Keys.Secp256K1.parsePrivateKey(Buffer.from(PK, "base64"));

const pub = Keys.Secp256K1.privateToPublicKey(priv);
const key = Keys.Secp256K1.parseKeyPair(pub, priv, "raw");

const client = new CasperClient(NODE);

const read = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

(async () => {
  const contract = new Contracts.Contract(client);
  const deployed = await contract
    .install(
      readFileSync("./src/marketplace.wasm"),
      RuntimeArgs.fromMap({}),
      "100000000000",
      key.publicKey,
      NETWORK,
      [key]
    )
    .send(NODE);

  console.log(`Deploy Hash: `, deployed);

  await getDeploy(NODE, deployed);

  const accountInfo = await getAccountInfo(NODE, key.publicKey);

  const contractHash = accountInfo.namedKeys
    .filter((e: any) => e.name.includes(`cep82_marketplace`))
    .map((e: any) => e.key)[0];

  console.log(`Success. Contract Hash is: ${contractHash}`);
})();
