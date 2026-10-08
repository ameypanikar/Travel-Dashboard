import re

role_filepath = '/home/embedded4/travel-tracker-dashboard-showcase/src/lib/role-filter.ts'
with open(role_filepath, 'r') as f:
    role_code = f.read()

old_split = '''export function splitPassengerList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}'''

new_split = '''export function splitPassengerList(raw: string | string[] | undefined | null): string[] {
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
