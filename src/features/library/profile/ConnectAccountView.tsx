import { useState } from "react";
import { motion } from "framer-motion";
import { openUrl } from "@tauri-apps/plugin-opener";

export default function ConnectAccountView({ loginAnilist }: { loginAnilist: any }) {
  // Connection settings states
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
    } catch (err: any) {
      setErrorMsg(err.message || String(err));
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="relative flex h-full flex-col items-center justify-center p-6 text-white select-none overflow-hidden">
      {/* Subtle Professional Ambient Background Blurs */}
      <div className="absolute top-1/3 left-1/2 w-[400px] h-[400px] rounded-full bg-yuui-accent/5 blur-[100px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-1/3 left-1/2 w-[400px] h-[400px] rounded-full bg-yuui-accent2/5 blur-[100px] pointer-events-none -translate-x-1/2 translate-y-1/2" />

      <div className="w-full max-w-md relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full bg-white/[0.02] backdrop-blur-3xl border border-white/[0.08] rounded-3xl p-8 space-y-6 shadow-[0_20px_50px_rgba(0,0,0,0.2)]"
        >
          <div className="space-y-2 text-center">
            <h3 className="text-xl font-bold text-white font-display flex items-center justify-center gap-2.5">
              Log in with AniList
            </h3>
            <p className="text-xs text-yuui-muted font-sans leading-relaxed px-4">
              Connect your AniList account to synchronize your anime tracking lists, view ratings, and save your progress.
            </p>
          </div>

          {/* Clean borderless status text */}
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-sans font-semibold tracking-wider text-white/40 select-none">
            <span className={`w-1.5 h-1.5 rounded-full ${tokenInput.trim() ? 'bg-yuui-accent shadow-[0_0_6px_var(--accent)]' : 'bg-white/30 animate-pulse'} transition-all`} />
            <span className="uppercase text-[9px] tracking-widest font-bold">Status:</span>
            <span className={tokenInput.trim() ? 'text-yuui-accent font-bold' : 'text-white/45'}>
              {tokenInput.trim() ? 'Token Detected' : 'Awaiting Connection'}
            </span>
          </div>

          <div className="space-y-5">
            {/* Get Token Capsule Button */}
            <div className="flex justify-center">
              <button
                onClick={() => {
                  openUrl("https://anilist.co/api/v2/oauth/authorize?client_id=45032&response_type=token").catch((e) =>
                    console.error("Failed to open login link:", e)
                  );
                }}
                className="flex items-center justify-center gap-2 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/12 text-white/90 hover:text-white font-semibold font-sans px-5 py-3.5 text-xs shadow-sm transition-all duration-200 cursor-pointer active:scale-98"
              >
                <span>Get AniList token</span>
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-yuui-muted uppercase tracking-widest block font-sans">
                Enter the token
              </label>
              <textarea
                rows={4}
                placeholder="Paste your developer access token here..."
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value);
                  setErrorMsg(null);
                }}
                className="w-full rounded-2xl px-4 py-3 text-xs text-white outline-none border border-white/[0.06] bg-white/[0.02] focus:border-white/15 focus:bg-white/[0.04] transition-all font-mono resize-none leading-relaxed shadow-inner"
              />
            </div>

            <button
              onClick={handleConnect}
              disabled={isConnecting || !tokenInput.trim()}
              className="w-full rounded-2xl py-3.5 text-xs font-bold font-display text-white bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/18 hover:scale-[1.01] active:scale-98 transition-all cursor-pointer disabled:opacity-30 disabled:scale-100 disabled:border-white/[0.04] disabled:bg-white/[0.01] disabled:cursor-not-allowed flex items-center justify-center shadow-sm"
            >
              {isConnecting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Connecting...
                </span>
              ) : (
                "Continue"
              )}
            </button>

            {errorMsg && (
              <span className="text-[10px] font-medium text-red-400 mt-2 block text-center bg-red-500/10 border border-red-500/20 rounded-xl py-2.5 px-3">
                ⚠ {errorMsg}
              </span>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
