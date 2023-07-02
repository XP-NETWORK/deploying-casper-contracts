import { config } from "dotenv";
import { XpBridgeClient } from "xpbridge-client";
import { Keys } from "casper-js-sdk";
import { getAccountInfo, getDeploy } from "./utils";
import readline from "readline";

config();

const NODE = process.env.RPC!;
const NETWORK = process.env.NETWORK_NAME!;
const PK = process.env.PRIVATE_KEY!;

const priv = Keys.Secp256K1.parsePrivateKey(Buffer.from(PK, "base64"));

const pub = Keys.Secp256K1.privateToPublicKey(priv);
const key = Keys.Secp256K1.parseKeyPair(pub, priv, "raw");

const client = new XpBridgeClient(NODE, NETWORK, key.publicKey, [key]);

const read = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

(async () => {
  const deployed = await client
    .deploy("200000000000", key.publicKey)
    .send(NODE);

  console.log(`Deployed Hash:  ${deployed}`);

  console.log(`Awaiting for deploy to be processed...`);

  const result = await getDeploy(NODE, deployed);

  console.log(`Deployed.`);

  const accInfo = await getAccountInfo(NODE, key.publicKey);
  const contractHash = accInfo.namedKeys
    .filter((e: any) => e.name === "bridge_contract")
    .map((e: any) => e.key)[0];

  console.log(`Contract Hash: ${contractHash}`);

  client.setContractHash(contractHash);

  const gk = await new Promise<string>((res) =>
    read.question("Enter Group Key in Hex Form: ", res)
  );

  const feeGk = await new Promise<string>((res) =>
    read.question("Enter Fee Group Key in Hex Form: ", res)
  );

  const whitelist = await new Promise<string>((res) =>
    read.question(
      "Enter Whitelist Contract seprated by comma, and should not contain hash- prefix ",
      res
    )
  );

  const init = client.initialize(
    {
      fee_public_key: Buffer.from(feeGk, "hex"),
      group_key: Buffer.from(gk, "hex"),
      whitelist: whitelist.split(","),
    },
    "15000000000",
    key.publicKey,
    [key]
  );

  const initDeploy = await init.send(NODE);

  console.log(`Initial Deploy Hash: ${initDeploy}`);
  await getDeploy(NODE, initDeploy);

  console.log(`Success. Contract Hash is: ${contractHash}`);
})();
