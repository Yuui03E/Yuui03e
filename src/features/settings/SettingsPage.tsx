import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLibrary } from "../../store/library";
import { getSetting, setSetting, testAnidbConnection } from "../../lib/api";
import { invoke } from "@tauri-apps/api/core";

export default function SettingsPage() {
  const { folder, chooseFolder, init } = useLibrary();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [testResult, setTestResult] = useState<{ status: "success" | "error" | "idle"; message: string }>({
    status: "idle",
    message: "",
  });

  const [ffmpegPath, setFfmpegPath] = useState("");
  const [ffprobePath, setFfprobePath] = useState("");
  const [savingMedia, setSavingMedia] = useState(false);
  const [mediaSaveStatus, setMediaSaveStatus] = useState<"idle" | "success" | "error">("idle");

  const [anilistToken, setAnilistToken] = useState("");
  const [anilistClientId, setAnilistClientId] = useState("45032");
  const [anilistClientSecret, setAnilistClientSecret] = useState("");
  const [viewer, setViewer] = useState<{ name: string; avatar: string } | null>(null);
  const [connectingAnilist, setConnectingAnilist] = useState(false);
  const [anilistStatus, setAnilistStatus] = useState<"idle" | "success" | "error">("idle");

  const [tmdbKey, setTmdbKey] = useState("");
  const [savingTmdb, setSavingTmdb] = useState(false);
  const [tmdbSaveStatus, setTmdbSaveStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    init();
    // Load AniDB credentials on load
    getSetting("anidb_username").then((val) => setUsername(val ?? ""));
    getSetting("anidb_password").then((val) => setPassword(val ?? ""));
    // Load Media settings on load
    getSetting("ffmpeg_path").then((val) => setFfmpegPath(val ?? ""));
    getSetting("ffprobe_path").then((val) => setFfprobePath(val ?? ""));
    // Load TMDB settings on load
    getSetting("tmdb_api_key").then((val) => setTmdbKey(val ?? ""));
    // Load AniList settings on load
    getSetting("anilist_client_id").then((val) => setAnilistClientId(val ?? "45032"));
    getSetting("anilist_client_secret").then((val) => setAnilistClientSecret(val ?? ""));
    getSetting("anilist_token").then(async (tok) => {
      if (tok) {
        setAnilistToken(tok);
        try {
          const v = await verifyAniListToken(tok);
          if (v) {
            setViewer({ name: v.name, avatar: v.avatar?.large || "" });
          }
        } catch {
          // expired or invalid
        }
      }
    });
  }, []);

  const verifyTmdbKey = async (key: string) => {
    if (!key.trim()) return false;
    try {
      const resp = await fetch(`https://api.themoviedb.org/3/configuration?api_key=${key}`);
      return resp.ok;
    } catch {
      return false;
    }
  };

  const handleSaveTmdb = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTmdb(true);
    setTmdbSaveStatus("idle");
    try {
      if (!tmdbKey.trim()) {
        await setSetting("tmdb_api_key", "");
        setTmdbSaveStatus("success");
        setTimeout(() => setTmdbSaveStatus("idle"), 3000);
        return;
      }
      const isValid = await verifyTmdbKey(tmdbKey);
      if (isValid) {
        await setSetting("tmdb_api_key", tmdbKey);
        setTmdbSaveStatus("success");
        setTimeout(() => setTmdbSaveStatus("idle"), 3000);
      } else {
        setTmdbSaveStatus("error");
      }
    } catch {
      setTmdbSaveStatus("error");
    } finally {
      setSavingTmdb(false);
    }
  };

  const verifyAniListToken = async (token: string) => {
    const resp = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ query: "query { Viewer { id name avatar { large } } }" })
    });
    if (!resp.ok) {
      throw new Error("Invalid token or API error");
    }
    const json = await resp.json();
    return json.data?.Viewer;
  };

  const handleAuthorize = async () => {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    const clientId = anilistClientId.trim() || "45032";
    const responseType = anilistClientSecret.trim() ? "code" : "token";
    await openUrl(`https://anilist.co/api/v2/oauth/authorize?client_id=${clientId}&redirect_uri=https://anilist.co/api/v2/oauth/pin&response_type=${responseType}`);
  };

  const handleOpenDeveloperSettings = async () => {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl("https://anilist.co/settings/developer");
  };

  const exchangeAuthCodeForToken = async (code: string, clientId: string, secret: string): Promise<string> => {
    return await invoke<string>("exchange_anilist_code", {
      code: code.trim(),
      clientId,
      clientSecret: secret,
      redirectUri: "https://anilist.co/api/v2/oauth/pin",
    });
  };

  const handleConnectAnilist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anilistToken.trim()) return;
    setConnectingAnilist(true);
    setAnilistStatus("idle");
    try {
      let finalToken = anilistToken.trim();
      const secret = anilistClientSecret.trim();
      const clientId = anilistClientId.trim() || "45032";

      // Auto-detect if this looks like a raw authorization code (def502 prefix)
      // rather than a JWT Bearer token (eyJ prefix).
      const isAuthCode = finalToken.startsWith("def5020") || (!finalToken.startsWith("eyJ") && finalToken.length > 100);

      if (secret || isAuthCode) {
        try {
          finalToken = await exchangeAuthCodeForToken(finalToken, clientId, secret);
        } catch (err) {
          setAnilistStatus("error");
          console.error("Token exchange failed:", err);
          setConnectingAnilist(false);
          return;
        }
      }

      const v = await verifyAniListToken(finalToken);
      if (v) {
        await setSetting("anilist_token", finalToken);
        await setSetting("anilist_client_id", clientId);
        await setSetting("anilist_client_secret", secret);
        await setSetting("anilist_username", v.name);
        await setSetting("anilist_avatar", v.avatar?.large || "");
        setViewer({ name: v.name, avatar: v.avatar?.large || "" });
        setAnilistStatus("success");
      } else {
        setAnilistStatus("error");
      }
    } catch {
      setAnilistStatus("error");
    } finally {
      setConnectingAnilist(false);
    }
  };

  const handleDisconnectAnilist = async () => {
    await setSetting("anilist_token", "");
    await setSetting("anilist_username", "");
    await setSetting("anilist_avatar", "");
    await setSetting("anilist_client_secret", "");
    setViewer(null);
    setAnilistToken("");
    setAnilistStatus("idle");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveStatus("idle");
    try {
      if (!username.trim() || !password.trim()) {
        await setSetting("anidb_username", username);
        await setSetting("anidb_password", password);
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 3000);
        return;
      }
      // Save temporarily to test connection
      await setSetting("anidb_username", username);
      await setSetting("anidb_password", password);
      await testAnidbConnection();
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
      // Clear incorrect config to avoid saving incorrect info
      await setSetting("anidb_username", "");
      await setSetting("anidb_password", "");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMedia(true);
    setMediaSaveStatus("idle");
    try {
      await setSetting("ffmpeg_path", ffmpegPath);
      await setSetting("ffprobe_path", ffprobePath);
      setMediaSaveStatus("success");
      setTimeout(() => setMediaSaveStatus("idle"), 3000);
    } catch {
      setMediaSaveStatus("error");
    } finally {
      setSavingMedia(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult({ status: "idle", message: "Connecting to AniDB UDP API..." });
    try {
      // First save the current values in input fields
      await setSetting("anidb_username", username);
      await setSetting("anidb_password", password);
      
      const msg = await testAnidbConnection();
      setTestResult({ status: "success", message: msg });
    } catch (e) {
      setTestResult({ status: "error", message: String(e) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 pt-5 pb-8">
      {/* Header */}
      <div>
        <motion.h1
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="font-display text-4xl font-bold"
        >
          App <span className="text-gradient">Settings</span>
        </motion.h1>
        <p className="mt-1 text-sm text-yuui-muted">
          Manage your library folders, accounts, and integrations.
        </p>
      </div>

      <div className="mt-8 flex-1 space-y-6 max-w-3xl">
        {/* Library Section */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-3xl p-6 border border-white/[0.06] bg-yuui-surface/40"
        >
          <h2 className="text-lg font-semibold text-white/90 font-display flex items-center gap-2">
            <span>🗂️</span> Library Folders
          </h2>
          <p className="mt-1 text-xs text-yuui-muted">
            The directories scanned recursively for video files to build your local anime library.
          </p>

          <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-white/[0.03] p-4 border border-white/[0.04]">
            <div className="min-w-0 flex-1">
              <span className="text-xs text-yuui-muted font-medium uppercase tracking-wider block">
                Primary Folder Path
              </span>
              <span className="text-sm text-white/80 font-mono truncate block mt-1">
                {folder || "No folder selected"}
              </span>
            </div>
            <button
              onClick={chooseFolder}
              className="glass shrink-0 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-white/[0.08]"
            >
              Choose Folder
            </button>
          </div>
        </motion.section>

        {/* AniList Sync Section */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="glass rounded-3xl p-6 border border-white/[0.06] bg-yuui-surface/40"
        >
          <h2 className="text-lg font-semibold text-white/90 font-display flex items-center gap-2">
            <span>🌸</span> AniList Sync Account
          </h2>
          <p className="mt-1 text-xs text-yuui-muted">
            Connect your AniList account to synchronize your watch status, score, progress, and favorites in real-time.
          </p>

          {viewer ? (
            <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-white/[0.03] p-4 border border-white/[0.04]">
              <div className="flex items-center gap-3">
                {viewer.avatar ? (
                  <img src={viewer.avatar} alt="" className="h-10 w-10 rounded-full border border-white/10" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-yuui-accent2/20 grid place-items-center text-lg">👤</div>
                )}
                <div>
                  <span className="text-[10px] text-yuui-muted font-semibold uppercase tracking-wider block">Connected Account</span>
                  <span className="text-sm font-semibold text-white">{viewer.name}</span>
                </div>
              </div>
              <button
                onClick={handleDisconnectAnilist}
                className="rounded-xl bg-red-500/10 hover:bg-red-500/20 px-4 py-2 text-xs font-semibold text-red-400 hover:text-white transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="flex flex-col gap-4 rounded-2xl bg-white/[0.03] p-4 border border-white/[0.04]">
                <div>
                  <h3 className="text-sm font-semibold text-white">Step 1: Get Access Token</h3>
                  <p className="mt-1 text-xs text-yuui-muted leading-relaxed">
                    To authorize the application, you can use our default Client ID or register a custom one under{" "}
                    <button
                      type="button"
                      onClick={handleOpenDeveloperSettings}
                      className="text-yuui-accent hover:underline inline font-semibold bg-transparent border-none p-0 cursor-pointer"
                    >
                      AniList Developer Settings
                    </button>
                    .
                  </p>
                  <div className="mt-2.5 rounded-xl bg-yellow-500/10 p-3 text-xs text-yellow-300 border border-yellow-500/20 leading-normal">
                    <span className="font-semibold block mb-1">⚠️ Client Configuration Info:</span>
                    When registering your developer client on AniList, make sure to set:
                    <ul className="list-disc list-inside mt-1 ml-1 space-y-1">
                      <li><strong>Redirect URI:</strong> <code className="bg-white/5 px-1.5 py-0.5 rounded text-yuui-accent">https://anilist.co/api/v2/oauth/pin</code></li>
                      <li><strong>Client Type:</strong> Either <code className="bg-white/5 px-1.5 py-0.5 rounded text-yuui-accent">Personal Client</code> (which returns the Token directly) or <code className="bg-white/5 px-1.5 py-0.5 rounded text-yuui-accent">Web Client</code> (requires pasting the Client Secret below).</li>
                    </ul>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-yuui-muted uppercase tracking-wider block">
                      AniList Client ID
                    </label>
                    <input
                      type="text"
                      value={anilistClientId}
                      onChange={(e) => setAnilistClientId(e.target.value)}
                      placeholder="Enter Client ID (Default: 45032)"
                      className="w-full glass rounded-xl bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-yuui-muted/50 border border-white/[0.06] focus:border-yuui-accent/40"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-yuui-muted uppercase tracking-wider block">
                      AniList Client Secret (Web Client Flow)
                    </label>
                    <input
                      type="password"
                      value={anilistClientSecret}
                      onChange={(e) => setAnilistClientSecret(e.target.value)}
                      placeholder="Enter Client Secret if Web Client Type"
                      className="w-full glass rounded-xl bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-yuui-muted/50 border border-white/[0.06] focus:border-yuui-accent/40"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleAuthorize}
                    className="rounded-xl bg-yuui-accent2/20 hover:bg-yuui-accent2/35 px-4 py-2 text-xs font-semibold text-yuui-accent2 hover:text-white transition-colors"
                  >
                    Authorize
                  </button>
                </div>
              </div>

              <form onSubmit={handleConnectAnilist} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-yuui-muted uppercase tracking-wider block mb-1">
                    Step 2: Paste Access Token or Authorization Code
                  </label>
                  <input
                    type="password"
                    value={anilistToken}
                    onChange={(e) => setAnilistToken(e.target.value)}
                    placeholder="Paste the copied token or PIN code here"
                    className="w-full glass rounded-xl bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-yuui-muted/50 border border-white/[0.06] focus:border-yuui-accent/40"
                  />
                </div>
                <button
                  type="submit"
                  disabled={connectingAnilist || !anilistToken.trim()}
                  className="rounded-xl bg-gradient-to-r from-yuui-accent to-yuui-accent2 px-5 py-2.5 text-xs font-semibold text-white shadow-glow hover:opacity-90 disabled:opacity-40 transition-all"
                >
                  {connectingAnilist ? "Connecting..." : "Connect Account"}
                </button>

                {anilistStatus === "success" && (
                  <p className="text-xs text-green-400 font-medium mt-1">✓ Account connected successfully!</p>
                )}
                {anilistStatus === "error" && (
                  <p className="text-xs text-red-400 font-medium mt-1">✗ Failed to connect account. Verify your token.</p>
                )}
              </form>
            </div>
          )}
        </motion.section>

        {/* AniDB Integration Section */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-3xl p-6 border border-white/[0.06] bg-yuui-surface/40"
        >
          <h2 className="text-lg font-semibold text-white/90 font-display flex items-center gap-2">
            <span>🌸</span> AniDB Integration
          </h2>
          <p className="mt-1 text-xs text-yuui-muted">
            Configure AniDB credentials to identify files using exact ed2k hash lookup. 
            This resolves release groups and episode data, surviving directory relocations and renaming.
          </p>

          <form onSubmit={handleSave} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-yuui-muted uppercase tracking-wider">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your AniDB username"
                  className="w-full glass rounded-xl bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-yuui-muted/50 border border-white/[0.06] focus:border-yuui-accent/40"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-yuui-muted uppercase tracking-wider block">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your AniDB password"
                    className="w-full glass rounded-xl bg-transparent pl-4 pr-10 py-2.5 text-sm outline-none placeholder:text-yuui-muted/50 border border-white/[0.06] focus:border-yuui-accent/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-yuui-muted hover:text-white"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-yuui-accent to-yuui-accent2 px-5 py-2.5 text-sm font-semibold text-white shadow-glow hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  {saving ? "Saving..." : "Save Credentials"}
                </button>
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing || !username || !password}
                  className="glass rounded-xl px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.08] disabled:opacity-40 transition-all"
                >
                  {testing ? "Testing..." : "Test Connection"}
                </button>
              </div>

              {saveStatus === "success" && (
                <span className="text-sm text-green-400 font-medium">✓ Credentials saved successfully!</span>
              )}
              {saveStatus === "error" && (
                <span className="text-sm text-red-400 font-medium">✗ Failed to save credentials.</span>
              )}
            </div>
          </form>

          {/* Test connection alert message */}
          <AnimatePresence mode="wait">
            {testResult.message && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`mt-4 rounded-2xl p-4 border text-sm ${
                  testResult.status === "success"
                    ? "bg-green-500/10 border-green-500/20 text-green-300"
                    : testResult.status === "error"
                    ? "bg-red-500/10 border-red-500/20 text-red-300"
                    : "bg-white/5 border-white/10 text-yuui-muted"
                }`}
              >
                {testResult.status === "success" && "✓ "}
                {testResult.status === "error" && "✗ "}
                {testResult.message}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* Media Settings Section */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="glass rounded-3xl p-6 border border-white/[0.06] bg-yuui-surface/40"
        >
          <h2 className="text-lg font-semibold text-white/90 font-display flex items-center gap-2">
            <span>🎬</span> Media & FFmpeg Paths
          </h2>
          <p className="mt-1 text-xs text-yuui-muted">
            Configure executable paths for FFmpeg and FFprobe. If left empty, the app will attempt to resolve them from your system PATH.
          </p>

          <form onSubmit={handleSaveMedia} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-yuui-muted uppercase tracking-wider">
                  FFmpeg Path
                </label>
                <input
                  type="text"
                  value={ffmpegPath}
                  onChange={(e) => setFfmpegPath(e.target.value)}
                  placeholder="e.g. C:\Software\ffmpeg.exe (Optional)"
                  className="w-full glass rounded-xl bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-yuui-muted/50 border border-white/[0.06] focus:border-yuui-accent/40"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-yuui-muted uppercase tracking-wider">
                  FFprobe Path
                </label>
                <input
                  type="text"
                  value={ffprobePath}
                  onChange={(e) => setFfprobePath(e.target.value)}
                  placeholder="e.g. C:\Software\ffprobe.exe (Optional)"
                  className="w-full glass rounded-xl bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-yuui-muted/50 border border-white/[0.06] focus:border-yuui-accent/40"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 pt-2">
              <button
                type="submit"
                disabled={savingMedia}
                className="rounded-xl bg-gradient-to-r from-yuui-accent to-yuui-accent2 px-5 py-2.5 text-sm font-semibold text-white shadow-glow hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {savingMedia ? "Saving..." : "Save Media Paths"}
              </button>

              {mediaSaveStatus === "success" && (
                <span className="text-sm text-green-400 font-medium">✓ Paths saved successfully!</span>
              )}
              {mediaSaveStatus === "error" && (
                <span className="text-sm text-red-400 font-medium">✗ Failed to save paths.</span>
              )}
            </div>
          </form>
        </motion.section>

        {/* TMDB Integration Section */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="glass rounded-3xl p-6 border border-white/[0.06] bg-yuui-surface/40"
        >
          <h2 className="text-lg font-semibold text-white/90 font-display flex items-center gap-2">
            <span>🎬</span> TMDB Backdrop Integration
          </h2>
          <p className="mt-1 text-xs text-yuui-muted">
            Provide a TMDB API Key (v3 auth) to dynamically load high-resolution backdrop artwork and title logos.
          </p>

          <form onSubmit={handleSaveTmdb} className="mt-4 space-y-4">
            <div>
              <label className="text-xs font-semibold text-yuui-muted uppercase tracking-wider block mb-1">
                TMDB API Key (v3)
              </label>
              <input
                type="password"
                value={tmdbKey}
                onChange={(e) => setTmdbKey(e.target.value)}
                placeholder="Paste your TMDB API Key here"
                className="w-full glass rounded-xl bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-yuui-muted/50 border border-white/[0.06] focus:border-yuui-accent/40"
              />
            </div>

            <div className="flex items-center justify-between gap-4 pt-2">
              <button
                type="submit"
                disabled={savingTmdb}
                className="rounded-xl bg-gradient-to-r from-yuui-accent to-yuui-accent2 px-5 py-2.5 text-sm font-semibold text-white shadow-glow hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {savingTmdb ? "Saving..." : "Save Key"}
              </button>

              {tmdbSaveStatus === "success" && (
                <span className="text-sm text-green-400 font-medium">✓ TMDB API Key saved successfully!</span>
              )}
              {tmdbSaveStatus === "error" && (
                <span className="text-sm text-red-400 font-medium">✗ Failed to save key.</span>
              )}
            </div>
          </form>
        </motion.section>

        {/* System Info Section */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-3xl p-6 border border-white/[0.06] bg-yuui-surface/40"
        >
          <h2 className="text-lg font-semibold text-white/90 font-display flex items-center gap-2">
            <span>⚙️</span> System Information
          </h2>
          <div className="mt-4 grid gap-4 grid-cols-2 text-xs">
            <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.03]">
              <span className="text-yuui-muted block font-medium">Frontend</span>
              <span className="text-white/80 font-mono mt-1 block">React 19 + Vite 8 + TS</span>
            </div>
            <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.03]">
              <span className="text-yuui-muted block font-medium">Backend Shell</span>
              <span className="text-white/80 font-mono mt-1 block">Tauri v2 + Rust</span>
            </div>
            <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.03]">
              <span className="text-yuui-muted block font-medium">Local Database</span>
              <span className="text-white/80 font-mono mt-1 block">SQLite via SQLx</span>
            </div>
            <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.03]">
              <span className="text-yuui-muted block font-medium">Hashing Engine</span>
              <span className="text-white/80 font-mono mt-1 block">MD4 (ED2K)</span>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
