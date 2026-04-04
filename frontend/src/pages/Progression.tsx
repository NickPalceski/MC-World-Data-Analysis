import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload, FileJson, FileArchive } from "lucide-react";
import { uploadProgressionFiles } from "@/lib/api";
import { extractUuidFromFilename, getPlayerAvatarUrls, getPlayerUsername } from "@/lib/playerAvatar";

type ProgressionTimelineEntry = {
  advancement?: string;
  criterion?: string;
  timestamp?: string;
  done?: boolean;
};

type ProgressionAnalysisResult = {
  summary?: {
    total_advancements?: number;
    completed?: number;
    completion_rate?: number;
  };
  timeline?: ProgressionTimelineEntry[];
  insights?: {
    timeline?: {
      total_time?: string | null;
      advancements_per_hour?: number;
      highlights?: string[];
      milestones?: Array<{
        key?: string;
        label?: string;
        status?: "complete" | "incomplete";
        after_start?: string | null;
      }>;
      key_events?: Record<
        string,
        {
          advancement?: string;
          timestamp?: string;
          after_start?: string;
          hours_after_start?: number;
        }
      >;
      playstyle?: {
        classification?: string;
        confidence?: number;
        reason?: string;
      };
    };
    inventory?: {
      most_valuable_item?: {
        item?: string;
        count?: number;
        enchanted?: boolean;
      } | null;
      resource_richness?: {
        ores?: number;
        wood?: number;
        food?: number;
      };
      gear_level?: string;
      combat_readiness?: {
        armor_pieces?: number;
        armor_tier?: string;
        weapon_tier?: string;
        enchanted_combat_items?: number;
        status?: string;
        insight?: string;
      };
    } | null;
    player_state?: {
      health?: number;
      hunger?: number;
      xp_level?: number;
      classification?: string;
      insight?: string;
    } | null;
  };
  player_dat?: Record<string, unknown> | null;
  dat_file_received?: string | null;
};

const readNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
};

