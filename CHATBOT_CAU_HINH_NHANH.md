# Huong Dan Cau Hinh Chatbot (Gemini + Vertex AI Search)

## 1) Muc tieu
- Chat model: Gemini
- Web search provider uu tien: Vertex AI Search
- Fallback: nguon chinh thong truc tiep (vbpl, chinhphu, quochoi, ...)
- Co the giu Google CSE lam legacy fallback neu can.

## 2) Truong can cau hinh trong Admin
- web_search_provider: `vertex_search`
- vertex_project_id: `gen-lang-client-0462350485`
- vertex_location: `global`
- vertex_data_store_id: `<YOUR_DATA_STORE_ID>`
- vertex_serving_config: de trong (he thong tu tao default path) hoac nhap full path
- web_search_mode: `cse_fast` (nhanh nhat) hoac `cse_with_fallback` (co fallback)

## 3) Full path serving config (neu muon nhap tay)
`projects/<PROJECT_ID>/locations/<LOCATION>/collections/default_collection/dataStores/<DATA_STORE_ID>/servingConfigs/default_search`

## 4) Kiem tra sau cau hinh
1. Admin -> Lam moi cau hinh
2. Admin -> Web search health phai bao healthy=true hoac co item_count > 0
3. Test 3 query:
   - so hieu cu the (vd: 72/2025/QH15)
   - truy van moi nhat/hom nay
   - truy van tong quat ND30/HD36

## 5) Neu Vertex chua tra ket qua
- Kiem tra Data Store da ingest du lieu web chua
- Kiem tra IAM cho service account Cloud Run / local service-account.json
- Thu nhap full `vertex_serving_config` thay vi chi data_store_id
- Tam thoi doi `web_search_provider = cse` neu can fallback legacy
