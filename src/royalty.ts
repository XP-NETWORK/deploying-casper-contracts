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

type MinimumRoyalty = {
  __type: "MinimumRoyalty";
  amount: string;
};
type FlatRoyalty = {
  __type: "FlatRoyalty";
  amount: string;
};
type PercentageRoyalty = {
  __type: "PercentageRoyalty";
  percentage: string;
};

type Royalties = MinimumRoyalty | FlatRoyalty | PercentageRoyalty;

const RoyaltySerialzer = (royalties: Royalties[]) => {
  const clu512ByteParser = new CLU512BytesParser();
  const u8Parser = new CLU8BytesParser();
  const clu256Parser = new CLU256BytesParser();
  const clListBuilder: CLByteArray[] = [];

  for (const royalty of royalties) {
    const royaltyType = royalty.__type;
    if (royaltyType === "FlatRoyalty") {
      const u8 = CLValueBuilder.u8(0);
      const clu512 = new CLU512(royalty.amount);
      const bytes = CLValueBuilder.byteArray(
        Buffer.concat([
          u8Parser.toBytes(u8).unwrap(),
          clu512ByteParser.toBytes(clu512).unwrap(),
        ])
      );
      clListBuilder.push(bytes);
    } else if (royaltyType === "MinimumRoyalty") {
      const u8 = CLValueBuilder.u8(1);
      const clu512 = new CLU512(royalty.amount);
      const bytes = CLValueBuilder.byteArray(
        Buffer.concat([
          u8Parser.toBytes(u8).unwrap(),
          clu512ByteParser.toBytes(clu512).unwrap(),
        ])
      );
      clListBuilder.push(bytes);
    } else {
      const u8 = CLValueBuilder.u8(2);
      const clu256 = new CLU256(royalty.percentage);
      const bytes = CLValueBuilder.byteArray(
        Buffer.concat([
          u8Parser.toBytes(u8).unwrap(),
          clu256Parser.toBytes(clu256).unwrap(),
        ])
      );
      clListBuilder.push(bytes);
    }
  }
  return CLValueBuilder.list(clListBuilder);
};

(async () => {
  const whitelistedMarketPlacesStr = await new Promise<string>((res) =>
    read.question(
      "Enter White Listed MarketPlace's ContractPackageHash (seprated by ,): ",
      res
    )
  );

  if (whitelistedMarketPlacesStr === "") {
    console.error("Please enter at least one whitelisted market place");
    return;
  }
  const whitelistedMarketPlaces = whitelistedMarketPlacesStr.split(",");

  const whitelisted_marketplaces = whitelistedMarketPlaces.map((e) => {
    return new CLByteArray(Buffer.from(e, "hex"));
  });

  const manager = await new Promise<string>((res) =>
    read.question("Enter Manager Account Hash: ", res)
  );

  if (manager === "") {
    console.error("Please enter manager account hash");
    return;
  }

  const managerAccountHash = new CLAccountHash(Buffer.from(manager, "hex"));

  const royalties: Royalties[] = [];

  while (true) {
    const royalty = await new Promise<string>((res) =>
      read.question("Add Royalty (atleast 1 is necessary) (y/n): ", res)
    );
    if (royalty === "n") {
      break;
    }
    const royaltyType = await new Promise<string>((res) =>
      read.question("Enter Royalty Type (Flat/Percentage/Minimum): ", res)
    );
    if (royaltyType === "Flat") {
      const royaltyAmount = await new Promise<string>((res) =>
        read.question("Enter Royalty Amount: ", res)
      );
      royalties.push({ __type: "FlatRoyalty", amount: royaltyAmount });
    }
    if (royaltyType === "Minimum") {
      const royaltyAmount = await new Promise<string>((res) =>
        read.question("Enter Royalty Amount: ", res)
      );
      royalties.push({ __type: "MinimumRoyalty", amount: royaltyAmount });
    }
    if (royaltyType === "Percentage") {
      const percentage = await new Promise<string>((res) =>
        read.question("Enter Percentage: ", res)
      );
      royalties.push({ __type: "PercentageRoyalty", percentage });
    }
  }

  if (royalties.length === 0) {
    console.error("Please enter atleast one royalty.");
    return;
  }

  const identifierStr = await new Promise<string>((res) =>
    read.question("Enter Identifier: ", res)
  );

  if (identifierStr === "") {
    console.error("Please enter royalty.");
    return;
  }

  const identifier = new CLString(identifierStr);

  const contract = new Contracts.Contract(client);
  console.log(managerAccountHash.clType());

  console.log(`Args:`, {
    whitelisted_marketplaces: whitelistedMarketPlaces,
    royalty_structure: royalties,
    manager: manager,
    identifier,
  });
  const deployed = await contract
    .install(
      readFileSync("./src/royalty.wasm"),
      RuntimeArgs.fromMap({
        whitelisted_marketplaces: new CLList(whitelisted_marketplaces),
        royalty_structure: RoyaltySerialzer(royalties),
        manager: new CLKey(managerAccountHash),
        identifier,
      }),
      "300000000000",
      key.publicKey,
      NETWORK,
      [key]
    )
    .send(NODE);

  console.log(`Deploy Hash: `, deployed);

  await getDeploy(NODE, deployed);

  const accountInfo = await getAccountInfo(NODE, key.publicKey);

  console.log(`Deployed Result:`, JSON.stringify(accountInfo, null, 4));

  const contractHash = accountInfo.namedKeys
    .filter((e: any) => e.name.includes(`cep82_custodial_${identifierStr}`))
    .map((e: any) => e.key)[0];

  console.log(`Success. Contract Hash is: ${contractHash}`);
})();
