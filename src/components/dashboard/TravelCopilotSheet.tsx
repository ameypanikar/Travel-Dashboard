import { useState, useRef, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Sparkles,
  Send,
  Plane,
  Train,
  Hotel,
  UtensilsCrossed,
  MapPin,
  Clock,
  ExternalLink,
  RotateCcw,
  PlusCircle,
  CloudSun,
  Copy,
  Check,
  Navigation,
  Compass,
  ArrowLeft,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  askTravelCopilot,
  type CopilotMessage,
  type DashboardContext,
} from "@/lib/travel-copilot-engine";
import type { Flight, Hotel as HotelType, TravelEvent } from "@/lib/dashboard-api";
import type { NearestAirportResult } from "@/lib/airport-data";
import type {
  HotelSuggestion,
  RestaurantSuggestion,
  RailwayStationSuggestion,
  TravelWeatherSummary,
  GeocodedPlace,
} from "@/lib/travel-places-api";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  flights: Flight[];
  hotels: HotelType[];
  events: TravelEvent[];
  username?: string;
  onOpenAddBooking?: (kind: "flight" | "hotel" | "train" | "bus", prefill?: Record<string, string>) => void;
  onOpenAddEvent?: (prefill?: { eventname?: string; location?: string; startdate?: string }) => void;
};

const SUGGESTION_STARTERS = [
  {
    icon: Plane,
    label: "Nearest Airport",
    prompt: "What is the nearest airport to my client in Whitefield, Bengaluru?",
  },
  {
    icon: Train,
    label: "Nearest Railway Station",
    prompt: "What is the nearest railway station to my customer?",
  },
  {
    icon: Hotel,
    label: "Hotels Near Client",
    prompt: "Where should I stay near Electronic City, Bengaluru?",
  },
  {
    icon: UtensilsCrossed,
    label: "Places to Eat",
    prompt: "What are the nearest places to eat and restaurants around my destination?",
  },
  {
    icon: CloudSun,
    label: "Check Weather",
    prompt: "What is the weather forecast for my upcoming customer visit?",
  },
];

function renderInlineText(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const tokens = text.split(regex);

  tokens.forEach((token, index) => {
    if (!token) return;
    if (token.startsWith("**") && token.endsWith("**") && token.length >= 4) {
      parts.push(
        <strong key={index} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`") && token.length >= 2) {
      parts.push(
        <code key={index} className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono border border-border/40">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("*") && token.endsWith("*") && token.length >= 2) {
      parts.push(
        <em key={index} className="italic text-foreground/90">
          {token.slice(1, -1)}
        </em>
      );
    } else {
      parts.push(token);
    }
  });

  return parts;
}

function FormattedMarkdown({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<div key={`gap-${index}`} className="h-1.5" />);
      return;
    }

    // Headers: ### Title or ## Title or ### **Title**
    if (/^#{1,4}\s+/.test(trimmed)) {
      const cleanTitle = trimmed
        .replace(/^#{1,4}\s+/, "")
        .replace(/^\*\*|\*\*$/g, "")
        .trim();

      elements.push(
        <div
          key={`header-${index}`}
          className="font-bold text-sm text-foreground mt-3 mb-1.5 flex items-center gap-1.5 pb-1 border-b border-border/40"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span>{cleanTitle}</span>
        </div>
      );
      return;
    }

    // Standalone bold header or emoji header on its own line
    if (
      (trimmed.startsWith("**") && trimmed.endsWith("**") && trimmed.length < 50 && !trimmed.includes(":")) ||
      /^(✈️|🚆|🏨|🍽️|📋|🌦️|💡|📌)\s+/.test(trimmed)
    ) {
      const cleanTitle = trimmed.replace(/^\*\*|\*\*$/g, "").trim();
      elements.push(
        <div
          key={`subhead-${index}`}
          className="font-semibold text-sm text-indigo-700 dark:text-indigo-300 mt-2.5 mb-1 flex items-center gap-1.5"
        >
          <span>{cleanTitle}</span>
        </div>
      );
      return;
    }

    // Bullet points: * Item or - Item or • Item
    if (/^[\*\-•]\s+/.test(trimmed)) {
      const bulletContent = trimmed.replace(/^[\*\-•]\s+/, "");
      elements.push(
        <div key={`bullet-${index}`} className="flex items-start gap-2 my-1 text-xs sm:text-sm leading-relaxed">
          <span className="text-indigo-500 dark:text-indigo-400 font-bold shrink-0 mt-0.5">•</span>
          <div className="flex-1">{renderInlineText(bulletContent)}</div>
        </div>
      );
      return;
    }

    // Numbered list: 1. Item
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      const num = numMatch[1];
      const content = numMatch[2];
      elements.push(
        <div key={`num-${index}`} className="flex items-start gap-2 my-1 text-xs sm:text-sm leading-relaxed">
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] shrink-0 mt-0.5">
            {num}
          </span>
          <div className="flex-1">{renderInlineText(content)}</div>
        </div>
      );
      return;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${index}`} className="my-1 text-xs sm:text-sm leading-relaxed text-foreground/90">
        {renderInlineText(trimmed)}
      </p>
    );
  });

  return (
    <div className="space-y-0.5">
      {elements}
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-1 bg-indigo-500 animate-pulse align-middle rounded-xs" />
      )}
    </div>
  );
}

