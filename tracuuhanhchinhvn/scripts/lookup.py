#!/usr/bin/env python3
from __future__ import annotations
import argparse, csv, json, re, unicodedata
from pathlib import Path
from typing import Any, Dict, List

BASE = Path(__file__).resolve().parents[1]
REF = BASE / "references"

def norm(s: Any) -> str:
    s = "" if s is None else str(s)
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = s.replace("Đ", "D").replace("đ", "d").lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def tokens(s: str) -> set[str]:
    stop = {"tinh","thanh","pho","so","va","cua","la","trong","ve","tai","theo","con","dung","khong","nay"}
    return {t for t in norm(s).split() if len(t) >= 2 and t not in stop}

def score(query: str, haystack: str) -> float:
    qn, hn = norm(query), norm(haystack)
    if not qn or not hn: return 0.0
    if qn in hn: return 100.0 + min(len(qn), 50) / 100.0
    qt, ht = tokens(qn), tokens(hn)
    if not qt: return 0.0
    overlap = len(qt & ht)
    if overlap == 0: return 0.0
    return 80.0 * overlap / len(qt) + 20.0 * overlap / max(len(ht), 1)

def load_org() -> List[Dict[str, Any]]:
    data=json.loads((REF/"lam_dong_organization.json").read_text(encoding="utf-8"))
    out=[]
    for r in data["records"]:
        primary=" | ".join(filter(None,[r.get("canonical_name"),r.get("short_name")]))
        other=[r.get("resolution_number"),r.get("note")] + r.get("old_entities",[])
        for x in r.get("received_functions_from",[]): other += [x.get("source"),x.get("functions")]
        out.append({"domain":"lam_dong_organization","record":r,"primary":primary,"search":" | ".join(str(x) for x in other if x)})
    return out

def load_geo() -> List[Dict[str, Any]]:
    data=json.loads((REF/"geography_34.json").read_text(encoding="utf-8"))
    out=[]
    for r in data["records"]:
        primary=r.get("canonical_name","")
        search=" | ".join([primary,*r.get("former_entities",[]),r.get("administrative_center") or "",r.get("source_text","")])
        out.append({"domain":"geography","record":r,"primary":primary,"search":search})
    return out

def load_metrics() -> List[Dict[str, Any]]:
    data=json.loads((REF/"cchc_snapshot_2025.json").read_text(encoding="utf-8"))
    out=[]
    for r in data["records"]:
        rr=dict(r); rr.setdefault("dataset_as_of",data.get("as_of")); rr.setdefault("source_id","CCHC-2025-11-27")
        primary=r.get("metric","")
        search=" | ".join(str(x) for x in [r.get("metric"),r.get("period"),r.get("entity"),r.get("rank"),r.get("target")] if x)
        out.append({"domain":"metrics","record":rr,"primary":primary,"search":search})
    return out

def load_legal() -> List[Dict[str, Any]]:
    data=json.loads((REF/"source_index.json").read_text(encoding="utf-8"))
    out=[]
    for r in data["sources"]:
        primary=" | ".join(str(x) for x in [r.get("number"),r.get("title"),r.get("subject")] if x)
        search=" | ".join(str(x) for x in r.values() if isinstance(x,(str,int,float)))
        out.append({"domain":"legal_sources","record":r,"primary":primary,"search":search})
    return out

def load_admin_profile() -> List[Dict[str, Any]]:
    data=json.loads((REF/"admin_document_profile.json").read_text(encoding="utf-8"))
    rec=data["records"]
    flat=json.dumps(rec,ensure_ascii=False)
    return [{"domain":"admin_profile","record":rec,"primary":"Nghị định 30 NĐ30 thể thức văn bản hành chính NQ60 KH141","search":flat}]

LOADERS={
    "lam_dong_organization":load_org,
    "geography":load_geo,
    "metrics":load_metrics,
    "legal_sources":load_legal,
    "admin_profile":load_admin_profile,
}

def main() -> None:
    ap=argparse.ArgumentParser()
    ap.add_argument("--query",required=True)
    ap.add_argument("--domain",choices=["all",*LOADERS.keys()],default="all")
    ap.add_argument("--limit",type=int,default=5)
    args=ap.parse_args()
    domains=list(LOADERS) if args.domain=="all" else [args.domain]
    items=[]
    for d in domains: items += LOADERS[d]()
    ranked=[]
    for item in items:
        base=score(args.query,item["search"])
        primary=score(args.query,item.get("primary",""))
        s=max(base, primary+12 if primary>0 else 0)
        if s>0: ranked.append((s,item))
    ranked.sort(key=lambda x:x[0],reverse=True)
    results=[{"score":round(s,2),"domain":i["domain"],"record":i["record"]} for s,i in ranked[:max(1,args.limit)]]
    print(json.dumps({"query":args.query,"status":"found" if results else "not_found","results":results},ensure_ascii=False,indent=2))

if __name__=="__main__":
    main()
