package com.ameya.invoicetracker.service;

import com.ameya.invoicetracker.dto.TallyPartDTO;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.util.IOUtils;
import org.apache.poi.xssf.usermodel.XSSFRow;
import org.springframework.stereotype.Service;

import java.io.FileInputStream;
import java.util.*;
import java.util.regex.Pattern;

@Service
@Slf4j
public class ExcelParserService {

    static {
        IOUtils.setByteArrayMaxOverride(250_000_000);
    }

    public List<TallyPartDTO> parseParts(String filePath, String customerName) {
        return parseParts(filePath, customerName, "v374");
    }

    public List<TallyPartDTO> parseParts(String filePath, String customerName, String method) {
        try (FileInputStream fis = new FileInputStream(filePath);
             Workbook wb = WorkbookFactory.create(fis)) {

            DataFormatter fmt = new DataFormatter();
            FormulaEvaluator evaluator = wb.getCreationHelper().createFormulaEvaluator();
            evaluator.setIgnoreMissingWorkbooks(true);

            // Try master sheet first (Sheet1 / first sheet with many columns)
            for (int si = 0; si < wb.getNumberOfSheets(); si++) {
                Sheet sheet = wb.getSheetAt(si);
                String sn = sheet.getSheetName().toUpperCase().replace(" ", "");
                if (sn.equals("SHEET1") && sheet.getRow(0) != null
                        && sheet.getRow(0).getLastCellNum() >= 20) {
                    List<TallyPartDTO> parts = parseMaster(sheet, evaluator, fmt, customerName, method);
                    if (!parts.isEmpty()) {
                        log.info("Parsed {} parts from master sheet '{}' (method={})", parts.size(), sheet.getSheetName(), method);
                        return parts;
                    }
                }
            }
            // Fallback: try any sheet as summary
            for (int si = 0; si < wb.getNumberOfSheets(); si++) {
                Sheet sheet = wb.getSheetAt(si);
                List<TallyPartDTO> parts = parseSummary(sheet, evaluator, fmt);
                if (!parts.isEmpty()) {
                    log.info("Parsed {} parts from summary sheet '{}' (method={})", parts.size(), sheet.getSheetName(), method);
                    return parts;
                }
            }
            log.warn("No parts found in: {} (method={})", filePath, method);
            return Collections.emptyList();
        } catch (Exception e) {
            log.error("Excel parse error: {}", e.getMessage(), e);
            return Collections.emptyList();
        }
    }

    // ── Master sheet parser ─────────────────────────────────────────────
    private List<TallyPartDTO> parseMaster(Sheet sheet, FormulaEvaluator eval,
                                            DataFormatter fmt, String customerName) {
        return parseMaster(sheet, eval, fmt, customerName, "v374");
    }

