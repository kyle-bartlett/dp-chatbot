# Usage Examples - Anker Supply Chain Knowledge Hub

## 🎯 Query Examples by Role

### Demand Planner Queries

**Forecast Analysis:**
```
"What's the forecast for SKU B08C5RR1S4 for next 4 weeks?"
"Show me week-over-week changes in Costco forecast"
"What are the top 10 SKUs with biggest forecast increases?"
"Compare this week's demand plan vs last week for USB-C category"
```

**CPFR Queries:**
```
"What's the CPFR process for Walmart?"
"Show me the latest Costco CPFR file"
"When is the Target forecast due?"
"What changed in the Best Buy CPFR submission?"
```

**Trend Analysis:**
```
"Which categories show declining trends?"
"What's the WoW delta for all Apple products?"
"Show me forecast accuracy for Q4"
```

---

### Supply Planner Queries

**Pipeline Tracking:**
```
"What's the inbound status for SKU B09C5RR1S4?"
"Show me all shipments with ETA this week"
"Which POs are delayed?"
"What's the pipeline for power banks?"
```

**Inventory Queries:**
```
"Current inventory levels for USB-C cables"
"Show me all SKUs below safety stock"
"What's arriving at the warehouse next week?"
"Inventory turnover for charging category"
```

---

### Operations Queries

**Logistics & Tracking:**
```
"Where is PO #123456?"
"Show me all shipments in transit"
"What's the warehouse capacity status?"
"Tracking number for shipment ABC123"
```

**Process & SOPs:**
```
"What's the SOP for receiving new inventory?"
"How do I process an urgent order?"
"What's the escalation process for delays?"
```

---

### GTM Team Queries

**Launch Planning:**
```
"What's the launch timeline for the new power bank?"
"Show me retail coverage for Q1 launches"
"What are the marketing assets for product XYZ?"
"Which retailers are carrying the new line?"
```

**Retail Coordination:**
```
"What's our shelf placement at Target?"
"Show me the retail calendar for this quarter"
"What promotions are running at Best Buy?"
```

---

### Sales Team Queries

**Account Management:**
```
"What's the revenue pipeline for Costco?"
"Show me sellthrough rate for Amazon"
"What's our top-selling SKU at Walmart?"
"Account performance summary for Q4"
```

**Performance Tracking:**
```
"Week-over-week sales by retailer"
"What's our market share in charging category?"
"Show me the sales forecast vs actuals"
```

---

### Management Queries

**Executive Summary:**
```
"Give me a summary of all at-risk SKUs"
"What are the top 5 supply chain risks?"
"Show me KPI dashboard highlights"
"Forecast accuracy across all categories"
```

**Cross-functional Overview:**
```
"What's the status of Q1 launches?"
"Show me demand vs supply gaps"
"What are the main bottlenecks this week?"
"Team performance metrics"
```

---

## 🔍 Query Pattern Examples

### Structured Data Queries (Sheets)

These queries will trigger structured search and pull from spreadsheet data:

- **"Show me forecast for [SKU/Category]"**
- **"What changed week-over-week?"**
- **"Pipeline status for [Product]"**
- **"Inventory levels for [Warehouse/Category]"**
- **"CPFR data for [Retailer]"**
- **"Sales by [Time Period/Retailer/Category]"**

### Semantic Queries (Docs)

These queries will trigger semantic search across documents:

- **"How do I [process/procedure]?"**
- **"What's the SOP for [task]?"**
- **"Explain [concept/policy]"**
- **"Where can I find [document/guide]?"**
- **"What did we discuss in [meeting/doc]?"**
- **"Who is responsible for [task/area]?"**

### Hybrid Queries

These will search both structured and semantic sources:

- **"What's the forecast and launch plan for [product]?"**
- **"Show me inventory and explain the replenishment process"**
- **"Pipeline delays and escalation procedure"**
- **"Sales performance and marketing strategy"**

---

