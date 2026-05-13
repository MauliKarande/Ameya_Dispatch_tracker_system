# Ameya Precision Engineers — Invoice Tracker
> Role-based Work Order lifecycle tracker | Port 8123 | LAN-ready

---

## 🚀 Run the Application

### Step 1 — Build
```bash
mvn clean package -DskipTests
```

### Step 2 — Run
```bash
java -jar target/invoice-tracker-1.0.0.jar
```

### Access URLs
| Where | URL |
|-------|-----|
| Your machine | http://localhost:8123 |
| Office LAN | http://192.168.151.7:8123 |
| H2 Console | http://localhost:8123/h2-console |

---

## 👤 Users & Roles

See `USER_CREDENTIALS.txt` for all login details.

| Username | Full Name | Role |
|----------|-----------|------|
| arvind.patil | Arvind Patil | WO Sender |
| santosh.bhosale | Santosh Bhosale | WO Sender |
| amit.mane | Amit Mane | WO Sender |
| krishna.salgar | Krishna Salgar | Store Person |
| laxman.wagh | Laxman Waghchoure | Packaging |
| mauli.karande | Mauli Karande | Invoice Creator |
| bipin.pande | Bipin Pande | Viewer |
| sanjay.khutwad | Sanjay Khutwad | Viewer |
| guest.viewer | Guest Viewer | Viewer |

---

## 🔧 Key Fixes in v2

| Issue | Fix |
|-------|-----|
| Port 8080 | Changed to **8123** |
| Access only from host | Added `server.address=0.0.0.0` → LAN accessible |
| 403 on file download | Downloads use **fetch + Blob** (JWT header sent) — no more 403 |
| Demo credentials on screen | Removed — replaced with admin contact note |
| Generic usernames | All real Ameya staff names and usernames |

---

## 🗄️ Switch to MySQL (Production)

1. Edit `src/main/resources/application.properties`
2. Comment out H2 block, uncomment MySQL block
3. Set your DB password
4. Run: `CREATE DATABASE invoice_tracker;` in MySQL
5. Rebuild and run

---

## 📂 File Storage

```
./uploads/
  excel/    ← Work Order Excel files (versioned)
  pdf/      ← Invoice PDF files (versioned)
./data/
  invoicetracker.mv.db  ← H2 persistent database
```

---

## ❓ Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't access from another PC | Check Windows Firewall → allow port 8123 |
| 403 on download | Update to v2 (fetch+Blob fix already included) |
| App not starting | Check Java 17+: `java -version` |
| User can't login | Check USER_CREDENTIALS.txt for correct username |
| Data lost after restart | H2 is file-based — data persists in ./data/ folder |
"# Ameya_Dispatch_tracker_system" 