    private List<TallyPartDTO> parseMaster(Sheet sheet, FormulaEvaluator eval,
                                            DataFormatter fmt, String customerName, String method) {
        Map<String, Integer> cols = findMasterColumns(sheet, fmt, eval);
        Integer partCol = cols.get("part"), qtyCol  = cols.get("qty"),
                amtCol  = cols.get("amt"),  poCol   = cols.get("po"),
                custCol = cols.get("cust"), srNoCol = cols.get("sr_no"),
                rateCol = cols.get("rate_pc");

        if (amtCol == null) return Collections.emptyList();

        boolean isV35 = "v35".equalsIgnoreCase(method);

        // Determine effective party (matches Python's detect_party / effective_party logic)
        String effectiveParty = customerName != null ? customerName : "";
        if (!effectiveParty.isBlank()) {
            boolean found = false;
            for (int r = 2; r <= Math.min(50, sheet.getLastRowNum()); r++) {
                Row row = sheet.getRow(r);
                if (isRowHidden(row)) continue;
                String cust = custCol != null ? getCellStr(row.getCell(custCol), eval, fmt) : "";
                if (!cust.isBlank() && customerMatches(cust, effectiveParty, method)) { found = true; break; }
            }
            // V3.7.4 only: if no match, fallback to first non-empty customer in sheet
            if (!found && !isV35) {
                for (int r = 2; r <= Math.min(50, sheet.getLastRowNum()); r++) {
                    Row row = sheet.getRow(r);
                    if (isRowHidden(row)) continue;
                    String cust = custCol != null ? getCellStr(row.getCell(custCol), eval, fmt) : "";
                    if (!cust.isBlank() && !cust.equalsIgnoreCase("none") && !cust.equalsIgnoreCase("customer")) {
                        effectiveParty = cust;
                        log.info("V3.7.4 effective_party fallback -> '{}'", effectiveParty);
                        break;
                    }
                }
            }
        }

        int pCol = partCol != null ? partCol : 12;
        List<TallyPartDTO> parts = new ArrayList<>();
        for (int r = 2; r <= sheet.getLastRowNum(); r++) {
            Row row = sheet.getRow(r);
            if (isRowHidden(row)) continue;    // skip hidden rows (Python: if i in hidden_rows: continue)
            String cust = custCol != null ? getCellStr(row.getCell(custCol), eval, fmt) : "";
            if (!effectiveParty.isBlank() && !customerMatches(cust, effectiveParty, method)) continue;
            String part = getCellStr(row.getCell(pCol), eval, fmt);
            if (part.isBlank()) continue;
            if (isV35 && !isValidPartNumber(part)) continue;
            double amt = getCellNum(amtCol != null ? row.getCell(amtCol) : null, eval);
            if (amt <= 0) continue;
            int qty = Math.max(1, (int) getCellNum(qtyCol != null ? row.getCell(qtyCol) : null, eval));
            String po = formatPo(getCellNum(poCol != null ? row.getCell(poCol) : null, eval),
                                 getCellStr(poCol != null ? row.getCell(poCol) : null, eval, fmt));
            String srNo = srNoCol != null ? getCellStr(row.getCell(srNoCol), eval, fmt) : "";
            double rate = rateCol != null ? getCellNum(row.getCell(rateCol), eval) : 0.0;
            parts.add(TallyPartDTO.builder().row(r + 1).partNo(part).qty(qty)
                    .amount(round2(amt)).poNo(po).poSrNo(srNo).ratePc(round2(rate)).build());
        }
        return parts;
    }

    // ── Summary sheet parser ─────────────────────────────────────────────
    private List<TallyPartDTO> parseSummary(Sheet sheet, FormulaEvaluator eval, DataFormatter fmt) {
        int headerRow = -1;
        Integer partCol = null, qtyCol = null, amtCol = null,
                poCol = null, srNoCol = null, rateCol = null;

        outer:
        for (int r = 0; r <= Math.min(6, sheet.getLastRowNum()); r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;
            for (Cell cell : row) {
                String h = getCellStr(cell, eval, fmt).toUpperCase().strip();
                if (h.contains("PART NO")) {
                    headerRow = r;
                    break outer;
                }
            }
        }
        if (headerRow < 0) return Collections.emptyList();

        Row hrow = sheet.getRow(headerRow);
        for (Cell cell : hrow) {
            String h = getCellStr(cell, eval, fmt).toUpperCase().strip();
            int col = cell.getColumnIndex();
            if (h.contains("PART NO") && partCol == null) partCol = col;
            else if (h.contains("DESP") && h.contains("QTY") && qtyCol == null) qtyCol = col;
            else if (h.contains("DESP") && h.contains("AMT") && amtCol == null) amtCol = col;
            else if ((h.equals("P.O.NO.") || h.equals("PO.NO.") || h.equals("PO NO") || h.equals("PO. NO.")) && poCol == null) poCol = col;
            else if (h.equals("SR. NO.") && srNoCol == null) srNoCol = col;
            else if (h.contains("RATE") && (h.contains("PER") || h.contains("PC")) && rateCol == null) rateCol = col;
        }
        if (partCol == null || amtCol == null) return Collections.emptyList();

        int dataStart = headerRow + 1;
        Row nextRow = sheet.getRow(dataStart);
        if (nextRow != null && qtyCol == null) {
            for (Cell cell : nextRow) {
                String h = getCellStr(cell, eval, fmt).toUpperCase();
                if (h.contains("QTY") && qtyCol == null) qtyCol = cell.getColumnIndex();
                if (h.contains("AMT") && amtCol == null) amtCol = cell.getColumnIndex();
            }
            dataStart = headerRow + 2;
        }

        List<TallyPartDTO> parts = new ArrayList<>();
        for (int r = dataStart; r <= sheet.getLastRowNum(); r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;
            String part = getCellStr(row.getCell(partCol), eval, fmt).strip();
            if (!isValidPartNumber(part)) continue;
            if (part.toLowerCase().startsWith("total") || part.toLowerCase().startsWith("grand")) break;
            double amt = getCellNum(amtCol != null ? row.getCell(amtCol) : null, eval);
            if (amt <= 0) continue;
            int qty = Math.max(1, (int) getCellNum(qtyCol != null ? row.getCell(qtyCol) : null, eval));
            String po = formatPo(getCellNum(poCol != null ? row.getCell(poCol) : null, eval),
                                 getCellStr(poCol != null ? row.getCell(poCol) : null, eval, fmt));
            String srNo = srNoCol != null ? getCellStr(row.getCell(srNoCol), eval, fmt) : "";
            double rate = rateCol != null ? getCellNum(row.getCell(rateCol), eval) : 0.0;
            parts.add(TallyPartDTO.builder().row(r + 1).partNo(part).qty(qty)
                    .amount(round2(amt)).poNo(po).poSrNo(srNo).ratePc(round2(rate)).build());
        }
        return parts;
    }

