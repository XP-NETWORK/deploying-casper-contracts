import {
  BurnMode,
  EventsMode,
  JSONSchemaObject,
  MetadataMutability,
  NFTHolderMode,
  NFTIdentifierMode,
  NFTKind,
  NFTMetadataKind,
  NFTOwnershipMode,
  NamedKeyConventionMode,
  OwnerReverseLookupMode,
  WhitelistMode,
} from "casper-cep78-js-client/dist/src";
import {
  CLAccountHash,
  CLByteArray,
  CLKey,
  CLPublicKey,
  CLValueBuilder,
  CasperClient,
  Contracts,
  Keys,
  RuntimeArgs,
} from "casper-js-sdk";

export enum MintingMode {
  Installer = 0,
  Public = 1,
  ACL = 2,
}

const convertHashStrToHashBuff = (hashStr: string) => {
  let hashHex = hashStr;
  if (hashStr.startsWith("hash-")) {
    hashHex = hashStr.slice(5);
  }
  return Buffer.from(hashHex, "hex");
};

const convertHashStrToHashBuffV2 = (hashStr: string) => {
  let hashHex = hashStr;
  if (hashStr.startsWith("hash-")) {
    hashHex = hashStr.slice(5);
  }
  if (hashStr.startsWith("account-hash-")) {
    hashHex = hashStr.slice("account-hash-".length);
    return new CLKey(new CLAccountHash(Buffer.from(hashHex, "hex")));
  }
  return new CLKey(new CLByteArray(Buffer.from(hashHex, "hex")));
};

const buildHashList = (list: string[]) =>
  list.map((hashStr) =>
    CLValueBuilder.byteArray(convertHashStrToHashBuff(hashStr))
  );

const buildHashListV2 = (list: string[]) =>
  list.map((hashStr) => convertHashStrToHashBuffV2(hashStr));

export type ConfigurableVariables = {
  allowMinting?: boolean;
  contractWhitelist?: string[];
};
export type InstallArgs = {
  collectionName: string;
  collectionSymbol: string;
  totalTokenSupply: string;
  ownershipMode: NFTOwnershipMode;
  nftKind: NFTKind;
  jsonSchema?: JSONSchemaObject;
  nftMetadataKind: NFTMetadataKind;
  identifierMode: NFTIdentifierMode;
  metadataMutability: MetadataMutability;
  mintingMode?: MintingMode;
  whitelistMode?: WhitelistMode;
  holderMode?: NFTHolderMode;
  burnMode?: BurnMode;
  acl_whitelist?: string[];
  ownerReverseLookupMode?: OwnerReverseLookupMode;
  namedKeyConventionMode?: NamedKeyConventionMode;
  accessKeyName?: string;
  hashKeyName?: string;
  eventsMode?: EventsMode;
  transfer_filter_contract?: string;
} & ConfigurableVariables;

export class CEP78Client {
  private contractClient: Contracts.Contract;
  private networkName: string;

  constructor(nodeAddress: string, networkName: string) {
    this.contractClient = new Contracts.Contract(new CasperClient(nodeAddress));
    this.networkName = networkName;
  }
  public install(
    args: InstallArgs,
    paymentAmount: string,
    deploySender: CLPublicKey,
    wasm: Uint8Array,
    keys?: Keys.AsymmetricKey[]
  ) {
    const wasmToInstall = wasm;

    if (
      args.identifierMode === NFTIdentifierMode.Hash &&
      args.metadataMutability === MetadataMutability.Mutable
    ) {
      throw new Error(
        `You can't combine NFTIdentifierMode.Hash and MetadataMutability.Mutable`
      );
    }

    const runtimeArgs = RuntimeArgs.fromMap({
      collection_name: CLValueBuilder.string(args.collectionName),
      collection_symbol: CLValueBuilder.string(args.collectionSymbol),
      total_token_supply: CLValueBuilder.u64(args.totalTokenSupply),
      ownership_mode: CLValueBuilder.u8(args.ownershipMode),
      nft_kind: CLValueBuilder.u8(args.nftKind),
      nft_metadata_kind: CLValueBuilder.u8(args.nftMetadataKind),
      identifier_mode: CLValueBuilder.u8(args.identifierMode),
      metadata_mutability: CLValueBuilder.u8(args.metadataMutability),
    });

    // TODO: Validate here
    if (args.jsonSchema !== undefined) {
      runtimeArgs.insert(
        "json_schema",
        CLValueBuilder.string(JSON.stringify(args.jsonSchema))
      );
    }

    if (args.mintingMode !== undefined) {
      runtimeArgs.insert("minting_mode", CLValueBuilder.u8(args.mintingMode));
    }

    if (args.allowMinting !== undefined) {
      runtimeArgs.insert(
        "allow_minting",
        CLValueBuilder.bool(args.allowMinting)
      );
    }

    if (args.whitelistMode !== undefined) {
      runtimeArgs.insert(
        "whitelist_mode",
        CLValueBuilder.u8(args.whitelistMode)
      );
    }

    if (args.holderMode !== undefined) {
      runtimeArgs.insert("holder_mode", CLValueBuilder.u8(args.holderMode));
    }

    if (args.contractWhitelist !== undefined) {
      const list = buildHashListV2(args.contractWhitelist);
      runtimeArgs.insert("contract_whitelist", CLValueBuilder.list(list));
    }

    if (args.burnMode !== undefined) {
      runtimeArgs.insert("burn_mode", CLValueBuilder.u8(args.burnMode));
    }

    if (args.ownerReverseLookupMode !== undefined) {
      runtimeArgs.insert(
        "owner_reverse_lookup_mode",
        CLValueBuilder.u8(args.ownerReverseLookupMode)
      );
    }

    if (args.namedKeyConventionMode !== undefined) {
      runtimeArgs.insert(
        "named_key_convention",
        CLValueBuilder.u8(args.namedKeyConventionMode)
      );
    }

    if (args.acl_whitelist !== undefined) {
      const list = buildHashList(args.acl_whitelist);
      runtimeArgs.insert("acl_whitelist", CLValueBuilder.list(list));
    }

    if (args.transfer_filter_contract !== undefined) {
      runtimeArgs.insert(
        "transfer_filter_contract",
        new CLKey(
          new CLByteArray(
            convertHashStrToHashBuff(args.transfer_filter_contract)
          )
        )
      );
    }

    if (args.namedKeyConventionMode === NamedKeyConventionMode.V1_0Custom) {
      if (!args.accessKeyName || !args.hashKeyName) {
        throw new Error(
          "You need to provide 'accessKeyName' and 'hashKeyName' if you want to use NamedKeyConventionMode.V1_0Custom"
        );
      }
      runtimeArgs.insert(
        "access_key_name",
        CLValueBuilder.string(args.accessKeyName)
      );
      runtimeArgs.insert(
        "hash_key_name",
        CLValueBuilder.string(args.hashKeyName)
      );
    }

    if (args.eventsMode !== undefined) {
      runtimeArgs.insert("events_mode", CLValueBuilder.u8(args.eventsMode));
    }

    return this.contractClient.install(
      wasmToInstall,
      runtimeArgs,
      paymentAmount,
      deploySender,
      this.networkName,
      keys || []
    );
  }
}
