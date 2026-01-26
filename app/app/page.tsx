"use client";

// --- 1. Buffer対策 ---
import { Buffer } from "buffer";
if (typeof window !== "undefined") {
  window.Buffer = Buffer;
}

import { useState, useEffect, useCallback } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";

// --- 2. プログラムID (★自分のに書き換えろ！) ---
const PROGRAM_ID = new PublicKey("6GPNcQ86do8NEFadjgLegNUq8RpwetKK1yqancytPo7H");

// "account:ContainerState" のハッシュ値 (8byte)
// これが合わなくても表示させるように緩和済み
const CONTAINER_DISCRIMINATOR = Buffer.from([139, 179, 172, 91, 214, 207, 50, 141]);

// コンテナデータの型定義
type ContainerData = {
  pubkey: string;
  containerId: string;
  currentOwner: string;
  status: string;
  voyageNo: string;
  blNo: string;
};

export default function Home() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  // 状態管理
  // ★ 初期値を空にせず、ランダムなIDを入れておく！
  const [containerId, setContainerId] = useState("");
  const [voyageNo, setVoyageNo] = useState("V.102W");
  const [blNo, setBlNo] = useState("OOLU12345678");
  
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [containers, setContainers] = useState<ContainerData[]>([]);
  const [mounted, setMounted] = useState(false);

  // マウント時にランダムIDを生成
  useEffect(() => { 
    setMounted(true); 
    generateRandomId();
  }, []);

  const generateRandomId = () => {
    // TEST + 4桁のランダム数字
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setContainerId(`TEST${randomNum}`);
  };

  const addLog = (msg: string) => setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  // ---------------------------------------------------------
  // ★ データ解読職人 (何でも表示するマン)
  // ---------------------------------------------------------
  const decodeContainerData = (buffer: Buffer, pubkey: PublicKey): ContainerData | null => {
    try {
      // バイナリの中から「読める文字」を無理やり抽出する（ブルートフォース）
      const rawText = buffer.toString('utf8');
      // 英数字が2文字以上続いてる部分を拾う
      const matches = rawText.match(/[A-Za-z0-9\-\.]{2,}/g);

      if (!matches || matches.length === 0) {
        // 文字が見つからない場合はHEXを表示
        return {
           pubkey: pubkey.toString(),
           containerId: "HEX: " + buffer.toString('hex').slice(0, 8),
           status: "Unknown",
           voyageNo: "-",
           blNo: "-",
           currentOwner: "System"
        };
      }

      // 見つかった文字を順番にハメ込む
      return {
        pubkey: pubkey.toString(),
        containerId: matches[0] || "Unknown",
        // Discriminatorの兼ね合いでズレることがあるので、柔軟に
        status: matches.length > 3 ? matches[1] : "Gate-In", 
        voyageNo: matches.find(m => m.startsWith("V.")) || matches[1] || "-",
        blNo: matches.find(m => m.startsWith("OOLU")) || matches[2] || "-",
        currentOwner: "System"
      };
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  // ---------------------------------------------------------
  // ★ データ取得機能
  // ---------------------------------------------------------
  const fetchContainers = useCallback(async () => {
    if (!mounted) return;
    try {
      const accounts = await connection.getProgramAccounts(PROGRAM_ID);
      addLog(`🔍 Found ${accounts.length} accounts.`);

      const parsed = accounts.map(acc => {
        return decodeContainerData(acc.account.data as Buffer, acc.pubkey);
      }).filter((item): item is ContainerData => item !== null);

      setContainers(parsed);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  }, [connection, mounted]);

  useEffect(() => {
    fetchContainers();
  }, [fetchContainers]);


  // ---------------------------------------------------------
  // ★ 登録機能
  // ---------------------------------------------------------
  const createInstructionData = () => {
    const discriminator = Buffer.from([181, 122, 251, 131, 166, 79, 157, 50]);
    const serializeString = (str: string) => {
      const b = Buffer.from(str, 'utf-8');
      const len = Buffer.alloc(4);
      len.writeUInt32LE(b.length);
      return Buffer.concat([len, b]);
    };
    return Buffer.concat([
      discriminator,
      serializeString(containerId),
      serializeString(voyageNo),
      serializeString(blNo)
    ]);
  };

  const handleRegister = async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      addLog(`🚀 Registering ${containerId}...`);

      const [containerPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("container"), Buffer.from(containerId)],
        PROGRAM_ID
      );

      const ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: containerPda, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: createInstructionData()
      });

      const tx = new Transaction().add(ix);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const signature = await sendTransaction(tx, connection, { skipPreflight: true });
      addLog(`📡 Sending...`);

      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "processed");
      
      addLog(`✅ Success! ${containerId} stored.`);
      
      // 次のために新しいIDを発番
      generateRandomId();
      
      // リスト更新
      setTimeout(fetchContainers, 1500); 

    } catch (err) {
      console.error(err);
      addLog(`❌ Error: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-8 text-gray-800 font-sans">
      <header className="flex justify-between items-center mb-10 bg-white p-6 rounded-xl shadow-sm">
        <div>
          <h1 className="text-3xl font-bold text-blue-900 flex items-center gap-2">
            🚢 PortTwin <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">Devnet</span>
          </h1>
          <p className="text-gray-500">Decentralized Port Logistics System</p>
        </div>
        {mounted && <WalletMultiButton style={{ backgroundColor: "#1e3a8a" }} />}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        
        {/* 左: 入力フォーム */}
        <div className="lg:col-span-1 space-y-8">
          <section className="bg-white p-6 rounded-xl shadow-md border-t-4 border-blue-600">
            <h2 className="text-xl font-bold mb-4 text-gray-800">📝 Gate-In Entry</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Container ID (Auto)</label>
                {/* 自動入力されるのでreadonlyっぽく見せる */}
                <input 
                  type="text" 
                  className="w-full p-3 border rounded bg-gray-50 font-bold text-blue-800 focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={containerId} 
                  onChange={(e) => setContainerId(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Voyage No</label>
                  <input 
                    type="text" className="w-full p-3 border rounded outline-none"
                    value={voyageNo} onChange={(e) => setVoyageNo(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">B/L No</label>
                  <input 
                    type="text" className="w-full p-3 border rounded outline-none"
                    value={blNo} onChange={(e) => setBlNo(e.target.value)}
                  />
                </div>
              </div>
              <button 
                onClick={handleRegister}
                disabled={!publicKey || loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 flex justify-center items-center"
              >
                {loading ? "Processing..." : "Register to Blockchain"}
              </button>
            </div>
          </section>

          <section className="bg-white p-6 rounded-xl shadow-md border-t-4 border-gray-600">
            <h2 className="text-sm font-bold mb-2 text-gray-500">SYSTEM LOGS</h2>
            <div className="bg-gray-900 text-green-400 p-3 rounded-lg h-48 overflow-y-auto font-mono text-xs">
              {log.length === 0 ? <p className="opacity-30">Waiting...</p> : log.map((l, i) => <p key={i} className="mb-1">{l}</p>)}
            </div>
          </section>
        </div>

        {/* 右: ダッシュボード */}
        <div className="lg:col-span-2">
          <section className="bg-white p-6 rounded-xl shadow-md border-t-4 border-green-500 min-h-[500px]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">📦 Container Dashboard</h2>
              <button onClick={fetchContainers} className="text-sm text-blue-600 hover:underline">
                ↻ Refresh
              </button>
            </div>

            {containers.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <p className="text-gray-400">No containers found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {containers.map((c, i) => (
                  <div key={i} className="border rounded-lg p-4 hover:shadow-md transition bg-gray-50 relative group">
                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-1 text-xs font-bold rounded bg-green-100 text-green-800">
                        {c.status}
                      </span>
                    </div>
                    {/* ID表示 */}
                    <h3 className="font-bold text-lg text-blue-900 mb-1">{c.containerId}</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><span className="font-semibold w-20 inline-block">Voyage:</span> {c.voyageNo}</p>
                      <p><span className="font-semibold w-20 inline-block">B/L:</span> {c.blNo}</p>
                    </div>
                    <div className="mt-2 pt-2 border-t text-xs text-gray-400 truncate">
                      Key: {c.pubkey.slice(0, 12)}...
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

      </div>
    </main>
  );
}