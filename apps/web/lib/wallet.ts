import { getAddress } from "viem";
export type WalletProvider = { request: (args:{method:string;params?:unknown[]})=>Promise<unknown>; on?: (event:string,listener:(value:unknown)=>void)=>void; removeListener?: (event:string,listener:(value:unknown)=>void)=>void; isMetaMask?: boolean };
export type WalletOption = { id:string; name:string; provider:WalletProvider; rdns?:string };
declare global { interface Window { ethereum?:WalletProvider } }
export function watchWallets(callback:(wallets:WalletOption[])=>void) {
  const providers = new Map<string,WalletOption>();
  const isMetaMask=(option:WalletOption) => option.rdns === "io.metamask" || option.provider.isMetaMask === true;
  const publish=()=>{
    const values=[...providers.values()],hasStandardProvider=values.some(option=>option.id!=="injected");
    const visible=hasStandardProvider?values.filter(option=>option.id!=="injected"):values;
    callback(visible.sort((a,b)=>Number(isMetaMask(a))-Number(isMetaMask(b))||a.name.localeCompare(b.name)));
  };
  const listener=(event:Event)=> {
    const detail=(event as CustomEvent<{info:{uuid:string;name?:string;rdns?:string};provider:WalletProvider}>).detail;
    if(!detail?.info?.uuid||typeof detail.provider?.request!=="function") return;
    for(const [id,option] of providers) if(option.provider===detail.provider) providers.delete(id);
    providers.set(detail.info.uuid,{id:detail.info.uuid,name:(detail.info.name||"浏览器钱包").slice(0,60),provider:detail.provider,rdns:detail.info.rdns});publish();
  };
  if(window.ethereum) providers.set("injected",{id:"injected",name:window.ethereum.isMetaMask?"MetaMask":"浏览器钱包",provider:window.ethereum,rdns:window.ethereum.isMetaMask?"io.metamask":undefined});
  window.addEventListener("eip6963:announceProvider",listener);
  window.dispatchEvent(new Event("eip6963:requestProvider"));publish();
  return ()=>window.removeEventListener("eip6963:announceProvider",listener);
}
export async function connectWallet(provider:WalletProvider) {
  const accounts = await provider.request({method:"eth_requestAccounts"}) as string[];
  if(!accounts?.[0]) throw new Error("钱包没有可用账户");
  const wallet = getAddress(accounts[0]);
  let chain = await provider.request({method:"eth_chainId"});
  if(Number(chain)!==10143) {
    try { await provider.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x279f"}]}); }
    catch(error) {
      if((error as {code?:number}).code!==4902) throw error;
      await provider.request({method:"wallet_addEthereumChain",params:[{chainId:"0x279f",chainName:"Monad Testnet",nativeCurrency:{name:"MON",symbol:"MON",decimals:18},rpcUrls:["https://testnet-rpc.monad.xyz"],blockExplorerUrls:["https://testnet.monadexplorer.com"]}]});
      await provider.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x279f"}]});
    }
    chain=await provider.request({method:"eth_chainId"});
    if(Number(chain)!==10143) throw new Error("请切换到 Monad Testnet 后重试");
  }
  const current=await provider.request({method:"eth_accounts"}) as string[];
  if(current[0]?.toLowerCase()!==wallet.toLowerCase()||Number(await provider.request({method:"eth_chainId"}))!==10143) throw new Error("钱包账户或网络已变化，请重新连接");
  return wallet;
}