## 💡 Best Practices

### Write Effective Queries

**✅ Good Queries:**
- "What's the Costco forecast for USB-C cables for weeks 1-4?"
- "Show me week-over-week changes in power bank demand"
- "Where is the SOP for new item setup?"
- "Pipeline status for all shipments arriving this week"

**❌ Less Effective:**
- "Show me stuff"
- "What's happening?"
- "Tell me about forecasts"
- "Data"

### Use Specific Identifiers

**Include:**
- SKUs/ASINs (B08C5RR1S4)
- Date ranges (next 4 weeks, Q1 2024)
- Retailers (Costco, Walmart, Target)
- Categories (USB-C, power banks, charging)
- Team contexts (demand, supply, ops)

### Set Your Context

Before starting, make sure your role and team are set correctly in Settings:

1. **Role** - Determines which keywords and patterns are prioritized
2. **Team** - Filters results to show team-relevant files first
3. **Default context** - Used when context isn't clear from query

---

## 🔄 Workflow Examples

### Daily Demand Planner Routine

**Morning:**
1. "What changed in forecasts overnight?"
2. "Show me all forecast updates from the team"
3. "What's due for submission today?"

**Throughout Day:**
4. "Costco forecast for [specific SKUs]"
5. "Week-over-week analysis for [category]"
6. "What's the CPFR deadline for Target?"

**End of Day:**
7. "Summary of today's forecast changes"
8. "What needs attention tomorrow?"

### Weekly Supply Planning Review

1. "Show me all inbound shipments for next week"
2. "Which SKUs are below safety stock?"
3. "Pipeline delays summary"
4. "What's the inventory projection for [category]?"
5. "Replenishment plan for [retailer]"

### Monthly GTM Review

1. "Launch status for all Q1 products"
2. "Retail coverage by channel"
3. "What marketing assets are live?"
4. "Show me retailer feedback on new products"
5. "Promotional calendar for next month"

---

## 🚀 Advanced Features

### Context Switching

Switch team context on the fly:

- "Switch to ops team view"
- "Show me GTM folder content"
- "Filter by demand planning files only"

### Multi-File Queries

The system automatically searches across all relevant files:

- "Summarize all comments on SKU B08C5RR1S4 across sheets"
- "Find mentions of [product name] in all docs"
- "Show me all forecast versions for this SKU"

### Time-Based Queries

- "What changed in the last 24 hours?"
- "Show me updates from this week"
- "Compare last 4 weeks"
- "Historical trend for [SKU/category]"

---

## 📊 Understanding Results

### Result Types

**🔢 Structured Results** (from Sheets)
- Exact data: forecasts, numbers, SKUs
- Formatted tables and values
- Week-over-week comparisons
- Pipeline/inventory status

**📄 Semantic Results** (from Docs)
- Paragraphs and explanations
- SOPs and procedures
- Meeting notes and comments
- Training materials

**🔀 Hybrid Results**
- Combination of both types
- Cross-referenced information
- Complete context from multiple sources

### Source Citations

Every answer includes:
- **Document name** - Which file the info came from
- **Link** - Direct link to Google Sheet/Doc
- **Type** - Structured (sheet) or Semantic (doc)
- **Confidence score** - How relevant the match is

---

## 🛠️ Troubleshooting

### "No data found"

**Possible reasons:**
1. Files haven't been synced yet → Check Settings > Sync Status
2. Query is too vague → Be more specific
3. Data isn't in synced folders → Add the folder to sync
4. Team context is too restrictive → Switch to "All Teams"

### Results don't match expectations

**Try:**
1. Rephrase your query with more specific terms
2. Check your role/team context in Settings
3. Verify the source files are synced
4. Use exact SKU/ASIN instead of product name

### Sync issues

**Check:**
1. Google Drive permissions are granted
2. Folder sync is enabled in Settings
3. Files have been modified/updated to trigger sync
4. No Google API rate limits (check logs)
