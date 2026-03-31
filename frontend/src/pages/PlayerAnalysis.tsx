import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload, FileJson, ChevronDown, ChevronUp } from "lucide-react";
import { uploadSingleFile } from "@/lib/api";
import { extractUuidFromFilename, getPlayerAvatarUrls, getPlayerUsername } from "@/lib/playerAvatar";

type KdStats = {
  kills: number;
  deaths: number;
  kd_ratio: number;
};

type StatEntry = {
  item: string;
  count: number;
  category?: string;
};

type PlayerAnalysisResult = {
  kd: KdStats;
  total_mined_blocks?: number;
  top_mined_blocks: StatEntry[];
  top_killed_mobs: StatEntry[];
  top_dangerous_mobs: StatEntry[];
};

const normalizeName = (value: string) =>
  value.replace("minecraft:", "").replace(/ /g, "_").toLowerCase();

const mobPrimaryColors: Record<string, string> = {
  pig: "#f7a8b8",
  cow: "#6b4a2f",
  sheep: "#f2f2f2",
  chicken: "#f5e7b2",
  zombie: "#4caf50",
  skeleton: "#9e9e9e",
  wither_skeleton: "#616161",
  enderman: "#7e57c2",
  creeper: "#66bb6a",
  spider: "#5d4037",
  cave_spider: "#26c6da",
  witch: "#8e24aa",
  drowned: "#26a69a",
  husk: "#c7a46b",
  guardian: "#4db6ac",
  blaze: "#ffb300",
  ghast: "#f5f5f5",
  slime: "#81c784",
  magma_cube: "#ff7043",
};

const getMobBarColor = (mobName: string) =>
  mobPrimaryColors[normalizeName(mobName)] ?? "hsl(var(--primary))";

const getBlockIconPath = (blockName: string) =>
  `/assets/minecraft/blocks/${normalizeName(blockName)}.png`;

const mobHeadUsernameMap: Record<string, string> = {
  zombie: "MHF_Zombie",
  skeleton: "MHF_Skeleton",
  wither_skeleton: "MHF_WSkeleton",
  creeper: "MHF_Creeper",
  spider: "MHF_Spider",
  cave_spider: "MHF_CaveSpider",
  enderman: "MHF_Enderman",
  witch: "MHF_Witch",
  drowned: "MHF_Drowned",
  husk: "MHF_Husk",
  guardian: "MHF_Guardian",
  cow: "MHF_Cow",
  pig: "MHF_Pig",
  sheep: "MHF_Sheep",
  chicken: "MHF_Chicken",
  blaze: "MHF_Blaze",
  ghast: "MHF_Ghast",
  slime: "MHF_Slime",
  magma_cube: "MHF_LavaSlime",
};

const MobHead = ({ mobName, className = "w-8 h-8" }: { mobName: string; className?: string }) => {
  const normalized = normalizeName(mobName);
  const username = mobHeadUsernameMap[normalized] ?? normalized;
  const [imageUrl, setImageUrl] = useState(`https://mc-heads.net/head/${username}/64`);

  return (
    <img
      src={imageUrl}
      alt={`${mobName} head`}
      className={`${className} border border-border bg-mc-inset shrink-0`}
      style={{ imageRendering: "pixelated" }}
      onError={(e) => {
        e.currentTarget.onerror = null;
        setImageUrl("/assets/minecraft/mobs/unknown.svg");
      }}
    />
  );
};

const safeNumber = (value: number | undefined) => (Number.isFinite(value) ? value : 0);