const toTitle = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const renderValue = (value: unknown, depth = 0): React.ReactNode => {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }
  if (typeof value === "boolean") {
    return <span className={value ? "text-primary" : "text-destructive"}>{String(value)}</span>;
  }
  if (typeof value === "number") {
    return <span className="text-accent">{value}</span>;
  }
  if (typeof value === "string") {
    return <span className="text-primary">{value}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">[ ]</span>;
    return (
      <div className="ml-4">
        {value.map((item, i) => (
          <div key={i} className="flex gap-2 py-1 border-b border-border/30">
            <span className="text-muted-foreground font-mono text-xs min-w-[2rem]">[{i}]</span>
            <div className="flex-1">{renderValue(item, depth + 1)}</div>
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    return (
      <div className={depth > 0 ? "ml-4" : ""}>
        {Object.entries(value as Record<string, unknown>).map(([key, val]) => (
          <div key={key} className="py-2 border-b border-border/30">
            <div className="flex gap-3 items-start">
              <span className="font-pixel text-foreground uppercase text-sm min-w-[120px] shrink-0">
                {key}:
              </span>
              <div className="flex-1 font-mono text-sm tabular-nums">
                {renderValue(val, depth + 1)}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return <span>{String(value)}</span>;
};

const Progression = () => {
  const [analysisResult, setAnalysisResult] = useState<unknown>(null);
  const [advancementsFile, setAdvancementsFile] = useState<File | null>(null);
  const [datFile, setDatFile] = useState<File | null>(null);
  const [advancementsName, setAdvancementsName] = useState("");
  const [datName, setDatName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [playerName, setPlayerName] = useState("Unknown Player");
  const advRef = useRef<HTMLInputElement>(null);
  const datRef = useRef<HTMLInputElement>(null);

  const playerUuid = extractUuidFromFilename(datName) ?? extractUuidFromFilename(advancementsName);
  const avatarCandidates = playerUuid ? getPlayerAvatarUrls(playerUuid, 120) : null;
  const progressionResult = analysisResult as ProgressionAnalysisResult | null;

  const playerDat = progressionResult?.player_dat ?? null;
  const insights = progressionResult?.insights;
  const timelineInsights = insights?.timeline;
  const inventoryInsights = insights?.inventory;
  const playerStateInsights = insights?.player_state;
  const summary = progressionResult?.summary ?? null;
  const healthValue = readNumber(playerDat?.health, 0);
  const foodLevelValue = readNumber(playerDat?.food_level, 0);
  const xpLevelValue = readNumber(playerDat?.xp_level, 0);
  const playerContextDisplay =
    playerDat && typeof playerDat === "object"
      ? {
          dimension: (playerDat as Record<string, unknown>).dimension,
          gamemode:
            typeof (playerDat as Record<string, unknown>).gamemode === "object" &&
            (playerDat as Record<string, unknown>).gamemode !== null
              ? ((playerDat as Record<string, unknown>).gamemode as Record<string, unknown>).name
              : (playerDat as Record<string, unknown>).gamemode,
        }
      : playerDat;

  const milestoneEntries = Array.isArray(timelineInsights?.milestones) ? timelineInsights.milestones : [];
  const completedMilestones = milestoneEntries.filter((milestone) => milestone.status === "complete");
  const incompleteMilestones = milestoneEntries.filter((milestone) => milestone.status !== "complete");

  const handleAdvancementsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      setError("FILE_ERROR: Advancements file must be .json");
      return;
    }

    setAdvancementsName(file.name);
    setAdvancementsFile(file);
    setAnalysisResult(null);
    setAvatarIndex(0);
    setError("");
  };

  const handleDatUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".dat")) {
      setError("FILE_ERROR: Player data file must be .dat");
      return;
    }

    setDatName(file.name);
    setDatFile(file);
    setAnalysisResult(null);
    setAvatarIndex(0);
    setError("");
  };

  const bothLoaded = advancementsFile !== null && datFile !== null;

  useEffect(() => {
    if (!bothLoaded || !advancementsFile || !datFile) {
      return;
    }

    const runAnalysis = async () => {
      setIsLoading(true);
      setError("");

      try {
        const result = await uploadProgressionFiles(advancementsFile, datFile);
        setAnalysisResult(result);
      } catch (uploadError) {
        setError(`API_ERROR: ${(uploadError as Error).message}`);
        setAnalysisResult(null);
      } finally {
        setIsLoading(false);
      }
    };

    runAnalysis();
  }, [bothLoaded, advancementsFile, datFile]);

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

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <nav className="bg-mc-inset border-b-4 border-border px-6 py-3 flex items-center gap-6">
        <Link to="/" className="mc-button py-2 px-4 text-sm flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <span className="font-pixel text-xl text-foreground tracking-wider">PROGRESSION.PY</span>
      </nav>

      <main className="container mx-auto px-8 py-8">
        {/* Upload Zone */}
        <section className="mb-8">
          <div className="mc-panel-inset p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Advancements JSON */}
              <div className="text-center">
                <FileJson className="w-10 h-10 text-primary mx-auto mb-4" />
                <p className="font-pixel text-lg text-foreground mb-2">Advancements File</p>
                <p className="font-mono text-xs text-muted-foreground mb-4">.json format</p>
                <input
                  ref={advRef}
                  type="file"
                  accept=".json"
                  onChange={handleAdvancementsUpload}
                  className="hidden"
                />
                <button
                  onClick={() => advRef.current?.click()}
                  className="mc-button py-3 px-6 inline-flex items-center gap-2 text-sm"
                >
                  <Upload className="w-4 h-4" />
                  Import JSON
                </button>
                {advancementsName && (
                  <p className="font-mono text-xs text-primary mt-3">
                    &gt; {advancementsName}
                  </p>
                )}
              </div>

              {/* Player Data .dat */}
              <div className="text-center">
                <FileArchive className="w-10 h-10 text-primary mx-auto mb-4" />
                <p className="font-pixel text-lg text-foreground mb-2">Player Data File</p>
                <p className="font-mono text-xs text-muted-foreground mb-4">.dat format</p>
                <input
                  ref={datRef}
                  type="file"
                  accept=".dat"
                  onChange={handleDatUpload}
                  className="hidden"
                />
                <button
                  onClick={() => datRef.current?.click()}
                  className="mc-button py-3 px-6 inline-flex items-center gap-2 text-sm"
                >
                  <Upload className="w-4 h-4" />
                  Import DAT
                </button>
                {datName && (
                  <p className="font-mono text-xs text-primary mt-3">
                    &gt; {datName}
                  </p>
                )}
              </div>
            </div>

            {error && (
              <p className="font-mono text-xs text-destructive mt-4 text-center">{error}</p>
            )}
          </div>
        </section>

        {/* Results Zone */}
        <section>
          <div className="mc-panel-outset">
            <div className="mc-panel-header">Progression Output</div>
            <div className="mc-panel-inset min-h-[400px] p-6">
              {isLoading ? (
                <div className="flex items-center justify-center h-[300px] border-2 border-dashed border-border">
                  <span className="font-pixel text-muted-foreground animate-pulse-glow">
                    Running analysis...
                  </span>
                </div>
              ) : analysisResult ? (
                <div className="space-y-8">
                  <div className="mc-panel-inset p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      <img
                        src={avatarCandidates ? avatarCandidates[Math.min(avatarIndex, avatarCandidates.length - 1)] : "/assets/minecraft/mobs/unknown.svg"}
                        alt="Player avatar"
                        className="w-16 h-16 border border-border bg-mc-inset"
                        style={{ imageRendering: "pixelated" }}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          if (avatarCandidates) {
                            setAvatarIndex((currentIndex) =>
                              currentIndex < avatarCandidates.length - 1 ? currentIndex + 1 : currentIndex,
                            );
                          }
                        }}
                      />
                      <div>
                        <p className="font-pixel text-lg text-foreground">{playerName}</p>
                        <p className="font-mono text-xs text-muted-foreground">Player Profile</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 md:gap-4">
                      <div className="px-10 py-2 flex items-center gap-2 min-w-[92px] justify-center">
                        <img src="/assets/minecraft/ui/mchalfheart.png" alt="Health" className="w-10 h-10" style={{ imageRendering: "pixelated" }} />
                        <span className="font-mono text-lg text-foreground">{healthValue.toFixed(1)}</span>
                      </div>
                      <div className="px-3 py-2 flex items-center gap-2 min-w-[92px] justify-center">
                        <img src="/assets/minecraft/ui/mchunger.png" alt="Food level" className="w-10 h-10" style={{ imageRendering: "pixelated" }} />
                        <span className="font-mono text-lg text-foreground">{Math.round(foodLevelValue)}</span>
                      </div>
                      <div className="px-3 py-2 flex items-center gap-2 min-w-[92px] justify-center">
                        <img src="/assets/minecraft/ui/bottleexp.webp" alt="XP level" className="w-10 h-10" style={{ imageRendering: "pixelated" }} />
                        <span className="font-mono text-lg text-foreground">{Math.round(xpLevelValue)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="font-pixel text-lg text-foreground mb-4 border-b border-border pb-2">
                        Player Data
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="mc-panel-inset p-3">
                          <p className="font-pixel text-xs text-muted-foreground mb-1">Dimension</p>
                          <p className="font-mono text-sm text-foreground">
                            {String((playerContextDisplay as Record<string, unknown> | null)?.dimension ?? "unknown")}
                          </p>
                        </div>
                        <div className="mc-panel-inset p-3">
                          <p className="font-pixel text-xs text-muted-foreground mb-1">Gamemode</p>
                          <p className="font-mono text-sm text-foreground">
                            {String((playerContextDisplay as Record<string, unknown> | null)?.gamemode ?? "unknown")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-pixel text-lg text-foreground mb-4 border-b border-border pb-2">
                      Progression Insights
                    </h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="mc-panel-inset p-4">
                          <p className="font-pixel text-sm text-foreground mb-2">Playstyle</p>
                          <p className="font-mono text-sm text-primary">
                            {toTitle(timelineInsights?.playstyle?.classification ?? "unknown")}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            Confidence: {Math.round(readNumber(timelineInsights?.playstyle?.confidence, 0) * 100)}%
                          </p>
                          <p className="font-mono text-xs text-muted-foreground mt-1">
                            {timelineInsights?.playstyle?.reason ?? "Not enough data for a reliable playstyle classification."}
                          </p>
                        </div>

                        <div className="mc-panel-inset p-4">
                          <p className="font-pixel text-sm text-foreground mb-2">Player State</p>
                          {playerStateInsights ? (
                            <div className="space-y-2 font-mono text-sm text-muted-foreground">
                              <p>State: {toTitle(playerStateInsights.classification ?? "unknown")}</p>
                              <p>{playerStateInsights.insight ?? ""}</p>
                            </div>
                          ) : (
                            <p className="font-mono text-sm text-muted-foreground">Upload a player DAT file to analyze risk state.</p>
                          )}
                        </div>
                      </div>

                      <div className="mc-panel-inset p-4">
                        <p className="font-pixel text-sm text-foreground mb-2">Timeline Pace</p>
                        <p className="font-mono text-sm text-muted-foreground">
                          Total time: {timelineInsights?.total_time ?? "unknown"}
                        </p>
                        <p className="font-mono text-sm text-muted-foreground">
                          Advancements/hour: {timelineInsights?.advancements_per_hour ?? 0}
                        </p>
                      </div>

                      <div className="mc-panel-inset p-4">
                        <p className="font-pixel text-sm text-foreground mb-2">Key Milestones</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="mc-panel-inset p-3">
                            <p className="font-pixel text-lg text-primary mb-2 text-left">Completed</p>
                            {completedMilestones.length > 0 ? (
                              <div className="space-y-1">
                                {completedMilestones.map((milestone) => (
                                  <div key={milestone.key} className="font-mono text-sm text-primary flex items-center justify-between gap-3">
                                    <span>{milestone.label}</span>
                                    <span className="text-right">{milestone.after_start ?? "complete"}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="font-mono text-sm text-muted-foreground text-left">No completed milestones yet.</p>
                            )}
                          </div>

                          <div className="mc-panel-inset p-3">
                            <p className="font-pixel text-lg text-destructive mb-2 text-left">Incomplete</p>
                            {incompleteMilestones.length > 0 ? (
                              <div className="space-y-1">
                                {incompleteMilestones.map((milestone) => (
                                  <div key={milestone.key} className="font-mono text-sm text-destructive flex items-center justify-between gap-3">
                                    <span>{milestone.label}</span>
                                    <span className="text-right">incomplete</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="font-mono text-sm text-muted-foreground text-right">All tracked milestones completed.</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mc-panel-inset p-4">
                        <p className="font-pixel text-sm text-foreground mb-2">Inventory Insights</p>
                        {inventoryInsights ? (
                          <div className="space-y-2 font-mono text-sm text-muted-foreground">
                            <p>
                              Most valuable item: {inventoryInsights.most_valuable_item?.item ?? "unknown"}
                              {inventoryInsights.most_valuable_item?.enchanted ? " (enchanted)" : ""}
                            </p>
                            <p>
                              Resource richness: ores {inventoryInsights.resource_richness?.ores ?? 0}, wood {inventoryInsights.resource_richness?.wood ?? 0}, food {inventoryInsights.resource_richness?.food ?? 0}
                            </p>
                            <p>Gear level: {toTitle(inventoryInsights.gear_level ?? "unknown")}</p>
                            <p>
                              Combat readiness: {toTitle(inventoryInsights.combat_readiness?.status ?? "unknown")}
                            </p>
                            <p>
                              Armor pieces: {inventoryInsights.combat_readiness?.armor_pieces ?? 0}, armor tier {toTitle(inventoryInsights.combat_readiness?.armor_tier ?? "none")}, weapon tier {toTitle(inventoryInsights.combat_readiness?.weapon_tier ?? "none")}, enchanted combat items {inventoryInsights.combat_readiness?.enchanted_combat_items ?? 0}
                            </p>
                            <p>{inventoryInsights.combat_readiness?.insight ?? ""}</p>
                          </div>
                        ) : (
                          <p className="font-mono text-sm text-muted-foreground">Upload a player DAT file to unlock inventory insights.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-pixel text-lg text-foreground mb-4 border-b border-border pb-2">
                      Advancement Summary
                    </h3>
                    <div className="font-mono text-sm space-y-2">
                      <p className="text-muted-foreground">
                        TOTAL_ADVANCEMENTS: <span className="text-accent">{summary?.total_advancements ?? 0}</span>
                      </p>
                      <p className="text-muted-foreground">
                        COMPLETED: <span className="text-accent">{summary?.completed ?? 0}</span>
                      </p>
                      <p className="text-muted-foreground">
                        COMPLETION_RATE (completed / total_advancements): <span className="text-accent">{readNumber(summary?.completion_rate, 0).toFixed(2)}</span>
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[300px] border-2 border-dashed border-border">
                  <span className="font-pixel text-muted-foreground animate-pulse-glow">
                    {!advancementsFile && !datFile
                      ? "Import both files to begin analysis..."
                      : "Waiting for remaining file..."}
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

export default Progression;
