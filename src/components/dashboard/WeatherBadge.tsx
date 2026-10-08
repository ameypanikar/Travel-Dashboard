import { useState, useEffect } from "react";
import { fetchWeather, getTripWeatherSegment, type FullWeatherReport } from "@/lib/weather-api";
import { WeatherIcon, WeatherForecastDialog } from "./WeatherForecastDialog";
import { Loader2 } from "lucide-react";

export function WeatherBadge({
  locationQuery,
  targetDate,
  dateLabel,
  className = "",
}: {
  locationQuery: string;
  targetDate?: string;
  dateLabel?: string;
  className?: string;
}) {
  const [report, setReport] = useState<FullWeatherReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!locationQuery || !locationQuery.trim()) return;
    let isCancelled = false;

    setLoading(true);
    fetchWeather(locationQuery)
      .then((data) => {
        if (!isCancelled && data) {
          setReport(data);
        }
      })
      .catch((err) => console.warn("Weather fetch failed:", err))
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [locationQuery]);

  if (loading && !report) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-xl border border-border/40 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground animate-pulse ${className}`}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Weather…</span>
      </div>
    );
  }

  if (!report) return null;

  const segment = getTripWeatherSegment(report, targetDate);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setDialogOpen(true);
        }}
        className={`group inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm ${segment.displayCondition.badgeBg} ${className}`}
        title={
          segment.isExactTripDate
            ? `Weather forecast for ${report.city} on ${segment.displayDateLabel} (${dateLabel || "Trip date"})`
            : `Live weather for ${report.city}`
        }
      >
        <WeatherIcon name={segment.displayCondition.icon} className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" />
        {segment.isExactTripDate ? (
          <span className="font-bold">
            <span className="text-[10px] opacity-80 mr-1">{segment.displayDateLabel}:</span>
            {segment.displayTemp}°C
          </span>
        ) : (
          <span className="font-bold">{segment.displayTemp}°C</span>
        )}
        <span className="opacity-75 hidden sm:inline">{segment.displayCondition.label}</span>
      </button>

      <WeatherForecastDialog
        report={report}
        targetDate={targetDate}
        dateLabel={dateLabel}
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}
