import {
  CasperClient,
  CLPublicKey,
  CasperServiceByJsonRPC,
} from "casper-js-sdk";
export const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const getDeploy = async (nodeURL: string, deployHash: string) => {
  // Sleep for a second to wait for the deploy to be processed
  await sleep(1000);
  const client = new CasperClient(nodeURL);
  let i = 300;
  while (i !== 0) {
    try {
      const [deploy, raw] = await client.getDeploy(deployHash);

      if (raw.execution_results.length !== 0) {
        // @ts-ignore
        if (raw.execution_results[0].result.Success) {
          return deploy;
        } else {
          // @ts-ignore
          throw Error(
            "Contract execution: " +
              // @ts-ignore
              raw.execution_results[0].result.Failure.error_message
          );
        }
      } else {
        i--;
        await sleep(1000);
        continue;
      }
    } catch (e: any) {
      if (e.message.includes("deploy not known")) {
        i--;
        await sleep(1000);
        continue;
      } else {
        throw e;
      }
    }
  }
  throw Error("Timeout after " + i + "s. Something's wrong");
};

export const getAccountInfo: any = async (
  nodeAddress: string,
  publicKey: CLPublicKey
) => {
  const client = new CasperServiceByJsonRPC(nodeAddress);
  const stateRootHash = await client.getStateRootHash();
  const accountHash = publicKey.toAccountHashStr();
  const blockState = await client.getBlockState(stateRootHash, accountHash, []);
  return blockState.Account;
};