const PlayerAnalysis = () => {
  const [result, setResult] = useState<PlayerAnalysisResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [playerName, setPlayerName] = useState("Unknown Player");
  const [isMinedOpen, setIsMinedOpen] = useState(false);
  const [animateBars, setAnimateBars] = useState(false);

  const playerUuid = useMemo(() => extractUuidFromFilename(fileName), [fileName]);

  const avatarCandidates = useMemo(() => {
    if (!playerUuid) return null;
    return getPlayerAvatarUrls(playerUuid, 120);
  }, [playerUuid]);

  useEffect(() => {
    let isActive = true;

    if (!playerUuid) {
      setPlayerName("Unknown Player");
      return () => {
        isActive = false;
      };
    }

    setPlayerName("Loading...");
    getPlayerUsername(playerUuid)
      .then((resolvedName) => {
        if (isActive) {
          setPlayerName(resolvedName ?? "Unknown Player");
        }
      })
      .catch(() => {
        if (isActive) {
          setPlayerName("Unknown Player");
        }
      });

    return () => {
      isActive = false;
    };
  }, [playerUuid]);

  const maxKilledCount = useMemo(() => {
    if (!result?.top_killed_mobs?.length) return 1;
    return Math.max(...result.top_killed_mobs.map((row) => safeNumber(row.count)), 1);
  }, [result]);

  const maxDeathsCount = useMemo(() => {
    if (!result?.top_dangerous_mobs?.length) return 1;
    return Math.max(...result.top_dangerous_mobs.map((row) => safeNumber(row.count)), 1);
  }, [result]);

  const totalMinedBlocks = useMemo(() => {
    if (!result) return 0;
    if (typeof result.total_mined_blocks === "number") {
      return result.total_mined_blocks;
    }

    return result.top_mined_blocks.reduce((sum, block) => sum + safeNumber(block.count), 0);
  }, [result]);

  useEffect(() => {
    if (!result) {
      setAnimateBars(false);
      return;
    }

    setAnimateBars(false);
    const timer = setTimeout(() => setAnimateBars(true), 60);
    return () => clearTimeout(timer);
  }, [result]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      setError("FILE_ERROR: Player stats file must be .json");
      return;
    }

    setFileName(file.name);
    setError("");
    setResult(null);
    setAvatarIndex(0);
    setIsMinedOpen(false);
    setAnimateBars(false);
    setIsLoading(true);

    try {
      const response = (await uploadSingleFile("/player", "file", file)) as PlayerAnalysisResult;
      setResult(response);
    } catch (uploadError) {
      setError(`API_ERROR: ${(uploadError as Error).message}`);
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-mc-inset border-b-4 border-border px-6 py-3 flex items-center gap-6">
        <Link to="/" className="mc-button py-2 px-4 text-sm flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <span className="font-pixel text-xl text-foreground tracking-wider">PLAYER_ANALYSIS.PY</span>
      </nav>

      <main className="container mx-auto px-8 py-8">
        <section className="mb-8">
          <div className="mc-panel-inset p-8 text-center">
            <FileJson className="w-10 h-10 text-primary mx-auto mb-4" />
            <p className="font-pixel text-lg text-foreground mb-4">Import player stats JSON</p>
            <p className="font-mono text-xs text-muted-foreground mb-6">
              Displays K/D, top mined blocks, and top killed mobs with visuals
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="mc-button py-3 px-8 inline-flex items-center gap-3"
            >
              <Upload className="w-5 h-5" />
              Import JSON
            </button>
            {fileName && <p className="font-mono text-xs text-primary mt-4">&gt; Loaded: {fileName}</p>}
            {error && <p className="font-mono text-xs text-destructive mt-4">{error}</p>}
          </div>
        </section>

        <section>
          <div className="mc-panel-outset">
            <div className="mc-panel-header">Player Analysis Output</div>
            <div className="mc-panel-inset min-h-[420px] p-6">
              {isLoading ? (
                <div className="flex items-center justify-center h-[320px] border-2 border-dashed border-border">
                  <span className="font-pixel text-muted-foreground animate-pulse-glow">Running analysis...</span>
                </div>
              ) : result ? (
                <div className="space-y-6">
                  {avatarCandidates && (
                    <div className="mc-panel-inset p-5 border-2 border-yellow-600/70 bg-background/30 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex items-center gap-4">
                      <img
                        src={avatarCandidates[Math.min(avatarIndex, avatarCandidates.length - 1)]}
                        alt="Player avatar"
                        className="w-16 h-16 border border-border bg-mc-inset"
                        style={{ imageRendering: "pixelated" }}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          setAvatarIndex((currentIndex) =>
                            currentIndex < avatarCandidates.length - 1 ? currentIndex + 1 : currentIndex,
                          );
                        }}
                      />
                      <div>
                        <p className="font-pixel text-2xl text-foreground">{playerName}</p>
                        <p className="font-mono text-xs text-muted-foreground">Player Profile</p>
                      </div>
                    </div>

                      <div className="grid grid-cols-[1fr_auto] gap-3 min-w-[300px]">
                        <div className="space-y-1">
                          <div className="bg-mc-inset px-12 py-2">
                            <div className="font-mono text-md text-muted-foreground uppercase">Kills</div>
                            <div className="font-mono text-2xl text-primary tabular-nums leading-none">{result.kd.kills}</div>
                          </div>
                          <div className="bg-mc-inset px-12 py-2">
                            <div className="font-mono text-md text-muted-foreground uppercase">Deaths</div>
                            <div className="font-mono text-2xl text-destructive tabular-nums leading-none">{result.kd.deaths}</div>
                          </div>
                        </div>

                        <div className="bg-mc-inset px-5 py-3 flex flex-col justify-center items-center min-w-[110px]">
                          <div className="font-mono text-md text-muted-foreground uppercase">K/D</div>
                          <div className="font-mono text-4xl text-accent leading-none tabular-nums">{result.kd.kd_ratio}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mc-panel-inset p-6 space-y-5 border-2 border-border/80 bg-muted/20">
                    <h3 className="font-pixel text-2xl text-foreground mb-2 border-b-2 border-border pb-2">Player Stats</h3>

                    <div className="grid grid-cols-1 gap-4">
                      <div className="border-2 border-primary/35 p-4 bg-mc-inset/40">
                        <h4 className="font-pixel text-lg text-foreground mb-3">Top Killed Mobs</h4>
                        <div className="space-y-3">
                          {result.top_killed_mobs.map((mob, index) => {
                            const count = safeNumber(mob.count);
                            const widthPct = Math.max(8, Math.round((count / maxKilledCount) * 100));

                            return (
                              <div key={`${mob.item}-${index}`} className="grid grid-cols-[160px_56px_1fr_48px] gap-3 items-center">
                                <span className="font-mono text-sm text-foreground capitalize">{mob.item.replace(/_/g, " ")}</span>
                                <span className="font-mono text-sm text-foreground tabular-nums text-right">{count}</span>
                                <div className="relative h-10 bg-mc-inset border border-border overflow-hidden">
                                  <div
                                    className="h-full flex items-center justify-end pr-2 transition-all duration-1000 ease-out"
                                    style={{
                                      width: animateBars ? `${widthPct}%` : "0%",
                                      backgroundColor: getMobBarColor(mob.item),
                                    }}
                                  />
                                </div>
                                <MobHead mobName={mob.item} className="w-9 h-9" />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="border-2 border-destructive/35 p-4 bg-background/30">
                        <h4 className="font-pixel text-lg text-foreground mb-3">Most Dangerous Mobs</h4>
                        <div className="space-y-3">
                          {result.top_dangerous_mobs.map((mob, index) => {
                            const count = safeNumber(mob.count);
                            const widthPct = Math.max(8, Math.round((count / maxDeathsCount) * 100));

                            return (
                              <div key={`${mob.item}-${index}`} className="grid grid-cols-[160px_56px_1fr_48px] gap-3 items-center">
                                <span className="font-mono text-sm text-foreground capitalize">{mob.item.replace(/_/g, " ")}</span>
                                <span className="font-mono text-sm text-foreground tabular-nums text-right">{count}</span>
                                <div className="relative h-10 bg-mc-inset border border-border overflow-hidden">
                                  <div
                                    className="h-full flex items-center justify-end pr-2 transition-all duration-1000 ease-out"
                                    style={{
                                      width: animateBars ? `${widthPct}%` : "0%",
                                      backgroundColor: getMobBarColor(mob.item),
                                    }}
                                  />
                                </div>
                                <MobHead mobName={mob.item} className="w-9 h-9" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="w-full text-left border-2 border-orange-500/90 bg-mc-inset px-5 py-4 hover:border-orange-400 transition-colors"
                      onClick={() => setIsMinedOpen((current) => !current)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-pixel text-xl text-foreground uppercase flex items-center gap-2">
                          Total Mined Blocks
                          {isMinedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                        <span className="font-mono text-3xl text-orange-400 tabular-nums leading-none">{totalMinedBlocks}</span>
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground mt-1 uppercase">Click to {isMinedOpen ? "collapse" : "expand"}</div>
                    </button>
                    {isMinedOpen && (
                      <div className="border-2 border-orange-500/60 p-4 bg-mc-inset/35">
                        <h4 className="font-pixel text-xl text-foreground mb-3">Top Mined Blocks</h4>
                        <div className="space-y-2">
                          {result.top_mined_blocks.map((block, index) => (
                            <div key={`${block.item}-${index}`} className="flex items-center gap-3 py-2 border-b border-border/30">
                              <span
                                className={`font-mono text-base min-w-[2rem] ${
                                  index === 0
                                    ? "text-yellow-300"
                                    : index === 1
                                      ? "text-slate-300"
                                      : index === 2
                                        ? "text-amber-600"
                                        : "text-muted-foreground"
                                }`}
                              >
                                #{index + 1}
                              </span>
                              <img
                                src={getBlockIconPath(block.item)}
                                alt={block.item}
                                className="w-11 h-11 border border-border bg-mc-inset"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = "/assets/minecraft/blocks/unknown.svg";
                                }}
                              />
                              <span className="font-mono text-base text-foreground capitalize flex-1">{block.item.replace(/_/g, " ")}</span>
                              <span className="font-mono text-base text-orange-400 tabular-nums">{safeNumber(block.count)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[320px] border-2 border-dashed border-border">
                  <span className="font-pixel text-muted-foreground animate-pulse-glow">
                    No data loaded. Waiting for player stats JSON...
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default PlayerAnalysis;
