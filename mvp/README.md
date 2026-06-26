# SliceMatic Stage 2: Python Gradio MVP

This directory contains the Stage 2 prototype built using **Gradio** to validate input rules, pricing calculations, itemized multi-pizza receipt generation, and persistence logging.

---

## 🛠️ Features & Implementation Details

### 1. Robust Menu Ingestion (At startup)
- Reads `Types_of_Base.txt`, `Types_of_Pizza.txt`, and `Types_of_Toppings.txt`.
- Skips and prints warnings for malformed lines (lines that do not have 3 fields or have non-numeric price values).
- Refuses to start (aborts boot via `sys.exit(1)`) if a configuration file is missing or has zero valid entries.

### 2. Regex Validation Rules
- **Customer Name**: Strip whitespace and validate against `^[A-Za-z ]{2,40}$`.
- **Customer Phone**: Validate against `^[6-9][0-9]{9}$` (10-digit Indian mobile numbers).
- **Order Quantity**: Enforces a strict range of `1` to `10` pizzas per order.

### 3. Dynamic Table-Style Layout (Multi-Pizza Support)
- **Table Row Inputs**: Crust Base, Pizza Choice, and Topping are arranged side-by-side in horizontal rows (labeled `#1 Crust`, `#1 Pizza`, `#1 Topping`).
- **Dynamic Slider Binding**: Adjusting the Quantity slider instantly displays the exact number of pizza rows needed (up to 10) and hides the rest.
- **Wider Columns**: The input panel utilizes an expanded scale (`scale=4` vs `scale=2` for menus/receipt) to prevent dropdown values and arrow buttons from overlapping.

### 4. Localized Alert Containers
- **Errors Container**: Displays validation failure messages as a red list block directly above the submit button.
- **Success Alert Banner**: Renders as a green container upon successful checkout, confirming the order and guiding the user to view the receipt.

### 5. Pricing Engine & Bill Receipt
- **Line Unit Total**: Sum of `Crust + Pizza + Topping`.
- **Discount Logic**: Auto-applies `10% discount` on the subtotal if quantity >= 5.
- **GST**: Applies `18% GST` on the post-discount subtotal.
- **HTML Receipt**: Renders an itemized, double-dashed thermal style bill outlining each pizza selection, unit totals, discounts, taxes, and final payable amount.

### 6. Order Persistence Logger
- Successfully verified checkouts are logged to [orders_log.txt](orders_log.txt) separated by a blank line.
- Schema: `Timestamp | Name | Phone | Pizza1:Base@Price/Pizza:Name@Price/Topping:Name@Price | ... | Qty:N | Subtotal:S | Discount:D | GST:G | Total:T | Pay:Mode`
- Wrapped in IOException checks to warn the operator and allow offline ordering without crashing if writes fail.

---

## 🚀 How to Run the App

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Launch the Server**:
   ```bash
   python app.py
   ```

3. **Access in browser**:
   Navigate to **[http://127.0.0.1:7860](http://127.0.0.1:7860)**.
