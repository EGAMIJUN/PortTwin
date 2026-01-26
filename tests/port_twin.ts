import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PortTwin } from "../target/types/port_twin";

describe("port_twin", () => {
  // 環境設定
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PortTwin as Program<PortTwin>;

  // テスト用のコンテナアカウント（鍵）を生成
  const containerAccount = anchor.web3.Keypair.generate();

  it("コンテナを新規登録できる (INSERT)", async () => {
    // 1. register_container を呼び出す
    const tx = await program.methods
      .registerContainer(
        "OOLU-1234567", // Container ID
        "VOY-001",      // Voyage No
        "BL-9999"       // B/L No
      )
      .accounts({
        containerAccount: containerAccount.publicKey,
        signer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([containerAccount])
      .rpc();

    console.log("📝 Transaction Signature:", tx);

    // 2. ブロックチェーンからデータを取得して確認
    const account = await program.account.containerState.fetch(
      containerAccount.publicKey
    );

    console.log("📦 On-Chain Data:", account);
    
    // 検証 (Assert)
    if (account.containerId !== "OOLU-1234567") throw new Error("ID不一致");
    if (account.status !== "GATE-IN") throw new Error("初期ステータス不正");
  });

  it("ステータスを更新できる (UPDATE)", async () => {
    // 1. update_status を呼び出す
    await program.methods
      .updateStatus("LOD") // ステータスを 'LOD' (Load) に変更
      .accounts({
        containerAccount: containerAccount.publicKey,
        currentOwner: provider.wallet.publicKey, // 署名者
      })
      .rpc();

    // 2. データを確認
    const account = await program.account.containerState.fetch(
      containerAccount.publicKey
    );
    
    console.log("🔄 Updated Status:", account.status);

    // 検証
    if (account.status !== "LOD") throw new Error("ステータス更新失敗");
  });
});