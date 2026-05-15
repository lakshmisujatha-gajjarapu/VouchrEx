import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function getIstParts(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const istDate = new Date(d.getTime() + IST_OFFSET_MS);
  const hour24 = istDate.getUTCHours();
  const hour12 = hour24 % 12 || 12;

  return {
    day: istDate.getUTCDate(),
    month: MONTHS[istDate.getUTCMonth()],
    year: istDate.getUTCFullYear(),
    hour: pad2(hour12),
    minute: pad2(istDate.getUTCMinutes()),
    meridiem: hour24 >= 12 ? 'PM' : 'AM',
  };
}

export function formatDate(date: Date | string): string {
  const p = getIstParts(date);
  return `${String(p.day)} ${p.month} ${String(p.year)}`;
}

export function formatDateTime(date: Date | string): string {
  const p = getIstParts(date);
  return `${String(p.day)} ${p.month} ${String(p.year)}, ${p.hour}:${p.minute} ${p.meridiem}`;
}

export function formatDateTimeShort(date: Date | string): string {
  const p = getIstParts(date);
  return `${String(p.day)} ${p.month}, ${p.hour}:${p.minute} ${p.meridiem}`;
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function formatShortId(uuid: string, prefix: string = ''): string {
  const short = uuid.substring(0, 8).toUpperCase();
  return prefix ? `${prefix}-${short}` : short;
}

export function getRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDateTime(d);
}
