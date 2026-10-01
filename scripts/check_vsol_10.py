import subprocess

def snmpwalk(ip, community, oid):
    cmd = ["snmpwalk", "-v", "2c", "-c", community, ip, oid]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout.splitlines()

print("=== Dumping Optical OIDs from 192.192.100.10 (OLT-VSOL-10) ===")
lines = snmpwalk("192.192.100.10", "public", "1.3.6.1.4.1.37950.1.1.5.12.2.1.8.1")

print(f"Total OIDs returned from 192.192.100.10: {len(lines)}")
columns = set()
samples = {}

for line in lines:
    if "=" not in line: continue
    oid_part, val_part = line.split("=", 1)
    oid_str = oid_part.strip()
    val_str = val_part.strip()
    parts = oid_str.split(".")
    try:
        idx = parts.index("8")
        if idx < len(parts) - 1 and parts[idx+1] == "1":
            col = parts[idx+2]
            columns.add(col)
            if col not in samples:
                samples[col] = (oid_str, val_str)
    except Exception:
        pass

print("\nColumns under 1.3.6.1.4.1.37950.1.1.5.12.2.1.8.1 on 192.192.100.10:")
for col in sorted(columns, key=int):
    oid, val = samples[col]
    print(f"  Column {col}: {val}  (sample OID: {oid})")
