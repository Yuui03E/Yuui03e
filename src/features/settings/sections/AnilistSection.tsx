import { useState } from "react";
import { motion } from "framer-motion";
import { useLibrary } from "../../../store/library";

export function AnilistSection() {
  const { anilistUser, loginAnilist, logoutAnilist } = useLibrary();
  const [tokenInput, setTokenInput] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!tokenInput.trim()) return;
    setIsConnecting(true);
    setErrorMsg(null);
    try {
      await loginAnilist(tokenInput.trim());
      setTokenInput("");
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="glass rounded-3xl p-6 border border-white/[0.06] bg-yuui-surface/40"
    >
      <h2 className="text-lg font-semibold text-white/90 font-display flex items-center gap-2">
        <span>🌸</span> AniList Synchronization
      </h2>
      <p className="mt-1 text-xs text-yuui-muted">
        Connect your AniList account to sync your watch progress, scores, and list status in real-time.
      </p>

      {anilistUser ? (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-white/[0.02] p-4 border border-white/[0.04]">
          <div className="flex items-center gap-3">
            <img
              src={anilistUser.avatarUrl}
              alt={anilistUser.name}
              className="h-10 w-10 rounded-full border border-white/10"
            />
            <div>
              <span className="text-xs text-yuui-muted font-medium uppercase tracking-wider block">
                Connected Account
              </span>
              <span className="text-sm font-semibold text-white/90 block mt-0.5">
                {anilistUser.name}
              </span>
            </div>
          </div>
          <button
            onClick={logoutAnilist}
            className="glass shrink-0 rounded-xl px-4 py-2 text-xs font-semibold text-red-400 hover:text-red-300 transition-all hover:bg-red-500/10 border border-red-500/20 cursor-pointer"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs text-yuui-muted font-medium uppercase tracking-wider">
              Personal Access Token
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Paste AniList token..."
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value);
                  setErrorMsg(null);
                }}
                className="flex-1 glass rounded-xl px-3 py-2 text-xs text-white outline-none border border-white/[0.04] bg-white/[0.01]"
              />
              <button
                onClick={handleConnect}
                disabled={isConnecting || !tokenInput.trim()}
                className="glass shrink-0 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-white/[0.08] disabled:opacity-40 cursor-pointer"
              >
                {isConnecting ? "Connecting..." : "Connect"}
              </button>
            </div>
            {errorMsg && (
              <span className="text-[11px] font-medium text-red-400 mt-1 block">
                ⚠ {errorMsg}
              </span>
            )}
          </div>
          <div className="text-[11px] text-yuui-muted leading-relaxed">
            To connect, go to the{" "}
            <a
              href="https://anilist.co/settings/developer"
              target="_blank"
              rel="noreferrer"
              className="text-yuui-accent hover:underline font-bold"
            >
              AniList Developer Settings
            </a>{" "}
            page, click <strong>Create New Token</strong>, copy the generated token, and paste it above.
          </div>
        </div>
      )}
    </motion.section>
  );
}
