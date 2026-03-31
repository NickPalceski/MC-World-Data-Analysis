import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload, FileJson } from "lucide-react";
import { uploadSingleFile } from "@/lib/api";

interface AnalysisPageProps {
  title: string;
  subtitle: string;
  endpoint: string;
}

const AnalysisPage = ({ title, subtitle, endpoint }: AnalysisPageProps) => {
  const [outputData, setOutputData] = useState<unknown>(null);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError("");
    setIsLoading(true);

    try {
      const result = await uploadSingleFile(endpoint, "file", file);
      setOutputData(result);
    } catch (uploadError) {
      setError(`API_ERROR: ${(uploadError as Error).message}`);
      setOutputData(null);
    } finally {
      setIsLoading(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <nav className="bg-mc-inset border-b-4 border-border px-6 py-3 flex items-center gap-6">
        <Link to="/" className="mc-button py-2 px-4 text-sm flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <span className="font-pixel text-xl text-foreground tracking-wider">{title}</span>
      </nav>

      <main className="container mx-auto px-8 py-8">
        {/* Upload Zone */}
        <section className="mb-8">
          <div className="mc-panel-inset p-8 text-center">
            <FileJson className="w-10 h-10 text-primary mx-auto mb-4" />
            <p className="font-pixel text-lg text-foreground mb-4">
              Deposit JSON file to begin analysis
            </p>
            <p className="font-mono text-xs text-muted-foreground mb-6">{subtitle}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mc-button py-3 px-8 inline-flex items-center gap-3"
            >
              <Upload className="w-5 h-5" />
              Import JSON
            </button>
            {fileName && (
              <p className="font-mono text-xs text-primary mt-4">
                &gt; Loaded: {fileName}
              </p>
            )}
            {error && (
              <p className="font-mono text-xs text-destructive mt-4">{error}</p>
            )}
          </div>
        </section>

        {/* Results Zone */}
        <section>
          <div className="mc-panel-outset">
            <div className="mc-panel-header">Analysis Output</div>
            <div className="mc-panel-inset min-h-[400px] p-6">
              {isLoading ? (
                <div className="flex items-center justify-center h-[300px] border-2 border-dashed border-border">
                  <span className="font-pixel text-muted-foreground animate-pulse-glow">
                    Running analysis...
                  </span>
                </div>
              ) : outputData ? (
                <div className="font-mono text-sm">
                  {renderValue(outputData)}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[300px] border-2 border-dashed border-border">
                  <span className="font-pixel text-muted-foreground animate-pulse-glow">
                    No data loaded. Waiting for input...
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

export default AnalysisPage;
