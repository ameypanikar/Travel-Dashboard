import re

# Refactor parseAmount in expense-utils.ts
filepath = '/home/embedded4/travel-tracker-dashboard-showcase/src/lib/expense-utils.ts'
with open(filepath, 'r') as f:
    code = f.read()

old_func = '''export function parseAmount(raw?: string): number {
  if (!raw) return NaN;
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  return parseFloat(cleaned);
}'''

new_func = '''export function parseAmount(raw?: string | number | null): number {
  if (typeof raw === "number") return raw;
  if (!raw) return NaN;
  const cleaned = String(raw).replace(/[^0-9.-]/g, "");
  return parseFloat(cleaned);
}'''

if old_func in code:
    code = code.replace(old_func, new_func)
    with open(filepath, 'w') as f:
        f.write(code)
    print("Updated parseAmount successfully.")
else:
    print("Could not find parseAmount.")

# Refactor splitPassengerList in role-filter.ts
role_filepath = '/home/embedded4/travel-tracker-dashboard-showcase/src/lib/role-filter.ts'
with open(role_filepath, 'r') as f:
    role_code = f.read()

old_split = '''export function splitPassengerList(raw?: string | null): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}'''

new_split = '''export function splitPassengerList(raw?: string | string[] | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return String(raw).split(",").map((s) => s.trim()).filter(Boolean);
}'''

if old_split in role_code:
    role_code = role_code.replace(old_split, new_split)
    with open(role_filepath, 'w') as f:
        f.write(role_code)
    print("Updated splitPassengerList successfully.")
else:
    print("Could not find splitPassengerList.")
