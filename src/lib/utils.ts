import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateGoogleCalendarLink(title: string, date: string, time?: string, details?: string) {
  // Try to parse the date and time to ISO strings
  // Assuming date format is YYYY-MM-DD and time is HH:MM
  let startStr = "";
  let endStr = "";
  
  try {
    if (date) {
      let d = new Date(date + (time ? `T${time}` : 'T00:00:00'));
      if (!isNaN(d.getTime())) {
        // Format: YYYYMMDDTHHMMSSZ
        const iso = d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        startStr = iso;
        
        // Add 1 hour for end time
        let endD = new Date(d.getTime() + 60 * 60 * 1000);
        endStr = endD.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      }
    }
  } catch (e) {}

  const params = new URLSearchParams();
  params.append("action", "TEMPLATE");
  params.append("text", title || "Reminder");
  if (details) params.append("details", details);
  if (startStr && endStr) {
    params.append("dates", `${startStr}/${endStr}`);
  }
  
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