export function TravelCopilotSheet({
  isOpen,
  onClose,
  flights,
  hotels,
  events,
  username,
  onOpenAddBooking,
  onOpenAddEvent,
}: Props) {
  const [messages, setMessages] = useState<CopilotMessage[]>(() => {
    // Check localStorage for saved session messages
    try {
      const saved = sessionStorage.getItem("travel_copilot_chat");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastPlace, setLastPlace] = useState<GeocodedPlace | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Save to session storage
  useEffect(() => {
    try {
      sessionStorage.setItem("travel_copilot_chat", JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  // Clean up streaming timer on unmount
  useEffect(() => {
    return () => {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
    };
  }, []);

  // Auto-scroll on new message or stream updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Mobile PWA Back Navigation handling:
  // When sheet opens, push history entry so Android/browser back gesture closes drawer instead of leaving app
  useEffect(() => {
    if (!isOpen) return;

    window.history.pushState({ travelCopilotOpen: true }, "");

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isOpen, onClose]);

  const handleClose = () => {
    if (window.history.state?.travelCopilotOpen) {
      window.history.back();
    } else {
      onClose();
    }
  };

  const dashboardContext: DashboardContext = {
    flights,
    hotels,
    events,
    username,
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    setInput("");

    // Stop any existing stream
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }

    const userMsg: CopilotMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setLoading(true);

    try {
      const res = await askTravelCopilot(query, nextHistory, dashboardContext, lastPlace);

      if (res.detectedPlace) {
        setLastPlace(res.detectedPlace);
      }

      const botMsgId = `a-${Date.now()}`;
      const fullReply = res.reply;
      const finalCards = res.cards;

      // Initial empty assistant message with isStreaming: true
      setMessages((prev) => [
        ...prev,
        {
          id: botMsgId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
          isStreaming: true,
        },
      ]);
      setLoading(false);

      // Authentic token/word typewriter reveal effect
      const tokens = fullReply.match(/\S+\s*/g) || [fullReply];
      let currentText = "";
      let tokenIdx = 0;

      streamTimerRef.current = setInterval(() => {
        if (tokenIdx < tokens.length) {
          // Reveal 1-2 words per tick (~18ms) for natural, fluid reading cadence
          currentText += tokens[tokenIdx];
          tokenIdx++;
          if (tokenIdx < tokens.length && Math.random() > 0.45) {
            currentText += tokens[tokenIdx];
            tokenIdx++;
          }

          setMessages((prev) =>
            prev.map((m) => (m.id === botMsgId ? { ...m, content: currentText } : m))
          );

          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        } else {
          // Streaming finished: reveal final text and smooth cards fade-in
          if (streamTimerRef.current) clearInterval(streamTimerRef.current);
          streamTimerRef.current = null;

          setMessages((prev) =>
            prev.map((m) =>
              m.id === botMsgId
                ? {
                    ...m,
                    content: fullReply,
                    isStreaming: false,
                    cards: finalCards,
                  }
                : m
            )
          );

          if (scrollRef.current) {
            setTimeout(() => {
              if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }, 60);
          }
        }
      }, 18);
    } catch (err) {
      setLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Sorry, I had trouble processing that request. Please try again.",
          timestamp: new Date(),
          error: true,
        },
      ]);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Copied "${code}" to clipboard`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleClearChat = () => {
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    setMessages([]);
    setLastPlace(null);
    sessionStorage.removeItem("travel_copilot_chat");
    toast.info("Conversation cleared");
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col h-full bg-background border-l shadow-2xl z-50 focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-3.5 border-b bg-muted/30 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Prominent Back Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-9 w-9 rounded-xl hover:bg-accent text-foreground/80 hover:text-foreground shrink-0 sm:hidden flex items-center justify-center -ml-1"
              aria-label="Back to dashboard"
              title="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>

            <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/25 shrink-0">
              <Bot className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-sm sm:text-base font-semibold tracking-tight text-foreground truncate">
                  Travel Copilot
                </SheetTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] font-medium bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/60 shrink-0"
                >
                  AI Assistant
                </Badge>
              </div>
              <SheetDescription className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate">
                <span>Synced with {flights.length} flight{flights.length !== 1 ? "s" : ""} & {hotels.length} hotel{hotels.length !== 1 ? "s" : ""}</span>
              </SheetDescription>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearChat}
                title="Clear conversation"
                className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}

            {/* Desktop Dedicated Close Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg hidden sm:flex items-center justify-center"
              title="Close Copilot"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Message Thread */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4 scroll-smooth"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-center px-4 py-8 space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner">
                <Compass className="w-8 h-8 animate-pulse" />
              </div>
              <div className="space-y-2 max-w-sm">
                <h3 className="font-semibold text-foreground text-lg">
                  Where is your next client visit?
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tell me the customer or location you need to visit. I will find the nearest commercial airports, railway stations, check your flights, recommend verified hotels, and suggest places to eat.
                </p>
              </div>

              {/* Starter Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-md pt-2">
                {SUGGESTION_STARTERS.map((starter, idx) => {
                  const Icon = starter.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSend(starter.prompt)}
                      className="flex items-start gap-2.5 p-3 rounded-xl border border-border/70 bg-card hover:bg-accent/40 text-left transition-all hover:scale-[1.01] hover:border-indigo-400/50 group"
                    >
                      <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-medium text-foreground">
                          {starter.label}
                        </div>
                        <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                          {starter.prompt}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col space-y-2",
                  msg.role === "user" ? "items-end" : "items-start"
                )}
              >
                {/* Role Header */}
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-1">
                  {msg.role === "assistant" ? (
                    <>
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      <span className="font-medium text-indigo-600 dark:text-indigo-400">
                        Travel Copilot
                      </span>
                    </>
                  ) : (
                    <span>You</span>
                  )}
                  <span>•</span>
                  <span>
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Bubble Text */}
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[95%] sm:max-w-[88%] break-words",
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-none shadow-sm whitespace-pre-wrap"
                      : "bg-muted/60 dark:bg-muted/40 border border-border/80 text-foreground rounded-bl-none shadow-xs"
                  )}
                >
                  {msg.role === "user" ? (
                    msg.content
                  ) : (
                    <FormattedMarkdown text={msg.content} isStreaming={msg.isStreaming} />
                  )}
                </div>

                {/* Render Cards if Attached & streaming completed */}
                {msg.cards && !msg.isStreaming && (
                  <div className="w-full space-y-3 pt-1 animate-in fade-in duration-300">
                    {/* Location Badge */}
                    {msg.cards.place && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-accent/30 px-3 py-1.5 rounded-lg border border-border/40 w-fit">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="font-medium text-foreground">Target Location:</span>
                        <span className="truncate max-w-[260px] sm:max-w-md">
                          {msg.cards.place.displayName}
                        </span>
                      </div>
                    )}

                    {/* Nearest Commercial Airports Cards */}
                    {msg.cards.airports && msg.cards.airports.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-foreground px-1">
                          <span className="flex items-center gap-1.5">
                            <Plane className="w-3.5 h-3.5 text-sky-500" />
                            Nearest Commercial Airports
                          </span>
                          <span className="text-[11px] font-normal text-muted-foreground">
                            Sorted by distance
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {msg.cards.airports.map((airport: NearestAirportResult) => (
                            <div
                              key={airport.iata}
                              className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-border bg-card/90 hover:bg-accent/30 transition-all gap-3 shadow-xs"
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/60 shrink-0">
                                  <span className="text-xs font-bold text-sky-700 dark:text-sky-300">
                                    {airport.iata}
                                  </span>
                                  <span className="text-[9px] uppercase tracking-wider text-sky-600/80 dark:text-sky-400/80">
                                    IATA
                                  </span>
                                </div>
                                <div>
                                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                                    {airport.name}
                                  </h4>
                                  <p className="text-xs text-muted-foreground">
                                    {airport.city}, {airport.country}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                                    <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/40">
                                      <Navigation className="w-3 h-3" />
                                      {airport.distanceKm} km away
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                                      <Clock className="w-3 h-3" />
                                      {airport.driveTimeEstimate}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCopy(airport.iata)}
                                  className="h-8 text-xs gap-1"
                                >
                                  {copiedCode === airport.iata ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                  <span>{copiedCode === airport.iata ? "Copied" : "Code"}</span>
                                </Button>
                                <Button
                                  variant="default"
                                  size="sm"
                                  asChild
                                  className="h-8 text-xs bg-sky-600 hover:bg-sky-700 text-white gap-1"
                                >
                                  <a
                                    href={airport.flightSearchUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>Flights</span>
                                  </a>
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Nearest Railway Stations Cards */}
                    {msg.cards.stations && msg.cards.stations.length > 0 && (
                      <div className="space-y-2 pt-1 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between text-xs font-semibold text-foreground px-1">
                          <span className="flex items-center gap-1.5">
                            <Train className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            Nearest Railway Stations
                          </span>
                          <span className="text-[11px] font-normal text-muted-foreground">
                            Sorted by distance
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {msg.cards.stations.map((station: RailwayStationSuggestion) => (
                            <div
                              key={station.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-border bg-card/90 hover:bg-accent/30 transition-all gap-3 shadow-xs"
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 shrink-0">
                                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                    {station.code || "TRAIN"}
                                  </span>
                                  <span className="text-[9px] uppercase tracking-wider text-emerald-600/80 dark:text-emerald-400/80">
                                    STATION
                                  </span>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-semibold text-foreground">
                                      {station.name}
                                    </h4>
                                    {station.type && (
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px] px-1.5 py-0 capitalize"
                                      >
                                        {station.type}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                    {station.address}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                                    <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/40">
                                      <Navigation className="w-3 h-3" />
                                      {station.distanceKm.toFixed(1)} km away
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                                      <Clock className="w-3 h-3" />
                                      {station.driveTimeEstimate}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                {station.code && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCopy(station.code!)}
                                    className="h-8 text-xs gap-1"
                                  >
                                    {copiedCode === station.code ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                    <span>{copiedCode === station.code ? "Copied" : "Code"}</span>
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                  className="h-8 text-xs gap-1"
                                >
                                  <a
                                    href={station.mapsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <MapPin className="w-3 h-3 text-rose-500" />
                                    <span>Directions</span>
                                  </a>
                                </Button>
                                {onOpenAddBooking && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                      onOpenAddBooking("train", {
                                        station_name: station.name,
                                        station_code: station.code || "",
                                      });
                                    }}
                                    className="h-8 text-xs gap-1"
                                  >
                                    <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Book</span>
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Verified Hotels Cards */}
                    {msg.cards.hotels && msg.cards.hotels.length > 0 && (
                      <div className="space-y-2 pt-1 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between text-xs font-semibold text-foreground px-1">
                          <span className="flex items-center gap-1.5">
                            <Hotel className="w-3.5 h-3.5 text-violet-500" />
                            Verified Hotels Near Client
                          </span>
                          <span className="text-[11px] font-normal text-muted-foreground">
                            via OpenStreetMap
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {msg.cards.hotels.map((hotel: HotelSuggestion) => (
                            <div
                              key={hotel.id}
                              className="p-3 rounded-xl border border-border bg-card/90 hover:bg-accent/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-foreground">
                                    {hotel.name}
                                  </h4>
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0 capitalize"
                                  >
                                    {hotel.type}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {hotel.address}
                                </p>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                    {hotel.distanceKm.toFixed(1)} km from client
                                  </span>
                                  {hotel.phone && <span>• {hotel.phone}</span>}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                  className="h-8 text-xs gap-1"
                                >
                                  <a
                                    href={hotel.mapsUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <MapPin className="w-3 h-3 text-rose-500" />
                                    <span>Map</span>
                                  </a>
                                </Button>
                                {onOpenAddBooking && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                      onOpenAddBooking("hotel", {
                                        hotel_name: hotel.name,
                                        address: hotel.address,
                                      });
                                    }}
                                    className="h-8 text-xs gap-1"
                                  >
                                    <PlusCircle className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Book</span>
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Verified Restaurants Cards */}
                    {msg.cards.restaurants && msg.cards.restaurants.length > 0 && (
                      <div className="space-y-2 pt-1 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between text-xs font-semibold text-foreground px-1">
                          <span className="flex items-center gap-1.5">
                            <UtensilsCrossed className="w-3.5 h-3.5 text-orange-500" />
                            Nearest Places to Eat & Dining
                          </span>
                          <span className="text-[11px] font-normal text-muted-foreground">
                            within 5 km
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {msg.cards.restaurants.map((rest: RestaurantSuggestion) => (
                            <div
                              key={rest.id}
                              className="p-3 rounded-xl border border-border bg-card/90 flex flex-col justify-between gap-2 shadow-xs"
                            >
                              <div>
                                <div className="flex items-center justify-between gap-1">
                                  <h4 className="text-xs font-semibold text-foreground line-clamp-1">
                                    {rest.name}
                                  </h4>
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium shrink-0">
                                    {rest.distanceKm.toFixed(1)} km
                                  </span>
                                </div>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 mt-1 bg-muted/40"
                                >
                                  {rest.cuisine}
                                </Badge>
                                <p className="text-[11px] text-muted-foreground line-clamp-1 mt-1">
                                  {rest.address}
                                </p>
                              </div>

                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="h-7 text-[11px] w-full gap-1 mt-1"
                              >
                                <a
                                  href={rest.mapsUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <ExternalLink className="w-3 h-3 text-muted-foreground" />
                                  <span>View on Maps</span>
                                </a>
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Destination Weather Preview */}
                    {msg.cards.weather && (
                      <div className="p-3 rounded-xl border border-sky-200 dark:border-sky-800/40 bg-sky-50/50 dark:bg-sky-950/20 flex items-center justify-between text-xs animate-in fade-in duration-300">
                        <div className="flex items-center gap-2.5">
                          <CloudSun className="w-5 h-5 text-sky-500" />
                          <div>
                            <div className="font-semibold text-foreground">
                              {msg.cards.weather.city} Weather: {msg.cards.weather.condition}
                            </div>
                            <div className="text-muted-foreground text-[11px]">
                              High: {msg.cards.weather.tempMax}°C · Low: {msg.cards.weather.tempMin}°C · Rain Chance: {msg.cards.weather.precipitationProb}%
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className="bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 border-none"
                        >
                          Forecast
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Thinking / Searching Indicator */}
          {loading && (
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground p-3.5 rounded-2xl bg-muted/40 w-fit animate-pulse border border-border/60">
              <Sparkles className="w-4 h-4 text-indigo-500 animate-spin" />
              <span>Checking live routes, stations, and travel options...</span>
            </div>
          )}
        </div>

        {/* Dynamic Quick Prompt Pills (when conversation is active) */}
        {messages.length > 0 && !loading && (
          <div className="px-4 sm:px-5 py-2 border-t bg-muted/20 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            <button
              onClick={() => handleSend("What is the nearest airport?")}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-background border border-border hover:bg-accent text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            >
              ✈️ Nearest Airport
            </button>
            <button
              onClick={() => handleSend("What is the nearest railway station to the customer?")}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-background border border-border hover:bg-accent text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            >
              🚆 Train Station
            </button>
            <button
              onClick={() => handleSend("Where should I stay near the client?")}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-background border border-border hover:bg-accent text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            >
              🏨 Recommended Hotels
            </button>
            <button
              onClick={() => handleSend("What are the best places to eat nearby?")}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-background border border-border hover:bg-accent text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            >
              🍽️ Nearby Food
            </button>
            <button
              onClick={() => handleSend("What is the weather like on my meeting day?")}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-background border border-border hover:bg-accent text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            >
              🌦️ Weather
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 sm:p-4 pb-6 sm:pb-4 border-t bg-background shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about a client visit, railway station, airport, hotel, or food..."
                disabled={loading}
                className="w-full h-11 px-4 text-sm bg-muted/50 border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-foreground placeholder:text-muted-foreground transition-all"
              />
            </div>
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              className="h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 mt-2 px-1">
            <span>Powered by Gemini & OpenStreetMap free open data</span>
            <span>Press Enter to send</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
