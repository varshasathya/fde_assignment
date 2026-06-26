# SliceMatic Project Documentation (Stage 1)

This folder contains supporting details and detailed explanations for the **SliceMatic** Stage 1 Product Requirements Document (PRD) and Business Economics Deep-Dive.

---

## 🍕 Business Context & Challenges

SliceMatic is a delivery-first, cloud-kitchen style pizza brand operated out of New Ashok Nagar, Delhi. The project addresses key financial challenges and operational specifications to achieve profitability within an own-channel delivery model.

### Key Business Insights & Rationale

1. **Ramped Payback vs. Instant Maturity**:
   - **3.5 Months Payback**: Assumes instant operational maturity (~45 orders/day on Day 1), returning cash immediately against the Rs. 15L investment.
   - **18 Months Payback (Realistic)**: Factors in a realistic 6-month ramp-up curve, EMIs, corporate taxes, working capital requirements, and owner drawings. This represents the true break-even horizon.

2. **Delivery-First Own Channel & COD**:
   - To avoid high aggregator commissions (up to 30%), SliceMatic optimizes a delivery-first model.
   - Cash on Delivery (COD) acts as the primary transaction mode at delivery checkout to capture the local market, integrated into the digital validation engine.

3. **Blended Economics**:
   - Subsidizes lower volume weekdays with high-performing weekends.
   - Blended daily order average of ~13 orders/day is required to break even on Rs. 2,02,910 monthly fixed overheads.

---

## 🖥️ Unified Interactive HTML Dashboard

All insights, functional user stories, system NFRs, and financial projections are compiled into [index.html](../index.html).

### Highlights:
- **Left-Sidebar Navigation**: Tabbed structure separating Executive Cover, Part A (PRD), Part B (Economics), and the Simulator.
- **MoSCoW Priortization Matrix**: Explains essential baseline features (Regex validation, logging) vs deferred specs (online PG integrations, multi-pizzeria baskets).
- **Unit Economics Simulator**: Real-time playground to calculate blended contribution margins, daily break-evens, EBITDA, and capital payback dynamically using custom slider inputs.
