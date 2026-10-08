import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { FullWeatherReport, WeatherCondition } from "@/lib/weather-api";
import { formatTimeDifference, getTripWeatherSegment } from "@/lib/weather-api";
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudLightning,
  Snowflake,
  Wind,
  Droplets,
  Sunrise,
  Sunset,
  X,
  MapPin,
  Clock,
  Compass,
  ThermometerSun,
  CalendarCheck,
} from "lucide-react";

export function WeatherIcon({
  name,
  className = "h-5 w-5",
}: {
  name: WeatherCondition["icon"];
  className?: string;
}) {
  switch (name) {
    case "sun":
      return <Sun className={`${className} text-amber-400 animate-spin-slow`} />;
    case "cloud-sun":
      return <CloudSun className={`${className} text-amber-300`} />;
    case "cloud":
      return <Cloud className={`${className} text-slate-300`} />;
    case "cloud-rain":
      return <CloudRain className={`${className} text-blue-400`} />;
    case "cloud-lightning":
      return <CloudLightning className={`${className} text-purple-400 animate-pulse`} />;
    case "snowflake":
      return <Snowflake className={`${className} text-indigo-300`} />;
    case "wind":
      return <Wind className={`${className} text-teal-300`} />;
    default:
      return <CloudSun className={`${className} text-amber-300`} />;
  }
}

export function WeatherForecastDialog({
  report,
  targetDate,
  dateLabel,
  isOpen,
  onClose,
}: {
  report: FullWeatherReport | null;
  targetDate?: string;
  dateLabel?: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!report) return null;

  const current = report.current;
  const timeDiff = formatTimeDifference(current.utcOffsetSeconds);
  const segment = getTripWeatherSegment(report, targetDate);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md overflow-hidden rounded-3xl border-0 p-0 shadow-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white">
        {/* Header with City & Live / Arrival Conditions */}
        <div className="relative p-6 pb-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-1.5 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-300">
            <MapPin className="h-3.5 w-3.5 text-indigo-400" />
            <span>
              {segment.isExactTripDate
                ? `${dateLabel || "Trip"} Forecast (${segment.displayDateLabel})`
                : "Destination Weather"}
            </span>
          </div>

          <div className="mt-1 flex items-baseline justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white">{report.city}</h2>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-white/70">
                <Clock className="h-3 w-3 text-indigo-300" />
                <span>Local Time: {current.localTime}</span>
                <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-indigo-200">
                  {timeDiff.label}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black text-white">{segment.displayTemp}°</div>
              <div className="text-xs font-medium text-indigo-200">{segment.displayCondition.label}</div>
            </div>
          </div>

          {/* Quick Metrics Pills */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="flex items-center gap-2 rounded-2xl bg-white/5 p-2.5 backdrop-blur-md border border-white/10">
              <ThermometerSun className="h-4 w-4 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase text-white/60">High / Low</div>
                <div className="text-xs font-bold text-white">
                  {segment.displayTempMax}° / {segment.displayTempMin}°
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-2xl bg-white/5 p-2.5 backdrop-blur-md border border-white/10">
              <Droplets className="h-4 w-4 text-blue-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase text-white/60">Humidity</div>
                <div className="text-xs font-bold text-white">{current.humidity}%</div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-2xl bg-white/5 p-2.5 backdrop-blur-md border border-white/10">
              <Wind className="h-4 w-4 text-teal-400 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] uppercase text-white/60">Wind</div>
                <div className="text-xs font-bold text-white">{current.windSpeed} km/h</div>
              </div>
            </div>
          </div>
        </div>

        {/* 5-Day Forecast Grid (Starting from Arrival Date or Today) */}
        <div className="bg-white/5 p-6 pt-3 border-t border-white/10 backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between text-xs font-bold text-indigo-200">
            <span className="flex items-center gap-1.5">
              <CalendarCheck className="h-3.5 w-3.5 text-indigo-300" />
              <span>
                {segment.isExactTripDate
                  ? `5-DAY FORECAST FROM ARRIVAL (${segment.displayDateLabel})`
                  : "5-DAY FORECAST"}
              </span>
            </span>
            {segment.forecastDays[0]?.sunrise && (
              <span className="flex items-center gap-2 text-[11px] text-white/60">
                <span className="flex items-center gap-1">
                  <Sunrise className="h-3 w-3 text-amber-300" /> {segment.forecastDays[0].sunrise}
                </span>
                <span className="flex items-center gap-1">
                  <Sunset className="h-3 w-3 text-orange-400" /> {segment.forecastDays[0].sunset}
                </span>
              </span>
            )}
          </div>

          <div className="space-y-2">
            {segment.forecastDays.map((day, idx) => (
              <div
                key={day.date}
                className={`flex items-center justify-between rounded-2xl px-3.5 py-2.5 transition-all ${
                  idx === 0
                    ? "bg-white/15 border border-white/20 shadow-inner"
                    : "bg-white/5 hover:bg-white/10"
                }`}
              >
                {/* Day name & date */}
                <div className="w-24">
                  <div className="text-xs font-bold text-white flex items-center gap-1">
                    <span>{day.dayName}</span>
                    <span className="text-[10px] font-normal text-white/60">
                      {new Date(day.date).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  {day.precipitationProb > 15 ? (
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-blue-300">
                      <Droplets className="h-2.5 w-2.5" />
                      <span>{day.precipitationProb}% rain</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-white/50">{day.condition.label}</div>
                  )}
                </div>

                {/* Weather icon */}
                <div className="flex items-center justify-center">
                  <WeatherIcon name={day.condition.icon} className="h-5 w-5" />
                </div>

                {/* Min / Max Temp Bar */}
                <div className="flex items-center gap-2 w-32 justify-end">
                  <span className="text-xs text-white/60 font-medium tabular-nums">{day.tempMin}°</span>
                  <div className="h-1.5 w-14 rounded-full bg-white/10 overflow-hidden relative">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-400 via-amber-400 to-orange-400"
                      style={{
                        marginLeft: `${Math.max(0, Math.min(60, (day.tempMin / 40) * 100))}%`,
                        width: `${Math.max(20, Math.min(80, ((day.tempMax - day.tempMin) / 40) * 100))}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold text-white tabular-nums">{day.tempMax}°</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-center text-[10px] text-white/40 flex items-center justify-center gap-1">
            <Compass className="h-3 w-3" />
            <span>Open-Meteo · Tailored forecast for arrival & subsequent days</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