    // ── Column discovery ─────────────────────────────────────────────────
    private Map<String, Integer> findMasterColumns(Sheet sheet, DataFormatter fmt, FormulaEvaluator eval) {
        Map<String, Integer> cols = new HashMap<>();
        for (int r = 0; r <= 4; r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;
            for (Cell cell : row) {
                String h = getCellStr(cell, eval, fmt).toUpperCase().strip();
                int j = cell.getColumnIndex();
                if (h.contains("PART NO") && !cols.containsKey("part")) cols.put("part", j);
                if (h.contains("DESP") && h.contains("QTY") && !cols.containsKey("qty")) cols.put("qty", j);
                if (h.contains("DESP") && (h.contains("AMT") || h.contains("AMOUNT")) && !cols.containsKey("amt")) cols.put("amt", j);
                if ((h.equals("P.O.NO.") || h.equals("P.O.NO") || h.equals("PO.NO.") || h.equals("PO NO") || h.equals("PO. NO.")) && !cols.containsKey("po")) cols.put("po", j);
                if (h.contains("CUSTOMER") && !cols.containsKey("cust")) cols.put("cust", j);
                if (h.equals("SR. NO.") && !cols.containsKey("sr_no")) cols.put("sr_no", j);
                if (h.contains("RATE") && (h.contains("PER") || h.contains("PC")) && !cols.containsKey("rate_pc")) cols.put("rate_pc", j);
            }
        }
        cols.putIfAbsent("po",   1);
        cols.putIfAbsent("cust", 8);
        cols.putIfAbsent("part", 12);
        return cols;
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    /**
     * Checks whether a row is hidden.
     * Python openpyxl uses ws.row_dimensions[n].hidden which maps to the XML hidden attribute.
     * In POI, this is XSSFRow.getCTRow().getHidden() — NOT row.getZeroHeight() which is a
     * different attribute used for auto-fit. Both are checked for completeness.
     */
    private boolean isRowHidden(Row row) {
        if (row == null) return true;
        if (row.getZeroHeight()) return true;
        if (row instanceof XSSFRow xr) {
            return xr.getCTRow().getHidden();
        }
        return false;
    }

    /**
     * Reads a cell value as String using the CACHED formula result.
     * Equivalent to openpyxl data_only=True: avoids re-evaluating external references,
     * which would cause DataFormatter to return the raw formula string (e.g. [1]Sheet1!M8:M8).
     */
    private String getCellStr(Cell cell, FormulaEvaluator eval, DataFormatter fmt) {
        if (cell == null) return "";
        try {
            CellType type = cell.getCellType();
            if (type == CellType.FORMULA) {
                // Read cached result directly — never evaluates external workbook references
                CellType cached = cell.getCachedFormulaResultType();
                if (cached == CellType.STRING)  return cell.getStringCellValue().trim();
                if (cached == CellType.BOOLEAN) return String.valueOf(cell.getBooleanCellValue());
                if (cached == CellType.NUMERIC) {
                    double d = cell.getNumericCellValue();
                    long l = (long) d;
                    return d == l ? String.valueOf(l) : String.valueOf(d);
                }
                return ""; // ERROR or BLANK cached result -> treat as empty
            }
            return switch (type) {
                case STRING  -> cell.getStringCellValue().trim();
                case NUMERIC -> fmt.formatCellValue(cell).trim();
                case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
                default      -> "";
            };
        } catch (Exception e) {
            return "";
        }
    }

    /**
     * Reads a cell value as double using the CACHED formula result.
     */
    private double getCellNum(Cell cell, FormulaEvaluator eval) {
        if (cell == null) return 0;
        try {
            CellType type = cell.getCellType();
            if (type == CellType.FORMULA) {
                CellType cached = cell.getCachedFormulaResultType();
                if (cached == CellType.NUMERIC) return cell.getNumericCellValue();
                if (cached == CellType.STRING) {
                    String s = cell.getStringCellValue().replace(",", "").strip();
                    try { return Double.parseDouble(s); } catch (NumberFormatException ignored) {}
                }
                return 0;
            }
            if (type == CellType.NUMERIC) return cell.getNumericCellValue();
            if (type == CellType.STRING) {
                String s = cell.getStringCellValue().replace(",", "").strip();
                try { return Double.parseDouble(s); } catch (NumberFormatException ignored) {}
            }
            return 0;
        } catch (Exception e) {
            return 0;
        }
    }

    private boolean customerMatches(String cust, String party) {
        return customerMatches(cust, party, "v374");
    }

    /**
     * Customer name matching — replicates Python's exact logic:
     *   V3.7.4: substring match OR >=3 common words (4+ char words)
     *   V3.5:   empty cust -> false; substring OR >=1 word OR 70% char overlap fuzzy match
     */
    private boolean customerMatches(String cust, String party, String method) {
        boolean isV35 = "v35".equalsIgnoreCase(method);

        // V3.5: Python explicitly returns False for empty customer (if not cust or not cust.strip(): return False)
        if (isV35 && (cust == null || cust.isBlank())) return false;

        String a = normalise(cust), b = normalise(party);
        if (a.contains(b) || b.contains(a)) return true;

        Set<String> wa = wordSet(cust != null ? cust.toLowerCase() : "");
        Set<String> wb = wordSet(party.toLowerCase());
        // V3.7.4: Python uses >= 3 common words; V3.5: Python uses >= 1
        int threshold = isV35 ? 1 : 3;
        if (countCommon(wa, wb) >= threshold) return true;

        // V3.5 additional fuzzy: 70% character overlap between long words (Python's extra fallback)
        if (isV35) {
            for (String w1 : wa) {
                for (String w2 : wb) {
                    if (w1.length() >= 5 && w2.length() >= 5) {
                        final String ref = w2;
                        long common = w1.chars().filter(c -> ref.indexOf(c) >= 0).count();
                        if (common >= Math.min(w1.length(), w2.length()) * 0.7) return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Matches Python's _is_valid_part_number logic:
     * must contain a letter, rejects purely numeric strings, totals, blanks, "none", "nan".
     */
    private boolean isValidPartNumber(String s) {
        if (s == null || s.isBlank()) return false;
        s = s.strip();
        if (s.equalsIgnoreCase("none") || s.equalsIgnoreCase("nan")) return false;
        if (s.toLowerCase().startsWith("total") || s.toLowerCase().startsWith("grand")) return false;
        // Reject purely numeric (Python: s.replace('.','').replace('-','').replace('/','').isdigit())
        String stripped = s.replace(".", "").replace("-", "").replace("/", "");
        if (!stripped.isEmpty() && stripped.chars().allMatch(Character::isDigit)) return false;
        // Must contain at least one letter (Python: re.search(r'[a-zA-Z]', s))
        return Pattern.compile("[a-zA-Z]").matcher(s).find();
    }

    private String formatPo(double num, String str) {
        if (num > 0) return String.valueOf((long) num);
        return str == null ? "" : str.strip();
    }

    private static String normalise(String s) {
        return s == null ? "" : s.toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    private static Set<String> wordSet(String s) {
        Set<String> r = new HashSet<>();
        for (String w : s.split("[^a-z]+")) { if (w.length() > 3) r.add(w); }
        return r;
    }

    private static int countCommon(Set<String> a, Set<String> b) {
        int n = 0;
        for (String w : a) { if (b.contains(w)) n++; }
        return n;
    }

    private static double round2(double v) { return Math.round(v * 100.0) / 100.0; }
}
