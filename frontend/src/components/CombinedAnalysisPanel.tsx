import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, FileJson, FileArchive } from "lucide-react";
import { uploadSingleFile, uploadProgressionFiles } from "@/lib/api";
import { cn } from "@/lib/utils";
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

type AdvancementBranchMl = {
  ok: boolean;
  reason?: string;
  accuracy?: number;
  precision_macro?: number;
  recall_macro?: number;
  f1_macro?: number;
  n_events?: number;
  n_supervised_rows?: number;
  n_train?: number;
  n_test?: number;
  dropped_test_unseen_label?: number;
  label_names?: string[];
  confusion_matrix?: number[][];
  per_class?: Array<{
    label: string;
    precision: number;
    recall: number;
    f1: number;
    support: number;
  }>;
};

type ProgressionAnalysisResult = {
  summary?: {
    total_advancements?: number;
    completed?: number;
    completion_rate?: number;
  };
  timeline?: unknown[];
  insights?: {
    timeline?: {
      total_time?: string | null;
      advancements_per_hour?: number;
      milestones?: Array<{
        key?: string;
        label?: string;
        status?: "complete" | "incomplete";
        after_start?: string | null;
      }>;
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
      classification?: string;
      insight?: string;
    } | null;
  };
  player_dat?: Record<string, unknown> | null;
  advancement_branch_ml?: AdvancementBranchMl;
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

const MobHead = ({ mobName, className = "w-9 h-9" }: { mobName: string; className?: string }) => {
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

const readNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const toTitle = (value: string) =>
  value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const errMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

const AdvancementBranchMlBlock = ({ ml }: { ml: AdvancementBranchMl }) => {
  if (!ml.ok) {
    return (
      <div className="border-2 border-border/70 bg-mc-inset/40 p-4 sm:p-5 w-full">
        <h3 className="font-pixel text-lg text-foreground mb-2">Advancement branch model</h3>
        <p className="font-mono text-sm text-muted-foreground">{ml.reason ?? "Model not available."}</p>
      </div>
    );
  }

  const labels = ml.label_names ?? [];
  const matrix = ml.confusion_matrix ?? [];
  const flat = matrix.flat();
  const maxCell = Math.max(1, ...flat);

  return (
    <div className="border-2 border-primary/40 bg-mc-inset/30 p-4 sm:p-6 w-full space-y-4">
      <h3 className="font-pixel text-lg text-foreground">Advancement branch model</h3>
      <p className="font-mono text-xs text-muted-foreground max-w-[70ch]">
        Predicts the coarse advancement branch (e.g. story, nether) of each unlock from prior progression
        only; time-ordered train/test split. Rows below are true labels, columns are predictions.
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-sm text-muted-foreground">
        <span>
          Accuracy:{" "}
          <span className="text-accent tabular-nums">{((ml.accuracy ?? 0) * 100).toFixed(1)}%</span>
        </span>
        <span>
          Precision (macro):{" "}
          <span className="text-accent tabular-nums">{((ml.precision_macro ?? 0) * 100).toFixed(1)}%</span>
        </span>
        <span>
          Recall (macro):{" "}
          <span className="text-accent tabular-nums">{((ml.recall_macro ?? 0) * 100).toFixed(1)}%</span>
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs sm:text-sm text-muted-foreground border border-border/50 p-3 bg-background/20">
        <div>
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Events (cleaned)</span>
          <span className="text-foreground tabular-nums">{ml.n_events ?? "—"}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">
            Supervised rows
          </span>
          <span className="text-foreground tabular-nums">{ml.n_supervised_rows ?? "—"}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Train / test</span>
          <span className="text-foreground tabular-nums">
            {ml.n_train ?? "—"} / {ml.n_test ?? "—"}
          </span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">
            Test dropped (unseen label)
          </span>
          <span className="text-foreground tabular-nums">{ml.dropped_test_unseen_label ?? 0}</span>
        </div>
      </div>

      {labels.length > 0 && matrix.length > 0 ? (
        <div className="overflow-x-auto w-full">
          <table className="border-collapse font-mono text-xs sm:text-sm w-full max-w-4xl">
            <thead>
              <tr>
                <th className="p-2 border border-border/60 bg-background/40 text-left text-muted-foreground font-normal">
                  True \ Pred
                </th>
                {labels.map((lab) => (
                  <th
                    key={lab}
                    className="p-2 border border-border/60 bg-background/40 text-center text-foreground font-normal capitalize min-w-[3.5rem]"
                  >
                    {lab}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((rowLab, ri) => (
                <tr key={rowLab}>
                  <th className="p-2 border border-border/60 bg-background/40 text-left text-foreground font-normal capitalize">
                    {rowLab}
                  </th>
                  {labels.map((_, ci) => {
                    const v = matrix[ri]?.[ci] ?? 0;
                    const intensity = v / maxCell;
                    return (
                      <td
                        key={ci}
                        className="p-2 border border-border/60 text-center tabular-nums text-foreground"
                        style={{
                          backgroundColor: `color-mix(in srgb, hsl(var(--primary)) ${Math.round(intensity * 85)}%, transparent)`,
                        }}
                      >
                        {v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {ml.per_class && ml.per_class.length > 0 ? (
        <div className="overflow-x-auto w-full">
          <p className="font-pixel text-sm text-foreground mb-2">Per-class (test)</p>
          <table className="border-collapse font-mono text-xs sm:text-sm w-full max-w-3xl">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left p-2 border border-border/50">Branch</th>
                <th className="text-right p-2 border border-border/50">Precision</th>
                <th className="text-right p-2 border border-border/50">Recall</th>
                <th className="text-right p-2 border border-border/50">F1</th>
                <th className="text-right p-2 border border-border/50">Support</th>
              </tr>
            </thead>
            <tbody>
              {ml.per_class.map((row) => (
                <tr key={row.label}>
                  <td className="p-2 border border-border/50 capitalize text-foreground">{row.label}</td>
                  <td className="p-2 border border-border/50 text-right tabular-nums">
                    {(row.precision * 100).toFixed(0)}%
                  </td>
                  <td className="p-2 border border-border/50 text-right tabular-nums">
                    {(row.recall * 100).toFixed(0)}%
                  </td>
                  <td className="p-2 border border-border/50 text-right tabular-nums">
                    {(row.f1 * 100).toFixed(0)}%
                  </td>
                  <td className="p-2 border border-border/50 text-right tabular-nums">{row.support}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
};

const CombinedAnalysisPanel = () => {
  const [statsFile, setStatsFile] = useState<File | null>(null);
  const [statsName, setStatsName] = useState("");
  const [advancementsFile, setAdvancementsFile] = useState<File | null>(null);
  const [advancementsName, setAdvancementsName] = useState("");
  const [datFile, setDatFile] = useState<File | null>(null);
  const [datName, setDatName] = useState("");

  const [playerResult, setPlayerResult] = useState<PlayerAnalysisResult | null>(null);
  const [progressionResult, setProgressionResult] = useState<ProgressionAnalysisResult | null>(null);
  const [playerError, setPlayerError] = useState("");
  const [progressionError, setProgressionError] = useState("");
  const [importError, setImportError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [avatarIndex, setAvatarIndex] = useState(0);
  const [playerName, setPlayerName] = useState("Unknown Player");
  const [animateBars, setAnimateBars] = useState(false);

  const statsRef = useRef<HTMLInputElement>(null);
  const advRef = useRef<HTMLInputElement>(null);
  const datRef = useRef<HTMLInputElement>(null);

  const playerUuid = useMemo(
    () =>
      extractUuidFromFilename(statsName) ??
      extractUuidFromFilename(advancementsName) ??
      extractUuidFromFilename(datName),
    [statsName, advancementsName, datName],
  );

  const avatarCandidates = useMemo(() => {
    if (!playerUuid) return null;
    return getPlayerAvatarUrls(playerUuid, 120);
  }, [playerUuid]);

  const progression = progressionResult;

  const playerDat = progression?.player_dat ?? null;
  const insights = progression?.insights;
  const timelineInsights = insights?.timeline;
  const playerStateInsights = insights?.player_state;
  const branchMl = progression?.advancement_branch_ml;
  const healthValue = readNumber(playerDat?.health, 0);
  const foodLevelValue = readNumber(playerDat?.food_level, 0);
  const xpLevelValue = readNumber(playerDat?.xp_level, 0);

  const milestoneEntries = Array.isArray(timelineInsights?.milestones) ? timelineInsights.milestones : [];
  const completedMilestones = milestoneEntries.filter((m) => m.status === "complete");
  const incompleteMilestones = milestoneEntries.filter((m) => m.status !== "complete");

  const maxKilledCount = useMemo(() => {
    if (!playerResult?.top_killed_mobs?.length) return 1;
    return Math.max(...playerResult.top_killed_mobs.map((row) => safeNumber(row.count)), 1);
  }, [playerResult]);

  const maxDeathsCount = useMemo(() => {
    if (!playerResult?.top_dangerous_mobs?.length) return 1;
    return Math.max(...playerResult.top_dangerous_mobs.map((row) => safeNumber(row.count)), 1);
  }, [playerResult]);

  const totalMinedBlocks = useMemo(() => {
    if (!playerResult) return 0;
    if (typeof playerResult.total_mined_blocks === "number") return playerResult.total_mined_blocks;
    return playerResult.top_mined_blocks.reduce((sum, block) => sum + safeNumber(block.count), 0);
  }, [playerResult]);

  const readyToAnalyze =
    statsFile !== null && advancementsFile !== null && datFile !== null;

  useEffect(() => {
    if (!readyToAnalyze || !statsFile || !advancementsFile || !datFile) {
      setPlayerResult(null);
      setProgressionResult(null);
      setPlayerError("");
      setProgressionError("");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setPlayerError("");
      setProgressionError("");

      try {
        const [pr, pgr] = await Promise.allSettled([
          uploadSingleFile("/player", "file", statsFile) as Promise<PlayerAnalysisResult>,
          uploadProgressionFiles(advancementsFile, datFile) as Promise<ProgressionAnalysisResult>,
        ]);

        if (cancelled) return;

        if (pr.status === "fulfilled") {
          setPlayerResult(pr.value);
          setPlayerError("");
        } else {
          setPlayerResult(null);
          setPlayerError(`Player stats: ${errMessage(pr.reason)}`);
        }

        if (pgr.status === "fulfilled") {
          setProgressionResult(pgr.value);
          setProgressionError("");
        } else {
          setProgressionResult(null);
          setProgressionError(`Progression: ${errMessage(pgr.reason)}`);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [statsFile, advancementsFile, datFile]);

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
      .then((name) => {
        if (isActive) setPlayerName(name ?? "Unknown Player");
      })
      .catch(() => {
        if (isActive) setPlayerName("Unknown Player");
      });
    return () => {
      isActive = false;
    };
  }, [playerUuid]);

  useEffect(() => {
    if (!playerResult) {
      setAnimateBars(false);
      return;
    }
    setAnimateBars(false);
    const t = setTimeout(() => setAnimateBars(true), 60);
    return () => clearTimeout(t);
  }, [playerResult]);

  const handleStats = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".json")) {
      setImportError("Player stats must be a .json file.");
      return;
    }
    setImportError("");
    setStatsName(file.name);
    setStatsFile(file);
    setAvatarIndex(0);
  };

  const handleAdvancements = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".json")) {
      setImportError("Advancements must be a .json file.");
      return;
    }
    setImportError("");
    setAdvancementsName(file.name);
    setAdvancementsFile(file);
    setAvatarIndex(0);
  };

  const handleDat = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".dat")) {
      setImportError("Player data must be a .dat file.");
      return;
    }
    setImportError("");
    setDatName(file.name);
    setDatFile(file);
    setAvatarIndex(0);
  };

  const hasAnyResult = playerResult !== null || progressionResult !== null;

  const profileStrip = (showVitals: boolean, showKd: boolean) => {
    const compactHeader = !showVitals && !showKd;
    return (
    <div className="mc-panel-inset p-3 sm:p-4 mb-5 border-2 bg-background/30">
      <div
        className={cn(
          "flex flex-col xl:flex-row xl:flex-wrap xl:items-center gap-4",
          compactHeader ? "justify-center" : "justify-between",
        )}
      >
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          {avatarCandidates ? (
            <img
              src={avatarCandidates[Math.min(avatarIndex, avatarCandidates.length - 1)]}
              alt="Player avatar"
              className="w-12 h-12 sm:w-14 sm:h-14 border border-border bg-mc-inset shrink-0"
              style={{ imageRendering: "pixelated" }}
              onError={(e) => {
                e.currentTarget.onerror = null;
                setAvatarIndex((i) => (i < avatarCandidates.length - 1 ? i + 1 : i));
              }}
            />
          ) : (
            <div className="w-12 h-12 sm:w-14 sm:h-14 border border-border bg-mc-inset shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-pixel text-lg sm:text-xl text-foreground truncate">{playerName}</p>
            <p className="font-mono text-[12px] text-muted-foreground">Profile</p>
          </div>
        </div>

        {playerResult && showKd && (
          <div className="grid grid-cols-3 gap-x-5 sm:gap-x-8 gap-y-1 shrink-0">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide leading-none">
              Kills
            </div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide leading-none">
              Deaths
            </div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide leading-none">
              K/D
            </div>
            <div className="font-mono text-lg leading-none text-primary tabular-nums">{playerResult.kd.kills}</div>
            <div className="font-mono text-lg leading-none text-destructive tabular-nums">{playerResult.kd.deaths}</div>
            <div className="font-mono text-lg leading-none text-accent tabular-nums">{playerResult.kd.kd_ratio}</div>
          </div>
        )}

        {showVitals && progressionResult && (
          <div className="flex gap-4 sm:gap-6 w-full xl:w-auto justify-center xl:justify-end xl:ml-auto">
            <div className="flex flex-col items-center gap-1">
              <img
                src="/assets/minecraft/ui/mchalfheart.png"
                alt="Health"
                className="w-8 h-8 sm:w-10 sm:h-10"
                style={{ imageRendering: "pixelated" }}
              />
              <span className="font-mono text-sm sm:text-base text-foreground tabular-nums">
                {playerDat ? healthValue.toFixed(1) : "—"}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <img
                src="/assets/minecraft/ui/mchunger.png"
                alt="Food"
                className="w-8 h-8 sm:w-10 sm:h-10"
                style={{ imageRendering: "pixelated" }}
              />
              <span className="font-mono text-sm sm:text-base text-foreground tabular-nums">
                {playerDat ? Math.round(foodLevelValue) : "—"}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <img
                src="/assets/minecraft/ui/bottleexp.webp"
                alt="XP"
                className="w-8 h-8 sm:w-10 sm:h-10"
                style={{ imageRendering: "pixelated" }}
              />
              <span className="font-mono text-sm sm:text-base text-foreground tabular-nums">
                {playerDat ? Math.round(xpLevelValue) : "—"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 min-w-0 w-full max-w-none">
      <div className="mc-panel-inset p-3 sm:p-4 shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0 items-start">
          <div className="min-w-0 flex flex-col items-center text-center md:border-r md:border-border md:pr-4">
            <FileJson className="w-7 h-7 sm:w-8 sm:h-8 text-primary mb-1.5 sm:mb-2 shrink-0" />
            <p className="font-pixel text-[10px] sm:text-xl text-foreground mb-1.5 leading-tight px-0.5 min-h-[2.5rem] flex items-center justify-center text-balance">
              Player stats (.json)
            </p>
            <input ref={statsRef} type="file" accept=".json" onChange={handleStats} className="hidden" />
            <button
              type="button"
              onClick={() => statsRef.current?.click()}
              className="mc-button py-2 px-1.5 sm:px-2 w-full min-w-0 justify-center gap-1 inline-flex items-center text-[10px] sm:text-lg leading-tight"
            >
              <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-8 shrink-0" />
              <span className="truncate">Import stats</span>
            </button>
            {statsName && (
              <p className="font-mono text-[9px] sm:text-[10px] text-primary mt-1.5 w-full truncate" title={statsName}>
                &gt; {statsName}
              </p>
            )}
          </div>

          <div className="min-w-0 flex flex-col items-center text-center md:border-r md:border-border md:pr-4">
            <FileJson className="w-7 h-7 sm:w-8 sm:h-8 text-primary mb-1.5 sm:mb-2 shrink-0" />
            <p className="font-pixel text-[10px] sm:text-xl text-foreground mb-1.5 leading-tight px-0.5 min-h-[2.5rem] flex items-center justify-center text-balance">
              Advancements (.json)
            </p>
            <input ref={advRef} type="file" accept=".json" onChange={handleAdvancements} className="hidden" />
            <button
              type="button"
              onClick={() => advRef.current?.click()}
              className="mc-button py-2 px-1.5 sm:px-2 w-full min-w-0 justify-center gap-1 inline-flex items-center text-[10px] sm:text-lg leading-tight"
            >
              <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-8 shrink-0" />
              <span className="truncate">Import advancements</span>
            </button>
            {advancementsName && (
              <p
                className="font-mono text-[9px] sm:text-[10px] text-primary mt-1.5 w-full truncate"
                title={advancementsName}
              >
                &gt; {advancementsName}
              </p>
            )}
          </div>

          <div className="min-w-0 flex flex-col items-center text-center">
            <FileArchive className="w-7 h-7 sm:w-8 sm:h-8 text-primary mb-1.5 sm:mb-2 shrink-0" />
            <p className="font-pixel text-[10px] sm:text-xl text-foreground mb-1.5 leading-tight px-0.5 min-h-[2.5rem] flex items-center justify-center text-balance">
              Player (.dat)
            </p>
            <input ref={datRef} type="file" accept=".dat" onChange={handleDat} className="hidden" />
            <button
              type="button"
              onClick={() => datRef.current?.click()}
              className="mc-button py-2 px-1.5 sm:px-2 w-full min-w-0 justify-center gap-1 inline-flex items-center text-[10px] sm:text-lg leading-tight"
            >
              <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-8 shrink-0" />
              <span className="truncate">Import DAT</span>
            </button>
            {datName && (
              <p className="font-mono text-[9px] sm:text-[10px] text-primary mt-1.5 w-full truncate" title={datName}>
                &gt; {datName}
              </p>
            )}
          </div>
        </div>

        {(importError || playerError || progressionError) && (
          <div className="mt-3 pt-3 border-t border-border space-y-1">
            {importError && <p className="font-mono text-[10px] text-destructive text-center">{importError}</p>}
            {playerError && <p className="font-mono text-[10px] text-destructive text-center">{playerError}</p>}
            {progressionError && <p className="font-mono text-[10px] text-destructive text-center">{progressionError}</p>}
          </div>
        )}
      </div>

      <div className="mc-panel-outset presenter-output flex flex-col w-full min-w-0 max-w-none">
        <div className="mc-panel-header">Player And Progression Analysis</div>
        <div className="mc-panel-inset p-4 sm:p-5 lg:p-6 w-full min-w-0 max-w-none">
          {!readyToAnalyze ? (
            <div className="flex items-center justify-center min-h-[220px] border-2 border-dashed border-border">
              <span className="font-pixel text-sm text-muted-foreground text-center px-4 max-w-[52ch]">
                Import player stats (.json), advancements (.json), and player data (.dat) from your world save.
                Analysis runs only after all three files are selected.
              </span>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center min-h-[220px] border-2 border-dashed border-border">
              <span className="font-pixel text-sm text-muted-foreground animate-pulse-glow">Running analysis…</span>
            </div>
          ) : !hasAnyResult ? (
            <div className="flex items-center justify-center min-h-[220px] border-2 border-dashed border-border">
              <span className="font-pixel text-sm text-destructive text-center px-4">
                Analysis failed. Check the messages above and try again.
              </span>
            </div>
          ) : (
            <div
              className={cn(
                "w-full min-w-0 max-w-none space-y-8 sm:space-y-10",
                "border-4 border-black bg-[hsl(var(--mc-inset))]",
                "shadow-[6px_6px_0_0_rgba(0,0,0,0.88),0_0_0_2px_hsl(var(--primary)/0.35)]",
                "ring-2 ring-inset ring-white/[0.08] p-4 sm:p-6 lg:p-8",
              )}
            >
              {profileStrip(true, true)}

              {progressionResult ? (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
                    <div className="border-b border-border/50 lg:border-b-0 lg:border-r lg:border-border/50 lg:pr-10 pb-8 lg:pb-0">
                      <p className="font-pixel text-lg text-foreground mb-3">Player state</p>
                      {playerStateInsights ? (
                        <div className="space-y-1 font-mono text-sm text-muted-foreground">
                          <p className="font-mono text-sm text-primary">
                            {toTitle(playerStateInsights.classification ?? "unknown")}
                          </p>
                          <p className="font-mono text-[16px] text-muted-foreground">
                            {playerStateInsights.insight ?? ""}
                          </p>
                        </div>
                      ) : (
                        <p className="font-mono text-sm text-muted-foreground">
                          No player state insight available for this .dat file.
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="font-pixel text-lg text-foreground mb-3">Playstyle</p>
                      <p className="font-mono text-sm text-primary">
                        {toTitle(timelineInsights?.playstyle?.classification ?? "unknown")}
                      </p>
                      <p className="font-mono text-[12px] text-muted-foreground mt-1">
                        Confidence: {Math.round(readNumber(timelineInsights?.playstyle?.confidence, 0) * 100)}%
                      </p>
                      <p className="font-mono text-[16px] text-muted-foreground mt-2">
                        {timelineInsights?.playstyle?.reason ??
                          "Not enough data for a reliable playstyle classification."}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="font-pixel text-lg text-foreground mb-3">Key milestones</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="mc-panel-inset p-3 border border-border/80">
                        <p className="font-pixel text-base text-primary mb-1.5">Completed</p>
                        {completedMilestones.length > 0 ? (
                          <div className="space-y-1.5">
                            {completedMilestones.map((milestone) => (
                              <div
                                key={milestone.key}
                                className="font-mono text-sm text-primary flex flex-col sm:flex-row sm:justify-between gap-1"
                              >
                                <span>{milestone.label}</span>
                                <span className="sm:text-right">{milestone.after_start ?? "complete"}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="font-mono text-sm text-muted-foreground">No completed milestones yet.</p>
                        )}
                      </div>
                      <div className="mc-panel-inset p-3 border border-border/80">
                        <p className="font-pixel text-base text-destructive mb-1.5">Incomplete</p>
                        {incompleteMilestones.length > 0 ? (
                          <div className="space-y-1.5">
                            {incompleteMilestones.map((milestone) => (
                              <div
                                key={milestone.key}
                                className="font-mono text-sm text-destructive flex flex-col sm:flex-row sm:justify-between gap-1"
                              >
                                <span>{milestone.label}</span>
                                <span className="sm:text-right">incomplete</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="font-mono text-sm text-muted-foreground">
                            All tracked milestones completed.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {branchMl ? <AdvancementBranchMlBlock ml={branchMl} /> : null}
                </>
              ) : (
                <p className="font-mono text-sm text-muted-foreground">
                  Progression data is not available for playstyle, milestones, or the advancement model.
                </p>
              )}

              {playerResult ? (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8 pt-2 border-t border-border/40">
                  <div className="xl:col-span-4 border-2 border-orange-500/85 p-3 sm:p-4 bg-mc-inset/30 min-w-0">
                    <h4 className="font-pixel text-sm text-foreground mb-3 tracking-wide uppercase">
                      Top 5 mined blocks
                    </h4>
                    <p className="font-mono text-xs text-muted-foreground mb-3">
                      Total mined blocks (estimated):{" "}
                      <span className="text-orange-400 tabular-nums font-mono text-sm">{totalMinedBlocks}</span>
                    </p>
                    <div className="space-y-1.5">
                      {playerResult.top_mined_blocks.map((block, index) => (
                        <div
                          key={`${block.item}-${index}`}
                          className="flex items-center gap-2.5 py-1.5 border-b border-border/30 text-[13px]"
                        >
                          <span
                            className={`font-mono min-w-[1.5rem] ${
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
                            className="w-10 h-10 border border-border bg-mc-inset shrink-0"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = "/assets/minecraft/blocks/unknown.svg";
                            }}
                          />
                          <span className="font-mono text-foreground capitalize flex-1 truncate">
                            {block.item.replace(/_/g, " ")}
                          </span>
                          <span className="font-mono text-orange-400 tabular-nums">{safeNumber(block.count)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="xl:col-span-8 space-y-4 min-w-0">
                    <div className="border border-primary/40 p-3 sm:p-4 bg-mc-inset/40">
                      <h4 className="font-pixel text-sm text-foreground mb-2.5 tracking-wide">Top killed mobs</h4>
                      <div className="space-y-2.5">
                        {playerResult.top_killed_mobs.map((mob, index) => {
                          const count = safeNumber(mob.count);
                          const widthPct = Math.max(8, Math.round((count / maxKilledCount) * 100));
                          return (
                            <div
                              key={`${mob.item}-${index}`}
                              className="grid grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)_40px] gap-1.5 items-center text-[13px]"
                            >
                              <span className="font-mono text-foreground capitalize truncate">
                                {mob.item.replace(/_/g, " ")}
                              </span>
                              <span className="font-mono text-foreground tabular-nums text-right">{count}</span>
                              <div className="relative h-9 bg-mc-inset border border-border overflow-hidden min-w-0">
                                <div
                                  className="h-full transition-all duration-1000 ease-out"
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
                    <div className="border border-destructive/35 p-3 sm:p-4 bg-background/30">
                      <h4 className="font-pixel text-sm text-foreground mb-2.5 tracking-wide">Most dangerous mobs</h4>
                      <div className="space-y-2.5">
                        {playerResult.top_dangerous_mobs.map((mob, index) => {
                          const count = safeNumber(mob.count);
                          const widthPct = Math.max(8, Math.round((count / maxDeathsCount) * 100));
                          return (
                            <div
                              key={`${mob.item}-${index}`}
                              className="grid grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)_40px] gap-1.5 items-center text-[13px]"
                            >
                              <span className="font-mono text-foreground capitalize truncate">
                                {mob.item.replace(/_/g, " ")}
                              </span>
                              <span className="font-mono text-foreground tabular-nums text-right">{count}</span>
                              <div className="relative h-9 bg-mc-inset border border-border overflow-hidden min-w-0">
                                <div
                                  className="h-full transition-all duration-1000 ease-out"
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
                </div>
              ) : (
                <p className="font-mono text-sm text-muted-foreground border-t border-border/40 pt-6">
                  Player stats are not available. Import stats (.json) for mining and mob combat charts.
                </p>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default CombinedAnalysisPanel;
