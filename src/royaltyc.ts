import {
  CLAccountHash,
  CLByteArray,
  CLKey,
  CLList,
  CLString,
  CLU256,
  CLU256BytesParser,
  CLU512,
  CLU512BytesParser,
  CLU8BytesParser,
  CLValueBuilder,
  CasperClient,
  Contracts,
  Keys,
  RuntimeArgs,
} from "casper-js-sdk";
import { readFileSync } from "fs";

const RoyaltyWasm = readFileSync("./royalty.wasm");

export class RoyaltyClient {
  readonly client: CasperClient;
  readonly contract: Contracts.Contract;
  readonly key: Keys.AsymmetricKey;
  readonly network: string;
  constructor(rpc: string, network: string, key: Keys.AsymmetricKey) {
    this.client = new CasperClient(rpc);
    this.contract = new Contracts.Contract(this.client);
    this.key = key;
    this.network = network;
  }

  async deploy(
    whitelistedMarketPlaces: string[],
    royalties: Royalties[],
    manager: string,
    identifier: string
  ) {
    const installDeploy = this.contract.install(
      RoyaltyWasm,
      RuntimeArgs.fromMap({
        whitelisted_marketplaces: new CLList(
          whitelistedMarketPlaces.map(
            (e) => new CLByteArray(Buffer.from(e.split("-")[1], "hex"))
          )
        ),
        royalty_structure: RoyaltySerialzer(royalties),
        manager: new CLKey(
          new CLAccountHash(Buffer.from(manager.split("-")[1], "hex"))
        ),
        identifier: new CLString(identifier),
      }),
      "300000000000",
      this.key.publicKey,
      this.network,
      [this.key]
    );
    const deployHash = await installDeploy.send(this.network);
    return deployHash;
  }
}

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
