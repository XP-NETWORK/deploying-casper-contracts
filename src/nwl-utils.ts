import { config } from "dotenv";
import {
  CLByteArray,
  CLU256,
  CLU512,
  CasperClient,
  Keys,
  Contracts,
  RuntimeArgs,
} from "casper-js-sdk";
import { getAccountInfo, getDeploy } from "./utils";
import readline from "readline";
import { readFileSync } from "fs";

config();

const NODE = process.env.RPC!;
const NETWORK = process.env.NETWORK_NAME!;
const PK = process.env.PRIVATE_KEY!;

const priv = Keys.Secp256K1.parsePrivateKey(Buffer.from(PK, "base64"));

const WASM = readFileSync("./src/nwl.wasm");

const pub = Keys.Secp256K1.privateToPublicKey(priv);
const key = Keys.Secp256K1.parseKeyPair(pub, priv, "raw");

const cc = new CasperClient(NODE);
const client = new Contracts.Contract(cc);

const read = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

(async () => {
  const gk = await new Promise<string>((res) =>
    read.question("Enter Group Key in Hex Form: ", res)
  ).then((e) => new CLByteArray(Buffer.from(e, "hex")));

  const feeGk = await new Promise<string>((res) =>
    read.question("Enter Fee Group Key in Hex Form: ", res)
  ).then((e) => new CLByteArray(Buffer.from(e, "hex")));

  const action_count = await new Promise<string>((res) =>
    read.question("Enter Action Count in Decimal", res)
  ).then((e) => new CLU256(e));

  const number = new CLU512(Math.floor(Math.random() * 10000))

  const deployed = await client
    .install(
      WASM,
      RuntimeArgs.fromMap({
        group_key: gk,
        fee_public_key: feeGk,
        action_count,
        number
      }),
      "300000000000",
      key.publicKey,
      NETWORK,
      [key]
    )
    .send(NODE);

  console.log(`Deployed Hash:  ${deployed}`);

  console.log(`Awaiting for deploy to be processed...`);

  const result = await getDeploy(NODE, deployed);

  console.log(`Deployed.`);

  const accInfo = await getAccountInfo(NODE, key.publicKey);
  const contractHash = accInfo.namedKeys
    .filter((e: any) => e.name === `no_whitelist${number.value.toString()}`)
    .map((e: any) => e.key)[0];

  console.log(`Contract Hash: ${contractHash}`);
})();
