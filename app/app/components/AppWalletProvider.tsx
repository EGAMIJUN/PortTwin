"use client";

import React, { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
// デフォルトのスタイルを読み込む
import "@solana/wallet-adapter-react-ui/styles.css";

export default function AppWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // 今回はテスト環境 (Localhost) を使う
  // 本番 (Devnet) に行くときはここを変えるだけや
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => "http://127.0.0.1:8899", [network]);

  const wallets = useMemo(
    () => [
      // 必要ならここに特定のウォレットアダプターを追加できる
      // 空配列でも標準的なウォレットは使える
    ],
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}